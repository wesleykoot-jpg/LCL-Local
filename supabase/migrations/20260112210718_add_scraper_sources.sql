-- =====================================================
-- SCRAPER SOURCES TABLE
-- Manages sources for the AI event scraper
-- =====================================================

-- Create the scraper_sources table
CREATE TABLE IF NOT EXISTS scraper_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic source information
  name text NOT NULL,
  description text DEFAULT '',
  url text NOT NULL UNIQUE,
  
  -- Source status
  enabled boolean DEFAULT true,
  
  -- Scraping configuration (stored as JSONB for flexibility)
  -- Can include: selectors, headers, rate limits, etc.
  config jsonb DEFAULT '{}'::jsonb,
  requires_render boolean DEFAULT false,
  last_probe_urls jsonb DEFAULT '{}'::jsonb,
  language text DEFAULT 'nl-NL',
  country text DEFAULT 'NL',
  default_coordinates jsonb DEFAULT NULL,
  
  -- Quality metrics for future ranking
  quality_score numeric DEFAULT 50 CHECK (quality_score >= 0 AND quality_score <= 100),
  total_events_scraped int DEFAULT 0,
  successful_scrapes int DEFAULT 0,
  failed_scrapes int DEFAULT 0,
  
  -- Timestamps
  last_scraped_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for enabled sources lookup
CREATE INDEX IF NOT EXISTS idx_scraper_sources_enabled ON scraper_sources(enabled) WHERE enabled = true;

-- Add update trigger for updated_at
CREATE TRIGGER update_scraper_sources_updated_at
  BEFORE UPDATE ON scraper_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE scraper_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can modify, anyone can read
CREATE POLICY "Anyone can view scraper sources"
  ON scraper_sources
  FOR SELECT
  USING (true);

-- Service role has full access via SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
-- No additional policies needed for service role operations

-- =====================================================
-- SEED DATA: Add the existing source
-- =====================================================

INSERT INTO scraper_sources (name, description, url, enabled, config, requires_render, language, country, default_coordinates) 
VALUES (
  'Ontdek Meppel',
  'Official Meppel city event agenda',
  'https://ontdekmeppel.nl/ontdek-meppel/agenda/',
  true,
  '{
    "selectors": [
      "article.event-card",
      "article.agenda-item",
      "div.event-card",
      "div.agenda-item",
      ".event-item",
      ".card.event",
      "article",
      ".agenda-event"
    ],
     "headers": {
       "User-Agent": "LCL-Meppel-Scraper/1.0 (Event aggregator for local social app)",
       "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
       "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8"
     },
     "rate_limit_ms": 200,
     "discoveryAnchors": ["agenda", "ontdek", "activiteiten"],
     "alternatePaths": ["/agenda", "/agenda/"],
     "requires_render": false
   }'::jsonb,
   false,
   'nl-NL',
   'NL',
   NULL
)
ON CONFLICT (url) DO NOTHING;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to add a new scraper source
CREATE OR REPLACE FUNCTION add_scraper_source(
  p_name text,
  p_url text,
  p_description text DEFAULT '',
  p_config jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO scraper_sources (name, url, description, config)
  VALUES (p_name, p_url, p_description, p_config)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to record probe results for operators
CREATE OR REPLACE FUNCTION update_scraper_source_probe(
  p_source_id uuid,
  p_probe jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE scraper_sources
  SET last_probe_urls = p_probe,
      updated_at = now()
  WHERE id = p_source_id;
END;
$$;

-- Function to enable/disable a scraper source
CREATE OR REPLACE FUNCTION toggle_scraper_source(
  p_source_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE scraper_sources
  SET enabled = p_enabled
  WHERE id = p_source_id;
END;
$$;

-- Function to update source stats after scraping
CREATE OR REPLACE FUNCTION update_scraper_source_stats(
  p_source_id uuid,
  p_events_scraped int,
  p_success boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE scraper_sources
  SET 
    total_events_scraped = total_events_scraped + p_events_scraped,
    successful_scrapes = CASE WHEN p_success THEN successful_scrapes + 1 ELSE successful_scrapes END,
    failed_scrapes = CASE WHEN NOT p_success THEN failed_scrapes + 1 ELSE failed_scrapes END,
    last_scraped_at = now()
  WHERE id = p_source_id;
END;
$$;
