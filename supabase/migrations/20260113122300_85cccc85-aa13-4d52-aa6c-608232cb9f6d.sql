-- Add RLS policies for scraper_sources to allow updates from service role and admin
-- The service role (edge functions) needs to update health tracking columns

CREATE POLICY "Service role can update scraper sources"
ON scraper_sources
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can insert scraper sources"
ON scraper_sources
FOR INSERT
WITH CHECK (true);