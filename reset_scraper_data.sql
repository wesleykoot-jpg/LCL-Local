
TRUNCATE TABLE events CASCADE;
TRUNCATE TABLE raw_event_staging CASCADE;
TRUNCATE TABLE scraper_insights CASCADE;
UPDATE scraper_sources SET last_payload_hash = NULL, last_scraped_at = NULL;
