-- Migration: Create raw_event_staging table for Data-First ELT pipeline
-- Idempotent creation of enum type for status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'raw_event_status') THEN
    CREATE TYPE public.raw_event_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END $$;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.raw_event_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL UNIQUE,
  raw_html TEXT NOT NULL,
  status raw_event_status NOT NULL DEFAULT 'pending',
  processing_log JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_raw_event_status ON public.raw_event_staging (status);
CREATE INDEX IF NOT EXISTS idx_raw_event_source_url ON public.raw_event_staging (source_url);

-- Trigger to update updated_at on row change
CREATE OR REPLACE FUNCTION public.update_raw_event_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_raw_event_timestamp ON public.raw_event_staging;
CREATE TRIGGER trg_update_raw_event_timestamp
BEFORE UPDATE ON public.raw_event_staging
FOR EACH ROW EXECUTE FUNCTION public.update_raw_event_timestamp();

-- RLS policies (example, adjust as needed)
ALTER TABLE public.raw_event_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY select_policy ON public.raw_event_staging FOR SELECT USING (true);
CREATE POLICY insert_policy ON public.raw_event_staging FOR INSERT WITH CHECK (true);
CREATE POLICY update_policy ON public.raw_event_staging FOR UPDATE USING (true);
