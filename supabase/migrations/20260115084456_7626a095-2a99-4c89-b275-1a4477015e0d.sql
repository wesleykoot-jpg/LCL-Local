-- Add missing columns to scraper_sources table for source discovery
ALTER TABLE scraper_sources
ADD COLUMN IF NOT EXISTS auto_discovered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS requires_render BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl-NL',
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'NL',
ADD COLUMN IF NOT EXISTS default_coordinates JSONB,
ADD COLUMN IF NOT EXISTS location_name TEXT;