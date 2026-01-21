-- ============================================================================
-- Migration: Language-Agnostic Category System
-- Created: 2026-01-21
-- Purpose: Transform category system from lowercase language-specific strings
--          to uppercase language-agnostic keys with separate localization layer
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
-- STEP 2: Add new category_key column to events table
-- ============================================================================
ALTER TABLE public.events 
  ADD COLUMN category_key scraper.event_category_key;

COMMENT ON COLUMN public.events.category_key IS 
  'Uppercase language-agnostic category key. Localized at display layer.';

-- ============================================================================
-- STEP 3: Migrate existing lowercase category data to uppercase keys
-- ============================================================================
UPDATE public.events SET category_key = 
  CASE 
    -- Direct mappings
    WHEN LOWER(category) = 'music' THEN 'MUSIC'::scraper.event_category_key
    WHEN LOWER(category) = 'active' THEN 'ACTIVE'::scraper.event_category_key
    WHEN LOWER(category) = 'social' THEN 'SOCIAL'::scraper.event_category_key
    WHEN LOWER(category) = 'family' THEN 'FAMILY'::scraper.event_category_key
    WHEN LOWER(category) = 'foodie' THEN 'FOOD'::scraper.event_category_key
    
    -- Consolidations into CULTURE
    WHEN LOWER(category) IN ('entertainment', 'gaming', 'workshops', 'arts', 'cinema', 'theater', 'theatre') 
      THEN 'CULTURE'::scraper.event_category_key
    
    -- Consolidations into ACTIVE
    WHEN LOWER(category) IN ('outdoors', 'sports', 'wellness', 'fitness') 
      THEN 'ACTIVE'::scraper.event_category_key
    
    -- Legacy mappings
    WHEN LOWER(category) IN ('nightlife', 'club', 'party') 
      THEN 'NIGHTLIFE'::scraper.event_category_key
    WHEN LOWER(category) IN ('market', 'crafts') 
      THEN 'FOOD'::scraper.event_category_key
    
    -- Fallback to COMMUNITY for unknown/null values
    ELSE 'COMMUNITY'::scraper.event_category_key
  END
WHERE category_key IS NULL;

-- ============================================================================
-- STEP 4: Make category_key required with default fallback
-- ============================================================================
ALTER TABLE public.events 
  ALTER COLUMN category_key SET NOT NULL,
  ALTER COLUMN category_key SET DEFAULT 'COMMUNITY'::scraper.event_category_key;

-- ============================================================================
-- STEP 5: Add index for query performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_events_category_key 
  ON public.events(category_key);

COMMENT ON INDEX idx_events_category_key IS 
  'Supports fast filtering by category in event queries and feeds';

-- ============================================================================
-- STEP 6: Update scraper.sources table with default category support
-- ============================================================================
ALTER TABLE scraper.sources 
  ADD COLUMN IF NOT EXISTS default_category_key scraper.event_category_key DEFAULT 'COMMUNITY';

COMMENT ON COLUMN scraper.sources.default_category_key IS 
  'Default category key for events from this source. ' ||
  'Used as fallback when automatic categorization is uncertain. ' ||
  'Example: A jazz venue would use MUSIC as default.';

-- ============================================================================
-- STEP 7: Verification query (run manually after migration)
-- ============================================================================
-- Uncomment to verify migration results:
-- 
-- SELECT 
--   category_key, 
--   COUNT(*) as event_count,
--   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
-- FROM public.events
-- GROUP BY category_key
-- ORDER BY event_count DESC;

-- ============================================================================
-- STEP 8: Prepare for cleanup (run after 7 days of validation)
-- ============================================================================
-- After validating the migration in production, drop the old category column:
--
-- ALTER TABLE public.events DROP COLUMN IF EXISTS category;
-- 
-- IMPORTANT: Only execute this after:
-- 1. All Edge Functions are updated to use category_key
-- 2. Frontend is deployed with new localization layer
-- 3. 7+ days of successful operation with new system
