-- Create discovery_jobs table for tracking municipality discovery progress
CREATE TABLE IF NOT EXISTS public.discovery_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  municipality TEXT NOT NULL,
  population INTEGER,
  province TEXT,
  coordinates JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sources_found INTEGER DEFAULT 0,
  sources_added INTEGER DEFAULT 0,
  error_message TEXT,
  batch_id UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON public.discovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_batch ON public.discovery_jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_discovery_jobs_priority ON public.discovery_jobs(priority DESC, created_at ASC);

-- Enable RLS
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to discovery_jobs"
  ON public.discovery_jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_discovery_jobs_updated_at
  BEFORE UPDATE ON public.discovery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add last_discovery_at column to scraper_sources for incremental mode
ALTER TABLE public.scraper_sources 
  ADD COLUMN IF NOT EXISTS last_discovery_at TIMESTAMPTZ;