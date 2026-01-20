-- Move staging table to public schema (or create if not exists)
-- Run this SQL in Supabase SQL Editor

-- Option 1: If table exists in scraper schema, move it
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'scraper' AND table_name = 'raw_event_staging') THEN
    ALTER TABLE scraper.raw_event_staging SET SCHEMA public;
    RAISE NOTICE 'Table moved from scraper to public schema';
  ELSE
    RAISE NOTICE 'Table not found in scraper schema, will create in public';
  END IF;
END $$;

-- Option 2: Create table in public schema (if doesn't exist)
CREATE TABLE IF NOT EXISTS public.raw_event_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.scraper_sources(id),
    url TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    detail_html TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetch_metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_staging_status ON public.raw_event_staging(status);
CREATE INDEX IF NOT EXISTS idx_raw_staging_source_id ON public.raw_event_staging(source_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_staging_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_raw_event_staging_modtime ON public.raw_event_staging;

CREATE TRIGGER update_raw_event_staging_modtime
    BEFORE UPDATE ON public.raw_event_staging
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_staging_updated_at();

-- RLS
ALTER TABLE public.raw_event_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.raw_event_staging;

CREATE POLICY "service_role_all" ON public.raw_event_staging
    FOR ALL
    USING (auth.role() = 'service_role');

-- Grants
GRANT ALL ON public.raw_event_staging TO postgres, anon, authenticated, service_role;
