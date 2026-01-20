-- Migration: Fix raw_event_staging in PUBLIC schema for API access
-- And ensure scraper_sources columns are correct.

-- 1. Enum for status if not exists
DO $$ BEGIN
    CREATE TYPE raw_event_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Clean up or transition public.raw_event_staging
-- We rename the existing table to backup if it has important data, or just drop and recreate if it's a reset.
-- Given it's a "Critical Architecture Reset", we'll drop and recreate.
DROP TABLE IF EXISTS public.raw_event_staging CASCADE;

CREATE TABLE public.raw_event_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url TEXT UNIQUE NOT NULL,
    raw_html TEXT NOT NULL,
    status raw_event_status DEFAULT 'pending',
    processing_log JSONB DEFAULT '[]'::jsonb,
    source_id UUID REFERENCES public.scraper_sources(id) ON DELETE SET NULL,
    parsing_method TEXT, -- 'deterministic' | 'ai' | 'cheap'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indeces for performance
CREATE INDEX IF NOT EXISTS idx_staging_status ON public.raw_event_staging (status);
CREATE INDEX IF NOT EXISTS idx_staging_source_url ON public.raw_event_staging (source_url);

-- RLS
ALTER TABLE public.raw_event_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for service role" ON public.raw_event_staging
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER tr_raw_event_staging_updated_at
    BEFORE UPDATE ON public.raw_event_staging
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
