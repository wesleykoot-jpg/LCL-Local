-- Migration: 20260118000001_fix_scraper_schema_and_config.sql

-- 1. Update events table to allow new scraper categories
-- First, drop the existing restricted check constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;

-- Add new constraint with expanded categories list
-- We also allow 'active', 'music', 'entertainment' etc.
ALTER TABLE events ADD CONSTRAINT events_category_check 
CHECK (category IN (
  'cinema', 'crafts', 'sports', 'gaming', 'market', -- original
  'active', 'entertainment', 'social', 'family', 'outdoors', 'music', 'workshops', 'foodie', 'community' -- new scraper categories
));

-- 2. Update Zwolle Source Configuration
-- Updating URL to visitzwolle.com and adding specific selectors
-- Note: we use jsonb_build_object to construct the config
UPDATE scraper_sources
SET 
  url = 'https://visitzwolle.com/agenda/vandaag/',
  config = jsonb_build_object(
    'domain', 'visitzwolle.com',
    'selectors', jsonb_build_object(
      'card', 'article.agendabox',
      'date', 'time',
      'title', 'h3.title',
      'location', '.location',
      'time', 'dl.struct.proplist dd:last-child',
      'image', '.banner img',
      'link', 'a.box'
    )
  )
WHERE name = 'Zwolle Agenda';
