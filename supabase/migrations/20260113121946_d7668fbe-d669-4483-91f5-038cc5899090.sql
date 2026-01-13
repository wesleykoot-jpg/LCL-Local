-- Remove duplicate scraper_sources keeping the oldest entry per URL
DELETE FROM scraper_sources a
USING scraper_sources b
WHERE a.created_at > b.created_at
  AND a.url = b.url;

-- Add health tracking columns for auto-disable functionality
ALTER TABLE scraper_sources 
ADD COLUMN IF NOT EXISTS consecutive_failures integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS auto_disabled boolean DEFAULT false;

-- Create index for faster health queries
CREATE INDEX IF NOT EXISTS idx_scraper_sources_health 
ON scraper_sources (enabled, auto_disabled, consecutive_failures);

-- Comment on columns for documentation
COMMENT ON COLUMN scraper_sources.consecutive_failures IS 'Number of consecutive scrape failures';
COMMENT ON COLUMN scraper_sources.last_error IS 'Error message from last failed scrape attempt';
COMMENT ON COLUMN scraper_sources.auto_disabled IS 'True if source was automatically disabled due to repeated failures';