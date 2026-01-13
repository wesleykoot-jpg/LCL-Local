-- migrations/supabase-schema.sql
-- Defensive scheduled scraper schema
-- Tracks scrape events and per-source state for debugging and alerting

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- scrape_events: store each fetch attempt (for debugging & replay)
CREATE TABLE IF NOT EXISTS scrape_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id text NOT NULL,
  source_id text NOT NULL,
  url text NOT NULL,
  http_status int,
  success boolean NOT NULL DEFAULT false,
  etag text,
  last_modified text,
  body text, -- consider truncation
  error text,
  headers jsonb,
  raw_response_summary text,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scrape_events_run_id ON scrape_events(run_id);
CREATE INDEX IF NOT EXISTS idx_scrape_events_source_id ON scrape_events(source_id);
CREATE INDEX IF NOT EXISTS idx_scrape_events_created_at ON scrape_events(created_at DESC);

-- scrape_state: persistent per-source metadata and counters
CREATE TABLE IF NOT EXISTS scrape_state (
  source_id text PRIMARY KEY,
  last_success_at timestamptz,
  last_run_at timestamptz,
  consecutive_failures int DEFAULT 0,
  last_alert_at timestamptz,
  last_etag text,
  last_last_modified text,
  last_http_status int,
  note text,
  updated_at timestamptz DEFAULT now()
);

-- Add a trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_scrape_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scrape_state_updated_at
  BEFORE UPDATE ON scrape_state
  FOR EACH ROW
  EXECUTE FUNCTION update_scrape_state_updated_at();
