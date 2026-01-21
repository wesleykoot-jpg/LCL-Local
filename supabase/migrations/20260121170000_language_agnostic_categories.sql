-- ============================================================================
-- Migration: Language-Agnostic Category System (Simplified)
-- Created: 2026-01-21
-- Purpose: Keep 'category' column name, just change values to uppercase
-- ============================================================================

-- ============================================================================
-- STEP 1: Create the neutral enum type with 9 uppercase category keys
-- ============================================================================
CREATE TYPE scraper.event_category_key AS ENUM (
  'MUSIC',      -- Concerts, festivals, live music
  'SOCIAL',     -- Networking, meetups, drinks (borrel, vrijmibo)
  'ACTIVE',     -- Sports, fitness, yoga, hiking
  'CULTURE',    -- Theater, museums, exhibitions, cinema, gaming, workshops
  'FOOD',       -- Dining, tastings, culinary events, markets
  'NIGHTLIFE',  -- Clubs, parties, late-night events
  'FAMILY',     -- Kids activities, family-friendly events
  'CIVIC',      -- Political, municipal, civic engagement
  'COMMUNITY'   -- General community events, fallback category
);

COMMENT ON TYPE scraper.event_category_key IS 
  'Language-agnostic category keys for event classification. ' ||
  'Display labels (Dutch/English) are handled in application layer. ' ||
  'See src/shared/lib/localization.ts for translations.';

-- ============================================================================
-- STEP 2: Update existing category column to use enum and uppercase values
-- ============================================================================

-- First, update all category values to uppercase equivalents
UPDATE public.events SET category = 
  CASE 
    -- Direct mappings
    WHEN LOWER(category) = 'music' THEN 'MUSIC'
    WHEN LOWER(category) = 'active' THEN 'ACTIVE'
    WHEN LOWER(category) = 'social' THEN 'SOCIAL'
    WHEN LOWER(category) = 'family' THEN 'FAMILY'
    WHEN LOWER(category) = 'foodie' THEN 'FOOD'
    
    -- Consolidations into CULTURE
    WHEN LOWER(category) IN ('entertainment', 'gaming', 'workshops', 'arts', 'cinema', 'theater', 'theatre') 
      THEN 'CULTURE'
    
    -- Consolidations into ACTIVE
    WHEN LOWER(category) IN ('outdoors', 'sports', 'wellness', 'fitness') 
      THEN 'ACTIVE'
    
    -- Legacy mappings
    WHEN LOWER(category) IN ('nightlife', 'club', 'party') 
      THEN 'NIGHTLIFE'
    WHEN LOWER(category) IN ('market', 'crafts', 'food') 
      THEN 'FOOD'
    
    -- Fallback to COMMUNITY for unknown/null values
    ELSE 'COMMUNITY'
  END
WHERE category IS NOT NULL;

-- Set NULL categories to COMMUNITY
UPDATE public.events SET category = 'COMMUNITY' WHERE category IS NULL;

-- Now change the column type to the enum (PostgreSQL will validate all values)
ALTER TABLE public.events 
  ALTER COLUMN category TYPE scraper.event_category_key 
  USING category::scraper.event_category_key;

-- Make sure it's NOT NULL with default
ALTER TABLE public.events 
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'COMMUNITY'::scraper.event_category_key;

-- ============================================================================
-- STEP 3: Add index for query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_events_category 
  ON public.events(category);

COMMENT ON INDEX idx_events_category IS 
  'Supports fast filtering by category in event queries and feeds';

-- ============================================================================
-- STEP 4: Update scraper.sources table with default category support
-- ============================================================================
ALTER TABLE scraper.sources 
  ADD COLUMN IF NOT EXISTS default_category scraper.event_category_key DEFAULT 'COMMUNITY';

COMMENT ON COLUMN scraper.sources.default_category IS 
  'Default category key for events from this source. ' ||
  'Used as fallback when automatic categorization is uncertain. ' ||
  'Example: A jazz venue would use MUSIC as default.';

-- ============================================================================
-- STEP 5: Update comment on category column
-- ============================================================================
COMMENT ON COLUMN public.events.category IS 
  'Event category using language-agnostic uppercase keys (e.g., MUSIC, ACTIVE). ' ||
  'Display labels are localized in the frontend (Muziek/Music). ' ||
  'See scraper.event_category_key enum for valid values.';

-- ============================================================================
-- Verification query (run manually after migration)
-- ============================================================================
-- 
-- SELECT 
--   category, 
--   COUNT(*) as event_count,
--   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
-- FROM public.events
-- GROUP BY category
-- ORDER BY event_count DESC;
