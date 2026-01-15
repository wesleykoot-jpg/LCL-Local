-- Fix missing coordinates for existing sources and add more Dutch event sources
-- This ensures events appear correctly in location-based feeds

-- Update Meppel source with correct coordinates
UPDATE scraper_sources
SET 
  default_coordinates = '{"lat": 52.6957, "lng": 6.1944}'::jsonb,
  location_name = 'Meppel'
WHERE url = 'https://ontdekmeppel.nl/ontdek-meppel/agenda/';

-- Add more verified Dutch event sources with coordinates
-- These are high-quality, official municipal event pages

-- Amsterdam
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Amsterdam Uitagenda',
  'https://www.iamsterdam.com/nl/zien-en-doen/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.3676, "lng": 4.9041}'::jsonb,
  'Amsterdam',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Rotterdam
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Rotterdam Uitagenda',
  'https://www.uitagendarotterdam.nl',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.9225, "lng": 4.4792}'::jsonb,
  'Rotterdam',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Utrecht
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Utrecht Agenda',
  'https://www.visit-utrecht.com/nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.0907, "lng": 5.1214}'::jsonb,
  'Utrecht',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Den Haag
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Den Haag Agenda',
  'https://www.denhaag.com/nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.0705, "lng": 4.3007}'::jsonb,
  'Den Haag',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Eindhoven
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Eindhoven Agenda',
  'https://www.thisiseindhoven.com/nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.4416, "lng": 5.4697}'::jsonb,
  'Eindhoven',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Groningen
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Groningen Uitagenda',
  'https://uit.groningen.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 53.2194, "lng": 6.5665}'::jsonb,
  'Groningen',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Tilburg
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Tilburg Agenda',
  'https://www.tilburg.com/ontdekken/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.5555, "lng": 5.0913}'::jsonb,
  'Tilburg',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Breda
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Breda Uitagenda',
  'https://www.bredauitagenda.nl',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.5719, "lng": 4.7683}'::jsonb,
  'Breda',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Nijmegen
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Nijmegen Agenda',
  'https://www.visitnijmegen.com/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.8126, "lng": 5.8372}'::jsonb,
  'Nijmegen',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Arnhem
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Arnhem Agenda',
  'https://www.bezoekarnhem.com/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.9851, "lng": 5.8987}'::jsonb,
  'Arnhem',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Leiden
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Leiden Agenda',
  'https://www.visitleiden.nl/nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.1601, "lng": 4.4970}'::jsonb,
  'Leiden',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Delft
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Delft Agenda',
  'https://www.indelft.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.0116, "lng": 4.3571}'::jsonb,
  'Delft',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Maastricht
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Maastricht Agenda',
  'https://www.visitmaastricht.com/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 50.8514, "lng": 5.6910}'::jsonb,
  'Maastricht',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Zwolle
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Zwolle Agenda',
  'https://www.inzwolle.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.5168, "lng": 6.0830}'::jsonb,
  'Zwolle',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Leeuwarden
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Leeuwarden Agenda',
  'https://www.visitleeuwarden.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 53.2012, "lng": 5.7999}'::jsonb,
  'Leeuwarden',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Dordrecht
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Dordrecht Agenda',
  'https://www.vvvdordrecht.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.8133, "lng": 4.6901}'::jsonb,
  'Dordrecht',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Amersfoort
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Amersfoort Agenda',
  'https://www.visitamersfoort.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.1561, "lng": 5.3878}'::jsonb,
  'Amersfoort',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- 's-Hertogenbosch (Den Bosch)
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Den Bosch Agenda',
  'https://www.bezoekdenbosch.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 51.6978, "lng": 5.3037}'::jsonb,
  's-Hertogenbosch',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Haarlem
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Haarlem Agenda',
  'https://www.visithaarlem.com/nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.3874, "lng": 4.6462}'::jsonb,
  'Haarlem',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Apeldoorn
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Apeldoorn Agenda',
  'https://www.visitapeldoorn.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.2112, "lng": 5.9699}'::jsonb,
  'Apeldoorn',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Enschede
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Enschede Uitagenda',
  'https://www.uitinenschede.nl',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.2215, "lng": 6.8937}'::jsonb,
  'Enschede',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Almere
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Almere Agenda',
  'https://www.visitalmere.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.3508, "lng": 5.2647}'::jsonb,
  'Almere',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Deventer
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Deventer Uitagenda',
  'https://www.deventeruitagenda.nl',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.2500, "lng": 6.1640}'::jsonb,
  'Deventer',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Assen
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Assen Agenda',
  'https://www.assen.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.9925, "lng": 6.5649}'::jsonb,
  'Assen',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Hoogeveen
INSERT INTO scraper_sources (name, url, enabled, language, country, default_coordinates, location_name, config)
VALUES (
  'Hoogeveen Agenda',
  'https://www.hoogeveen.nl/agenda',
  true,
  'nl-NL',
  'NL',
  '{"lat": 52.7236, "lng": 6.4756}'::jsonb,
  'Hoogeveen',
  '{
    "selectors": ["article.event", ".event-item", ".event-card", "[class*=''event'']", "[class*=''agenda'']"],
    "headers": {"User-Agent": "LCL-EventScraper/1.0", "Accept-Language": "nl-NL,nl;q=0.9"},
    "rate_limit_ms": 200
  }'::jsonb
)
ON CONFLICT (url) DO UPDATE SET 
  default_coordinates = EXCLUDED.default_coordinates,
  location_name = EXCLUDED.location_name;

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Added/updated 25 Dutch event sources with proper coordinates';
END $$;
