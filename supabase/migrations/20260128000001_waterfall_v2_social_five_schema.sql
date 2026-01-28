-- ============================================================================
-- Migration: Waterfall Intelligence v2 - "Social Five" Data Schema
-- Description: Adds columns for the 5 key social data points required by the PRD
-- PRD Reference: Phase 1 - The "Social Five" Data Schema
-- ============================================================================

-- The "Social Five" are:
-- 1. Start Time & Doors Open - Distinguish "Doors" from "Performance Start"
-- 2. Precise Location - Venue name + full street address (Map-ready)
-- 3. Duration/End Time - For filling user itinerary gaps
-- 4. Language Profile - Auto-tag as NL, EN, or Mixed
-- 5. Interaction Mode - AI-inferred energy level

-- =============================================================================
-- 1. Doors Open Time (distinct from event start)
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS doors_open_time time DEFAULT NULL;

COMMENT ON COLUMN public.events.doors_open_time IS 
  'When doors/entry opens (distinct from event_time which is performance/activity start)';

-- =============================================================================
-- 2. Language Profile
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS language_profile text DEFAULT 'NL'
CHECK (language_profile IN ('NL', 'EN', 'Mixed', 'Other'));

COMMENT ON COLUMN public.events.language_profile IS 
  'Primary language of the event: NL (Dutch), EN (English), Mixed, Other';

-- Index for language-based filtering (expat-friendly features)
CREATE INDEX IF NOT EXISTS idx_events_language_profile
ON public.events(language_profile)
WHERE language_profile IN ('EN', 'Mixed');

-- =============================================================================
-- 3. Interaction Mode (AI-inferred social energy level)
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS interaction_mode text DEFAULT NULL
CHECK (interaction_mode IN ('high', 'medium', 'low', 'passive'));

COMMENT ON COLUMN public.events.interaction_mode IS 
  'AI-inferred social interaction level: high (workshops, networking), medium (concerts, markets), low (talks), passive (movies, exhibitions)';

-- Index for filtering by vibe
CREATE INDEX IF NOT EXISTS idx_events_interaction_mode
ON public.events(interaction_mode)
WHERE interaction_mode IS NOT NULL;

-- =============================================================================
-- 4. Structured Address (Map-ready)
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS structured_address jsonb DEFAULT NULL;

COMMENT ON COLUMN public.events.structured_address IS 
  'Structured address for map display: {street, city, postal_code, country, coordinates: {lat, lng}}';

-- GIN index for querying structured address fields
CREATE INDEX IF NOT EXISTS idx_events_structured_address
ON public.events USING gin(structured_address)
WHERE structured_address IS NOT NULL;

-- =============================================================================
-- 5. Estimated Duration (when end_time is unknown)
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer DEFAULT NULL;

COMMENT ON COLUMN public.events.estimated_duration_minutes IS 
  'Estimated duration in minutes when end_time is not explicitly provided';

-- =============================================================================
-- 6. Social Five Completeness Score
-- =============================================================================

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS social_five_score integer DEFAULT 0
CHECK (social_five_score BETWEEN 0 AND 5);

COMMENT ON COLUMN public.events.social_five_score IS 
  'Completeness score (0-5) for Social Five data: start_time, location, end_time/duration, language, interaction_mode';

-- Index for quality-based filtering
CREATE INDEX IF NOT EXISTS idx_events_social_five_score
ON public.events(social_five_score DESC)
WHERE social_five_score >= 3;

-- =============================================================================
-- 7. Persona Tags Index (enhance existing tags column)
-- =============================================================================

-- Create GIN index on existing tags column for persona filtering
CREATE INDEX IF NOT EXISTS idx_events_persona_tags 
ON public.events USING gin(tags) 
WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

-- =============================================================================
-- 8. Function to Calculate Social Five Score
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_social_five_score(
    p_event_time TEXT,
    p_venue_name TEXT,
    p_address TEXT,
    p_end_time TEXT,
    p_duration_minutes INTEGER,
    p_language_profile TEXT,
    p_interaction_mode TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_score INTEGER := 0;
BEGIN
    -- 1. Start Time
    IF p_event_time IS NOT NULL AND p_event_time != '' AND p_event_time != 'TBD' THEN
        v_score := v_score + 1;
    END IF;
    
    -- 2. Precise Location (venue + address)
    IF p_venue_name IS NOT NULL AND p_venue_name != '' AND 
       (p_address IS NOT NULL AND p_address != '') THEN
        v_score := v_score + 1;
    END IF;
    
    -- 3. End Time/Duration
    IF (p_end_time IS NOT NULL AND p_end_time != '') OR 
       (p_duration_minutes IS NOT NULL AND p_duration_minutes > 0) THEN
        v_score := v_score + 1;
    END IF;
    
    -- 4. Language Profile
    IF p_language_profile IS NOT NULL AND p_language_profile IN ('NL', 'EN', 'Mixed', 'Other') THEN
        v_score := v_score + 1;
    END IF;
    
    -- 5. Interaction Mode
    IF p_interaction_mode IS NOT NULL AND p_interaction_mode IN ('high', 'medium', 'low', 'passive') THEN
        v_score := v_score + 1;
    END IF;
    
    RETURN v_score;
END;
$$;

COMMENT ON FUNCTION public.calculate_social_five_score IS 
  'Calculates Social Five completeness score (0-5) for an event';

-- =============================================================================
-- 9. Trigger to Auto-Update Social Five Score
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_social_five_score_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.social_five_score := public.calculate_social_five_score(
        NEW.event_time,
        NEW.venue_name,
        NEW.address,
        NEW.end_time::text,
        NEW.estimated_duration_minutes,
        NEW.language_profile,
        NEW.interaction_mode
    );
    RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_update_social_five_score ON public.events;

-- Create trigger
CREATE TRIGGER trg_update_social_five_score
BEFORE INSERT OR UPDATE OF event_time, venue_name, address, end_time, 
                           estimated_duration_minutes, language_profile, interaction_mode
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_social_five_score_trigger();

-- =============================================================================
-- 10. Backfill Existing Events
-- =============================================================================

-- Set language_profile to 'NL' for all existing events (default for Netherlands)
UPDATE public.events
SET language_profile = 'NL'
WHERE language_profile IS NULL;

-- Calculate and set social_five_score for existing events
UPDATE public.events
SET social_five_score = public.calculate_social_five_score(
    event_time,
    venue_name,
    address,
    end_time::text,
    estimated_duration_minutes,
    language_profile,
    interaction_mode
)
WHERE social_five_score = 0 OR social_five_score IS NULL;

-- =============================================================================
-- 11. Enhanced raw_event_staging for Two-Pass Model
-- =============================================================================

-- Add status for AWAITING_ENRICHMENT (as per PRD)
-- The existing 'pending' status serves this purpose, but let's add explicit tracking
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT 'awaiting'
CHECK (enrichment_status IN ('awaiting', 'in_progress', 'completed', 'failed', 'skipped'));

COMMENT ON COLUMN public.raw_event_staging.enrichment_status IS 
  'Enrichment pass status: awaiting (Pass 1 complete), in_progress, completed (Pass 2 done), failed, skipped';

-- Track which "Social Five" fields are already present
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS has_start_time BOOLEAN DEFAULT FALSE;

ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS has_location BOOLEAN DEFAULT FALSE;

ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS has_end_time BOOLEAN DEFAULT FALSE;

-- =============================================================================
-- 12. Grants
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.calculate_social_five_score(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_social_five_score(TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
