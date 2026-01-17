-- Migration: Add scraper_runs table for strategy execution logging
-- Created: 2026-01-17

-- Create scraper_runs table to log all scraper executions
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  events_scraped INT DEFAULT 0,
  events_failed INT DEFAULT 0,
  events_skipped INT DEFAULT 0,
  error_message TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for querying by strategy
CREATE INDEX IF NOT EXISTS idx_scraper_runs_strategy ON scraper_runs(strategy);

-- Add index for querying by status and time
CREATE INDEX IF NOT EXISTS idx_scraper_runs_status_time ON scraper_runs(status, completed_at DESC);

-- Add index for recent runs
CREATE INDEX IF NOT EXISTS idx_scraper_runs_completed_at ON scraper_runs(completed_at DESC);

-- Add source_url column to events table if not exists (for deduplication)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'source_url'
  ) THEN
    ALTER TABLE events ADD COLUMN source_url TEXT;
  END IF;
END $$;

-- Add index on source_url for deduplication
CREATE INDEX IF NOT EXISTS idx_events_source_url ON events(source_url) WHERE source_url IS NOT NULL;

-- Add google_place_id column to events table if not exists (for dining deduplication)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'google_place_id'
  ) THEN
    ALTER TABLE events ADD COLUMN google_place_id TEXT;
  END IF;
END $$;

-- Add index on google_place_id for deduplication
CREATE INDEX IF NOT EXISTS idx_events_google_place_id ON events(google_place_id) WHERE google_place_id IS NOT NULL;

-- Add RLS policy for scraper_runs (service role only for writes)
ALTER TABLE scraper_runs ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role can manage scraper_runs" ON scraper_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read scraper_runs (for admin dashboards)
CREATE POLICY "Authenticated users can view scraper_runs" ON scraper_runs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Function to get scraper statistics
CREATE OR REPLACE FUNCTION get_scraper_stats(
  p_strategy TEXT DEFAULT NULL,
  p_days INT DEFAULT 7
)
RETURNS TABLE (
  strategy TEXT,
  total_runs INT,
  successful_runs INT,
  failed_runs INT,
  total_events_scraped INT,
  total_events_failed INT,
  total_events_skipped INT,
  success_rate DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.strategy,
    COUNT(*)::INT as total_runs,
    COUNT(*) FILTER (WHERE sr.status = 'success')::INT as successful_runs,
    COUNT(*) FILTER (WHERE sr.status = 'error')::INT as failed_runs,
    COALESCE(SUM(sr.events_scraped), 0)::INT as total_events_scraped,
    COALESCE(SUM(sr.events_failed), 0)::INT as total_events_failed,
    COALESCE(SUM(sr.events_skipped), 0)::INT as total_events_skipped,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND(COUNT(*) FILTER (WHERE sr.status = 'success')::DECIMAL / COUNT(*)::DECIMAL * 100, 2)
      ELSE 0
    END as success_rate
  FROM scraper_runs sr
  WHERE sr.completed_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (p_strategy IS NULL OR sr.strategy = p_strategy)
  GROUP BY sr.strategy
  ORDER BY sr.strategy;
END;
$$;

-- Function to get recent scraper runs
CREATE OR REPLACE FUNCTION get_recent_scraper_runs(
  p_strategy TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  strategy TEXT,
  status TEXT,
  events_scraped INT,
  events_failed INT,
  events_skipped INT,
  error_message TEXT,
  completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id,
    sr.strategy,
    sr.status,
    sr.events_scraped,
    sr.events_failed,
    sr.events_skipped,
    sr.error_message,
    sr.completed_at
  FROM scraper_runs sr
  WHERE (p_strategy IS NULL OR sr.strategy = p_strategy)
  ORDER BY sr.completed_at DESC
  LIMIT p_limit;
END;
$$;

-- Comment for documentation
COMMENT ON TABLE scraper_runs IS 'Logs execution history for all scraper strategies (sports, music, nightlife, culture, dining)';
COMMENT ON COLUMN scraper_runs.strategy IS 'Name of the scraper strategy (sports, music, nightlife, culture, dining)';
COMMENT ON COLUMN scraper_runs.status IS 'Execution status: success or error';
COMMENT ON COLUMN scraper_runs.events_scraped IS 'Number of events successfully inserted or updated';
COMMENT ON COLUMN scraper_runs.events_failed IS 'Number of events that failed validation or insertion';
COMMENT ON COLUMN scraper_runs.events_skipped IS 'Number of duplicate events skipped';
