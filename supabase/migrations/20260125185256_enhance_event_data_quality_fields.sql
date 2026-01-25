-- Migration: Enhance Event Data Quality Fields
-- Description: Adds additional columns to events table for improved data quality
-- and richer event information extraction from detail pages.

-- ============================================================================
-- PRICING FIELDS (structured pricing data for better display)
-- ============================================================================

-- Add structured pricing columns (complementing existing price_range TEXT)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS price TEXT,           -- Display string e.g. "€15,00", "Gratis"
  ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS price_min INTEGER,    -- Price in cents for calculations
  ADD COLUMN IF NOT EXISTS price_max INTEGER;    -- Price in cents for range support

COMMENT ON COLUMN public.events.price IS 'Human-readable price string for display (e.g., "€15,00", "Gratis", "€10 - €25")';
COMMENT ON COLUMN public.events.price_currency IS 'ISO 4217 currency code (default: EUR)';
COMMENT ON COLUMN public.events.price_min IS 'Minimum price in cents for filtering/sorting';
COMMENT ON COLUMN public.events.price_max IS 'Maximum price in cents for range-based pricing';

-- ============================================================================
-- VENUE AND ADDRESS FIELDS
-- ============================================================================

-- Add structured venue address (many venues already have venue_name)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_address TEXT;

COMMENT ON COLUMN public.events.venue_address IS 'Full venue address (street, city, postal code)';

-- ============================================================================
-- TICKETS URL FIELD (different from ticket_url which may already exist)
-- ============================================================================

-- Ensure tickets_url exists (alias column if ticket_url already exists)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS tickets_url TEXT;

COMMENT ON COLUMN public.events.tickets_url IS 'Direct URL to ticket purchase page';

-- ============================================================================
-- ORGANIZER AND PERFORMER FIELDS
-- ============================================================================

-- Organizer URL (organizer TEXT already exists from previous migration)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organizer_url TEXT;

-- Performer/artist name
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS performer TEXT;

COMMENT ON COLUMN public.events.organizer_url IS 'Website URL of the event organizer';
COMMENT ON COLUMN public.events.performer IS 'Main performer, artist, or speaker name';

-- ============================================================================
-- EVENT STATUS AND METADATA
-- ============================================================================

-- Event status for cancelled/postponed events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_status TEXT DEFAULT 'scheduled';

-- Check constraint for valid status values
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS check_event_status;
ALTER TABLE public.events
  ADD CONSTRAINT check_event_status 
  CHECK (
    event_status IS NULL 
    OR event_status IN ('scheduled', 'cancelled', 'postponed', 'rescheduled')
  );

COMMENT ON COLUMN public.events.event_status IS 'Event status: scheduled, cancelled, postponed, or rescheduled';

-- ============================================================================
-- ACCESSIBILITY AND AGE RESTRICTIONS
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS accessibility TEXT,
  ADD COLUMN IF NOT EXISTS age_restriction TEXT;

COMMENT ON COLUMN public.events.accessibility IS 'Accessibility information (e.g., wheelchair accessible)';
COMMENT ON COLUMN public.events.age_restriction IS 'Age restriction (e.g., "18+", "All ages", "12+")';

-- ============================================================================
-- DATA QUALITY TRACKING
-- ============================================================================

-- Track data source for quality analysis
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'listing';

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS check_data_source;
ALTER TABLE public.events
  ADD CONSTRAINT check_data_source 
  CHECK (
    data_source IS NULL 
    OR data_source IN ('listing', 'detail', 'hybrid', 'manual', 'api')
  );

COMMENT ON COLUMN public.events.data_source IS 'Source of event data: listing (basic), detail (enriched), hybrid, manual, or api';

-- ============================================================================
-- END DATE FOR MULTI-DAY EVENTS
-- ============================================================================

-- Note: end_time TIMESTAMPTZ already exists from social_utility_engine migration
-- Adding end_date TEXT for simpler date-only storage (YYYY-MM-DD format)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS end_date TEXT;

COMMENT ON COLUMN public.events.end_date IS 'End date for multi-day events (YYYY-MM-DD format)';

-- ============================================================================
-- INDEXES FOR NEW QUERYABLE COLUMNS
-- ============================================================================

-- Index on event_status for filtering cancelled events
CREATE INDEX IF NOT EXISTS idx_events_event_status ON public.events(event_status);

-- Index on price_min for price-based filtering
CREATE INDEX IF NOT EXISTS idx_events_price_min ON public.events(price_min) WHERE price_min IS NOT NULL;

-- Index on data_source for quality analysis queries
CREATE INDEX IF NOT EXISTS idx_events_data_source ON public.events(data_source);

-- Index on performer for artist-based searches
CREATE INDEX IF NOT EXISTS idx_events_performer ON public.events(performer) WHERE performer IS NOT NULL;

-- ============================================================================
-- ROLLBACK SCRIPT (commented out, run manually if needed)
-- ============================================================================

-- ALTER TABLE public.events DROP COLUMN IF EXISTS price;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS price_currency;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS price_min;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS price_max;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS venue_address;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS tickets_url;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS organizer_url;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS performer;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS event_status;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS accessibility;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS age_restriction;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS data_source;
-- ALTER TABLE public.events DROP COLUMN IF EXISTS end_date;
-- DROP INDEX IF EXISTS idx_events_event_status;
-- DROP INDEX IF EXISTS idx_events_price_min;
-- DROP INDEX IF EXISTS idx_events_data_source;
-- DROP INDEX IF EXISTS idx_events_performer;
