-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS scraper;

-- Create staging table for ELT pipeline
CREATE TABLE IF NOT EXISTS scraper.raw_event_staging (
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

-- Index for fast batch fetching
CREATE INDEX IF NOT EXISTS idx_raw_staging_status ON scraper.raw_event_staging(status);
CREATE INDEX IF NOT EXISTS idx_raw_staging_source_id ON scraper.raw_event_staging(source_id);

-- Add simple trigger for updated_at
CREATE OR REPLACE FUNCTION scraper.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_raw_event_staging_modtime ON scraper.raw_event_staging;

CREATE TRIGGER update_raw_event_staging_modtime
    BEFORE UPDATE ON scraper.raw_event_staging
    FOR EACH ROW
    EXECUTE PROCEDURE scraper.update_updated_at_column();

-- Enable RLS and policies (Assuming service role usage mostly, but good practice)
ALTER TABLE scraper.raw_event_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for service role" ON scraper.raw_event_staging;

CREATE POLICY "Enable read access for service role" ON scraper.raw_event_staging
    FOR ALL
    USING ( auth.role() = 'service_role' );

-- Grant usage to authenticated/service_role
GRANT USAGE ON SCHEMA scraper TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA scraper TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA scraper TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA scraper TO postgres, anon, authenticated, service_role;
