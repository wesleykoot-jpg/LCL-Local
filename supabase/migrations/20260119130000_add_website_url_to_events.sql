/*
  # Add website_url to events table

  1. Changes
    - Add `website_url` column to `events` table (text, nullable)
    - Add comment explaining the column usage
*/

ALTER TABLE "events" 
ADD COLUMN IF NOT EXISTS "website_url" text;

COMMENT ON COLUMN "events"."website_url" IS 'Official website or external detail page for the event (distinct from source_url which is where we scraped it from)';
