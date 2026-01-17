-- ============================================================================
-- Migration: Social Utility Engine V2.0
-- Purpose: Transform the product from a passive "Civic Agenda" to a "Social
--          Utility Engine" with actionable venue/event data and enrichment support
-- ============================================================================

-- ============================================================================
-- PHASE 1: Add new columns to events table for venue/event enrichment
-- ============================================================================

-- Add utility/action columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_range TEXT,
  ADD COLUMN IF NOT EXISTS long_description TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Add enrichment tracking column
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT CHECK (enrichment_source IN ('registry', 'google', 'manual', 'scraper', NULL));

-- Add column comments for documentation
COMMENT ON COLUMN events.website_url IS 'Official website URL for the venue/event';
COMMENT ON COLUMN events.ticket_url IS 'Direct URL to purchase tickets';
COMMENT ON COLUMN events.contact_phone IS 'Contact phone number, preferably E.164 format';
COMMENT ON COLUMN events.social_links IS 'JSONB object mapping platform to URL, e.g., {"instagram": "https://...", "facebook": "https://..."}';
COMMENT ON COLUMN events.price_range IS 'Price indicator like "€", "€€", "€€€" or specific range like "€10-25"';
COMMENT ON COLUMN events.long_description IS 'Extended description with more details than the short description';
COMMENT ON COLUMN events.google_place_id IS 'Google Places API place_id for linking to Google data';
COMMENT ON COLUMN events.enrichment_source IS 'Source of enrichment data: registry, google, manual, or scraper';

-- ============================================================================
-- PHASE 2: Add voting_deadline to proposals table
-- ============================================================================

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS voting_deadline TIMESTAMPTZ NULL;

COMMENT ON COLUMN proposals.voting_deadline IS 'Deadline for participants to vote on proposed times';

-- ============================================================================
-- PHASE 3: Create enrichment_failures table (DLQ for failed enrichments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  error_code TEXT,
  payload JSONB,
  attempts INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT now(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Comments for documentation
COMMENT ON TABLE enrichment_failures IS 'Dead letter queue for event enrichment failures. Used to track and retry failed enrichment attempts.';
COMMENT ON COLUMN enrichment_failures.event_id IS 'The event that failed enrichment';
COMMENT ON COLUMN enrichment_failures.payload IS 'Full payload/context of the failed enrichment for debugging';
COMMENT ON COLUMN enrichment_failures.attempts IS 'Number of enrichment attempts made';
COMMENT ON COLUMN enrichment_failures.resolved IS 'Whether the failure has been manually resolved or succeeded on retry';

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_enrichment_failures_event_id ON enrichment_failures(event_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_failures_unresolved ON enrichment_failures(resolved) WHERE resolved = FALSE;

-- ============================================================================
-- PHASE 4: Performance indexes
-- ============================================================================

-- Unique index on google_place_id where not null (for fast lookups and preventing duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_google_place_id_unique 
  ON events(google_place_id) 
  WHERE google_place_id IS NOT NULL;

-- Partial index for fixed events with start times (for optimized time-based queries)
CREATE INDEX IF NOT EXISTS idx_events_fixed_with_date 
  ON events(event_date) 
  WHERE time_mode = 'fixed' AND event_date IS NOT NULL;

-- Index on enrichment_source for tracking enrichment coverage
CREATE INDEX IF NOT EXISTS idx_events_enrichment_source ON events(enrichment_source);

-- Add index on proposals voting_deadline for finding upcoming deadlines
CREATE INDEX IF NOT EXISTS idx_proposals_voting_deadline 
  ON proposals(voting_deadline) 
  WHERE voting_deadline IS NOT NULL;

-- ============================================================================
-- PHASE 5: RLS for enrichment_failures table
-- ============================================================================

ALTER TABLE enrichment_failures ENABLE ROW LEVEL SECURITY;

-- Only service role can access enrichment failures (admin operation)
-- No public policies - this table is managed by the enrichment worker

-- Allow select for debugging purposes (authenticated users can view, not modify)
CREATE POLICY "Authenticated users can view enrichment failures"
  ON enrichment_failures FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PHASE 6: Update staged_events table to match events table structure
-- ============================================================================

ALTER TABLE staged_events
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- ============================================================================
-- MIGRATION ROLLBACK NOTES:
-- To rollback this migration, run the following:
-- 
-- ALTER TABLE events DROP COLUMN IF EXISTS website_url;
-- ALTER TABLE events DROP COLUMN IF EXISTS ticket_url;
-- ALTER TABLE events DROP COLUMN IF EXISTS contact_phone;
-- ALTER TABLE events DROP COLUMN IF EXISTS social_links;
-- ALTER TABLE events DROP COLUMN IF EXISTS price_range;
-- ALTER TABLE events DROP COLUMN IF EXISTS long_description;
-- ALTER TABLE events DROP COLUMN IF EXISTS google_place_id;
-- ALTER TABLE events DROP COLUMN IF EXISTS enrichment_source;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS voting_deadline;
-- DROP TABLE IF EXISTS enrichment_failures;
-- DROP INDEX IF EXISTS idx_events_google_place_id_unique;
-- DROP INDEX IF EXISTS idx_events_fixed_with_date;
-- DROP INDEX IF EXISTS idx_events_enrichment_source;
-- DROP INDEX IF EXISTS idx_proposals_voting_deadline;
-- ALTER TABLE staged_events DROP COLUMN IF EXISTS website_url;
-- ALTER TABLE staged_events DROP COLUMN IF EXISTS ticket_url;
-- ALTER TABLE staged_events DROP COLUMN IF EXISTS contact_phone;
-- ALTER TABLE staged_events DROP COLUMN IF EXISTS google_place_id;
-- ============================================================================
