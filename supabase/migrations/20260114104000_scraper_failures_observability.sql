-- Migration: Scraper Failures Table for Observability
-- Purpose: Track scraping failures and store raw HTML for offline debugging
-- This enables the "self-healing" scraper pipeline by detecting broken selectors

-- Create scraper_failures table
CREATE TABLE IF NOT EXISTS public.scraper_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES scraper_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN ('no_events_found', 'selector_failed', 'parse_error', 'fetch_error', 'rate_limited')),
  error_message TEXT,
  raw_html TEXT, -- Store HTML for offline analysis
  selector_context JSONB, -- Store which selectors failed
  events_expected INTEGER DEFAULT 0, -- How many events we expected based on history
  events_found INTEGER DEFAULT 0, -- How many we actually found
  status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_scraper_failures_source ON scraper_failures(source_id);
CREATE INDEX idx_scraper_failures_created ON scraper_failures(created_at DESC);
CREATE INDEX idx_scraper_failures_error_type ON scraper_failures(error_type);
CREATE INDEX idx_scraper_failures_unresolved ON scraper_failures(created_at DESC) WHERE resolved_at IS NULL;

-- Enable RLS
ALTER TABLE scraper_failures ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by edge functions)
CREATE POLICY "Service role full access on scraper_failures" 
  ON scraper_failures FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Authenticated users can view failures (for admin dashboard)
CREATE POLICY "Authenticated users can view scraper failures" 
  ON scraper_failures FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Function to track historical event counts for sources
CREATE OR REPLACE FUNCTION get_source_historical_event_count(p_source_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Get average events scraped from last 5 successful runs
  SELECT COALESCE(AVG(events_scraped)::INTEGER, 0)
  INTO v_count
  FROM (
    SELECT events_scraped
    FROM scrape_jobs
    WHERE source_id = p_source_id
      AND status = 'completed'
      AND events_scraped > 0
    ORDER BY completed_at DESC
    LIMIT 5
  ) recent_jobs;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON TABLE scraper_failures IS 
  'Tracks scraping failures for observability and debugging. Stores raw HTML to enable offline analysis of broken selectors.';

COMMENT ON FUNCTION get_source_historical_event_count(UUID) IS 
  'Returns the average number of events scraped from a source based on last 5 successful runs. Used to detect anomalies.';
