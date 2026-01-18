-- Fix scraper source issues identified in discovery blast

-- Fix Zwolle URL (inzwolle.nl has SSL issues)
UPDATE scraper_sources
SET 
  url = 'https://visitzwolle.com/agenda',
  config = jsonb_set(config, '{domain}', '"visitzwolle.com"')
WHERE name = 'Zwolle Agenda';

-- Consolidate Meppel sources if duplicates exist (Ontdek Meppel vs Ontdek Meppel Agenda)
-- And update config to explicitly require AI parsing for location extraction
UPDATE scraper_sources
SET config = config || '{
  "ai_parsing_required": true,
  "force_detail_scraping": false
}'::jsonb
WHERE name ILIKE '%meppel%';

-- Log the changes
DO $$
BEGIN
  RAISE NOTICE 'Updated Zwolle source URL and Meppel configuration';
END $$;
