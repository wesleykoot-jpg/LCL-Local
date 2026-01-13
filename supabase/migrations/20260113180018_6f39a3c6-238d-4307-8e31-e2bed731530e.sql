-- Create job queue table for scraper tasks
CREATE TABLE public.scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES scraper_sources(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  events_scraped INTEGER DEFAULT 0,
  events_inserted INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queue operations
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_scrape_jobs_pending ON scrape_jobs(priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX idx_scrape_jobs_source ON scrape_jobs(source_id);

-- Enable RLS
ALTER TABLE scrape_jobs ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by edge functions)
CREATE POLICY "Service role full access" ON scrape_jobs FOR ALL USING (true) WITH CHECK (true);

-- Authenticated users can view jobs (for admin dashboard)
CREATE POLICY "Authenticated users can view jobs" ON scrape_jobs FOR SELECT USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_scrape_jobs_updated_at
  BEFORE UPDATE ON scrape_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();