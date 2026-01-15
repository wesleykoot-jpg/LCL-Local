-- Delete duplicate sources, keeping only the first occurrence
DELETE FROM scraper_sources
WHERE id NOT IN (
  SELECT DISTINCT ON (url) id
  FROM scraper_sources
  ORDER BY url, created_at ASC
);

-- Add unique constraint on URL
ALTER TABLE scraper_sources
ADD CONSTRAINT scraper_sources_url_unique UNIQUE (url);