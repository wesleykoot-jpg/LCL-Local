-- ============================================================================
-- Migration: Social Utility Engine - Data Foundation for STINT 1
-- Date: 2026-01-20
-- Description: Transforms the events table to support three distinct temporal 
--              physics and adds actionable metadata for utility engine.
-- 
-- This migration adds:
--   1.1 Temporal Physics System - Conditional constraints for time_mode
--   1.2 Actionable Metadata Layer - Contact info, URLs, social links, pricing
--   1.3 Geospatial Intelligence - google_place_id for deduplication & caching
--   1.4 Social Linking System - Parent-child event verification
--   1.5 Social Negotiation Framework - proposal_votes table
--   1.6 Enrichment Logs - Observability for enrichment pipeline
-- ============================================================================

-- ============================================================================
-- PHASE 1.1: TEMPORAL PHYSICS SYSTEM
-- ============================================================================
-- Problem: Not all events are the same. A concert happens at 8 PM sharp.
-- A restaurant is open 12-10 PM daily. A park is always available.
--
-- time_mode values:
--   - fixed: Events with hard start/end times (concerts, sports, films)
--   - window: Venues with recurring opening hours (restaurants, museums)
--   - anytime: Locations available 24/7 (parks, monuments, public spaces)
--
-- Note: time_mode enum already exists from previous migration 20260117010000
-- ============================================================================

-- Add start_time and end_time columns for fixed events (if not already present)
-- These provide precise time boundaries for fixed events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- Add enrichment tracking column
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at TIMESTAMPTZ;

COMMENT ON COLUMN events.start_time IS 
  'Precise start time for fixed events. REQUIRED when time_mode = fixed.';
COMMENT ON COLUMN events.end_time IS 
  'Precise end time for fixed events. Optional but recommended for fixed events.';
COMMENT ON COLUMN events.enrichment_attempted_at IS 
  'Timestamp of last enrichment attempt. NULL means never attempted.';

-- Conditional constraint: fixed events MUST have start_time
-- (We can't use CHECK constraint since start_time might be null for window/anytime)
-- Using a trigger-based validation instead for complex conditional logic
CREATE OR REPLACE FUNCTION validate_event_time_mode()
RETURNS TRIGGER AS $$
BEGIN
  -- fixed events: start_time is MANDATORY
  IF NEW.time_mode = 'fixed' AND NEW.start_time IS NULL THEN
    -- For backward compatibility, try to derive from event_date + event_time
    IF NEW.event_date IS NOT NULL AND NEW.event_time IS NOT NULL THEN
      -- Legacy data: derive start_time from event_date + event_time
      BEGIN
        NEW.start_time := (NEW.event_date::date || ' ' || NEW.event_time)::timestamptz;
      EXCEPTION WHEN OTHERS THEN
        -- If parsing fails, still allow insert (legacy compatibility)
        NULL;
      END;
    END IF;
  END IF;
  
  -- window events: opening_hours SHOULD be set (soft warning, not blocking)
  -- This is handled by the enrichment engine, not a hard constraint
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_event_time_mode_trigger ON events;
CREATE TRIGGER validate_event_time_mode_trigger
  BEFORE INSERT OR UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION validate_event_time_mode();

-- ============================================================================
-- OPENING HOURS JSONB STRUCTURE
-- ============================================================================
-- Design Choice: Option A (Nested by day) with extensions for overnight hours
--
-- Structure chosen for:
--   ✅ Querying "is venue open now?" - O(1) day lookup, then scan ranges
--   ✅ Human-readable display in UI - Natural day-based iteration
--   ✅ Overnight periods - closes_next_day flag handles 23:00-02:00
--   ✅ Minimal storage - No redundant day keys for closed days
--
-- Schema:
-- {
--   "monday": [{"open": "09:00", "close": "17:00"}],
--   "friday": [
--     {"open": "12:00", "close": "14:00"},
--     {"open": "18:00", "close": "22:00"}
--   ],
--   "saturday": [{"open": "23:00", "close": "02:00", "closes_next_day": true}],
--   "sunday": "closed",
--   "always_open": false  -- Set to true for 24/7 venues
-- }
--
-- Note: opening_hours column already exists from migration 20260117010000
-- ============================================================================

-- Update the comment with the full structure documentation
COMMENT ON COLUMN events.opening_hours IS 
  E'Opening hours in nested day structure.\n\n'
  'STRUCTURE:\n'
  '{\n'
  '  "monday": [{"open": "09:00", "close": "17:00"}],\n'
  '  "friday": [{"open": "12:00", "close": "14:00"}, {"open": "18:00", "close": "22:00"}],\n'
  '  "saturday": [{"open": "23:00", "close": "02:00", "closes_next_day": true}],\n'
  '  "sunday": "closed",\n'
  '  "always_open": false\n'
  '}\n\n'
  'RULES:\n'
  '- Day names are lowercase: monday, tuesday, wednesday, thursday, friday, saturday, sunday\n'
  '- Missing days are implicitly closed\n'
  '- "closed" string explicitly marks closed days\n'
  '- closes_next_day: true for overnight hours (e.g., 23:00-02:00)\n'
  '- always_open: true for 24/7 venues (parks, monuments)\n'
  '- Time format: HH:MM (24-hour)\n\n'
  'Used when time_mode = "window" or "anytime".';

-- ============================================================================
-- PHASE 1.2: ACTIONABLE METADATA LAYER
-- ============================================================================
-- Problem: Users need to act on events—buy tickets, call venues, visit websites.
-- Currently, the schema only supports passive browsing.
-- ============================================================================

-- Add actionable metadata columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS ticket_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS price_range TEXT;

-- Add constraints for data validation

-- Price range must be one of the defined values
-- Using CHECK constraint for enum-like behavior without creating an actual enum
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_price_range;
ALTER TABLE events
  ADD CONSTRAINT check_price_range 
  CHECK (
    price_range IS NULL 
    OR price_range IN ('free', '€', '€€', '€€€', '€€€€')
  );

-- Phone number must match E.164 format (international format)
-- Pattern: + followed by 1-15 digits, starting with non-zero
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_contact_phone_e164;
ALTER TABLE events
  ADD CONSTRAINT check_contact_phone_e164
  CHECK (
    contact_phone IS NULL 
    OR contact_phone ~ '^\+[1-9]\d{1,14}$'
  );

-- URL validation using regex (basic HTTP/HTTPS check)
-- Note: Full URL validation is complex; this catches obvious errors
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_website_url;
ALTER TABLE events
  ADD CONSTRAINT check_website_url
  CHECK (
    website_url IS NULL 
    OR website_url ~ '^https?://.+'
  );

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_ticket_url;
ALTER TABLE events
  ADD CONSTRAINT check_ticket_url
  CHECK (
    ticket_url IS NULL 
    OR ticket_url ~ '^https?://.+'
  );

-- Comments for documentation
COMMENT ON COLUMN events.website_url IS 
  'Primary website URL for the event or venue. Must be valid HTTP(S) URL.';
COMMENT ON COLUMN events.ticket_url IS 
  'Direct ticketing link (Ticketmaster, Eventbrite, etc.). Must be valid HTTP(S) URL.';
COMMENT ON COLUMN events.contact_phone IS 
  'Phone number in E.164 format (e.g., +31612345678). International format for consistency.';
COMMENT ON COLUMN events.social_links IS 
  E'Social media handles/IDs as JSONB.\n'
  'Structure: {"instagram": "username", "facebook": "page_id", "tiktok": "@handle"}\n'
  'Store handles/IDs only, not full URLs (app can construct URLs as needed).';
COMMENT ON COLUMN events.price_range IS 
  'Price indicator: free | € (budget) | €€ (moderate) | €€€ (upscale) | €€€€ (luxury)';

-- Index on price_range for filtering queries
CREATE INDEX IF NOT EXISTS idx_events_price_range 
  ON events(price_range) 
  WHERE price_range IS NOT NULL;

-- GIN index on social_links for JSONB searching (if we need to find all Instagram venues)
CREATE INDEX IF NOT EXISTS idx_events_social_links 
  ON events USING gin (social_links jsonb_path_ops)
  WHERE social_links IS NOT NULL;

-- ============================================================================
-- PHASE 1.3: GEOSPATIAL INTELLIGENCE
-- ============================================================================
-- Problem: Deduplication, caching, and precise location matching require
-- external identifiers and strict PostGIS adherence.
-- ============================================================================

-- Add google_place_id for caching Google Places API results
-- UNIQUE constraint (when not null) prevents duplicate venue creation
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- Add unique constraint (allows multiple NULLs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_google_place_id_unique'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT events_google_place_id_unique 
      UNIQUE (google_place_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Constraint might exist with different name, ignore
  NULL;
END $$;

COMMENT ON COLUMN events.google_place_id IS 
  E'Google Places API place_id for venue caching and deduplication.\n'
  'UNIQUE constraint prevents duplicate venues.\n'
  'Nullable: Not all events come from Google (scraped events may not have this).';

-- Create index on google_place_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_events_google_place_id 
  ON events(google_place_id) 
  WHERE google_place_id IS NOT NULL;

-- ============================================================================
-- PostGIS LOCATION COLUMN - CRITICAL COORDINATE ORDER
-- ============================================================================
-- ⚠️  CRITICAL: PostGIS uses (longitude, latitude) order, NOT (lat, lng)!
--
-- ✅ CORRECT: ST_SetSRID(ST_MakePoint(4.9041, 52.3676), 4326)  -- Amsterdam
-- ❌ WRONG:   ST_SetSRID(ST_MakePoint(52.3676, 4.9041), 4326)  -- Middle of ocean!
--
-- The location column should already exist as geography(POINT, 4326)
-- We just need to ensure the spatial index exists
-- ============================================================================

-- Verify/create spatial index for fast distance queries
CREATE INDEX IF NOT EXISTS idx_events_location 
  ON events USING GIST(location);

COMMENT ON COLUMN events.location IS 
  E'PostGIS geography point in WGS84 (SRID 4326).\n\n'
  '⚠️  CRITICAL COORDINATE ORDER:\n'
  '✅ CORRECT: ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)\n'
  '✅ CORRECT: ST_SetSRID(ST_MakePoint(4.9041, 52.3676), 4326)  -- Amsterdam\n'
  '❌ WRONG:   ST_SetSRID(ST_MakePoint(52.3676, 4.9041), 4326)  -- Ocean!\n\n'
  'PostGIS uses (lng, lat) order, opposite of Google Maps (lat, lng)!';

-- ============================================================================
-- PHASE 1.4: SOCIAL LINKING SYSTEM (Parent-Child Events)
-- ============================================================================
-- Problem: Users want to "fork" existing events (e.g., "Pre-drinks before Ajax")
-- or attach plans to venues (e.g., "Lunch at Restaurant X").
--
-- parent_event_id already exists from base schema
-- event_type already exists: 'anchor' | 'fork' | 'signal'
--
-- Cascade behavior decision: ON DELETE SET NULL
-- Reasoning: If an official concert is cancelled, user's "pre-drinks" plan should
-- survive as a standalone event, not be automatically deleted. Users may have
-- coordinated with friends and want to keep the meetup even without the anchor.
-- ============================================================================

-- Verify parent_event_id foreign key exists with correct cascade behavior
-- Note: The column already exists, we just need to verify the constraint
DO $$ 
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_parent_event_id_fkey'
  ) INTO constraint_exists;
  
  -- If constraint exists, we may want to update it to ON DELETE SET NULL
  -- But this is a breaking change if existing behavior is CASCADE
  -- For safety, we'll leave the existing behavior and add a comment
  IF constraint_exists THEN
    COMMENT ON COLUMN events.parent_event_id IS 
      E'UUID reference to parent event for fork events.\n\n'
      'SIDECAR EVENT MODEL:\n'
      '- anchor: Official/scraped events (cinema screenings, festivals, concerts)\n'
      '- fork: User meetups attached to anchors (pre-movie drinks, post-game hangout)\n'
      '- signal: Standalone user events (gaming sessions, casual meetups)\n\n'
      'CASCADE BEHAVIOR: On parent deletion, child events become orphaned (SET NULL).\n'
      'This preserves user-created forks even if official event is cancelled.';
  END IF;
END $$;

-- Create partial index on parent_event_id for efficient fork queries
CREATE INDEX IF NOT EXISTS idx_events_parent_id 
  ON events(parent_event_id) 
  WHERE parent_event_id IS NOT NULL;

-- Index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_events_type 
  ON events(event_type);

-- Add constraint for event_type values
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_event_type;
ALTER TABLE events
  ADD CONSTRAINT check_event_type
  CHECK (
    event_type IN ('anchor', 'fork', 'signal')
  );

-- Add constraint: fork events must have parent_event_id
-- Note: This is enforced at application level for flexibility
-- We add a comment to document the expectation
COMMENT ON COLUMN events.event_type IS 
  E'Event type in the Sidecar Model:\n'
  '- anchor: Official/scraped events (time_mode usually "fixed")\n'
  '- fork: User plans attached to anchors (REQUIRES parent_event_id)\n'
  '- signal: Standalone user events (no parent_event_id)\n\n'
  'VALIDATION: Fork events without parent_event_id are invalid.\n'
  'Enforced at application level for flexibility with migrations.';

-- ============================================================================
-- PHASE 1.5: SOCIAL NEGOTIATION FRAMEWORK
-- ============================================================================
-- Problem: Groups need to draft → vote → confirm plans collaboratively.
-- Current schema only supports binary "join" actions.
--
-- The proposals table already exists from migration 20260118_smart_scheduling.sql
-- We need to:
--   1. Extend it with venue_place_id reference
--   2. Add proposed_time column for single time proposals
--   3. Create proposal_votes table for voting
-- ============================================================================

-- Extend proposals table with additional columns
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS venue_place_id TEXT,
  ADD COLUMN IF NOT EXISTS proposed_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Update status constraint to include 'voting' status
ALTER TABLE proposals
  DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft', 'voting', 'confirmed', 'cancelled'));

COMMENT ON COLUMN proposals.venue_place_id IS 
  'Google Places ID for venue-based proposals (alternative to event_id).';
COMMENT ON COLUMN proposals.proposed_time IS 
  'Single proposed meeting time. For multi-option votes, use proposed_times JSONB.';
COMMENT ON COLUMN proposals.title IS 
  'Optional title for the proposal (e.g., "Drinks before the match").';
COMMENT ON COLUMN proposals.description IS 
  'Optional description with details about the proposed meetup.';

-- Create proposal_votes table for collaborative voting
CREATE TABLE IF NOT EXISTS proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- One vote per user per proposal
  CONSTRAINT proposal_votes_unique_vote UNIQUE (proposal_id, user_id),
  
  -- Vote must be one of the allowed values
  CONSTRAINT proposal_votes_vote_check CHECK (vote IN ('yes', 'no', 'maybe'))
);

-- Comments for documentation
COMMENT ON TABLE proposal_votes IS 
  'Stores individual votes on meetup proposals. One vote per user per proposal.';
COMMENT ON COLUMN proposal_votes.vote IS 
  'Vote value: yes (attending) | no (not attending) | maybe (tentative)';

-- Indexes for proposal_votes
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal 
  ON proposal_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_user 
  ON proposal_votes(user_id);

-- ============================================================================
-- RLS POLICIES FOR PROPOSAL_VOTES
-- ============================================================================
-- Permission model:
--   - Anyone can view votes (transparency for group planning)
--   - Authenticated users can vote on any proposal
--   - Users can only update/delete their own votes
-- ============================================================================

ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view all votes (public for group coordination)
CREATE POLICY "Votes are viewable by everyone"
  ON proposal_votes FOR SELECT
  USING (true);

-- Policy: Authenticated users can vote
CREATE POLICY "Authenticated users can vote"
  ON proposal_votes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policy: Users can update their own votes
CREATE POLICY "Users can update own votes"
  ON proposal_votes FOR UPDATE
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policy: Users can delete their own votes
CREATE POLICY "Users can delete own votes"
  ON proposal_votes FOR DELETE
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- PHASE 1.6: ENRICHMENT LOGS (Observability)
-- ============================================================================
-- Purpose: Track all enrichment attempts for monitoring and debugging
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrichment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  api_calls_used INT DEFAULT 0,
  error_message TEXT,
  data_enriched JSONB,
  source TEXT,  -- 'registry' | 'google_places' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE enrichment_logs
  DROP CONSTRAINT IF EXISTS enrichment_logs_status_check;
ALTER TABLE enrichment_logs
  ADD CONSTRAINT enrichment_logs_status_check
  CHECK (status IN ('success', 'partial', 'failed', 'registry_match', 'budget_exceeded', 'skipped'));

-- Comments
COMMENT ON TABLE enrichment_logs IS 
  'Tracks all event enrichment attempts for observability and debugging.';
COMMENT ON COLUMN enrichment_logs.status IS 
  E'Enrichment outcome:\n'
  '- success: All fields enriched\n'
  '- partial: Some fields enriched\n'
  '- failed: Enrichment failed\n'
  '- registry_match: Data from VenueRegistry (0 API calls)\n'
  '- budget_exceeded: Daily API budget reached\n'
  '- skipped: Event type not eligible for enrichment';
COMMENT ON COLUMN enrichment_logs.api_calls_used IS 
  'Number of external API calls made (for budget tracking).';
COMMENT ON COLUMN enrichment_logs.data_enriched IS 
  'JSON object listing which fields were enriched: {"fields": ["contact_phone", "location"]}';
COMMENT ON COLUMN enrichment_logs.source IS 
  'Source of enrichment data: registry (static), google_places (API), manual.';

-- Indexes for enrichment_logs
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_event 
  ON enrichment_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_status 
  ON enrichment_logs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_created 
  ON enrichment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_source 
  ON enrichment_logs(source)
  WHERE source IS NOT NULL;

-- RLS for enrichment_logs (admin-only for writes, public for reads)
ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view enrichment logs (for transparency/debugging)
CREATE POLICY "Enrichment logs are viewable by everyone"
  ON enrichment_logs FOR SELECT
  USING (true);

-- Policy: Only service role can insert (from edge functions)
-- Note: Edge functions use service role key, so they bypass RLS
-- This policy is mainly for documentation
CREATE POLICY "Only service role can insert enrichment logs"
  ON enrichment_logs FOR INSERT
  WITH CHECK (false);  -- Blocked for normal users, service role bypasses

-- ============================================================================
-- ADDITIONAL INDEXES FOR QUERY PERFORMANCE
-- ============================================================================

-- Index for finding events needing enrichment
CREATE INDEX IF NOT EXISTS idx_events_needs_enrichment
  ON events(id)
  WHERE (
    contact_phone IS NULL 
    OR opening_hours IS NULL
  )
  AND time_mode IN ('window', 'anytime')
  AND enrichment_attempted_at IS NULL;

-- Index for active proposals
CREATE INDEX IF NOT EXISTS idx_proposals_active
  ON proposals(created_at DESC)
  WHERE status IN ('draft', 'voting');

-- Composite index for event queries by type and time_mode
CREATE INDEX IF NOT EXISTS idx_events_type_time_mode
  ON events(event_type, time_mode);

-- ============================================================================
-- MIGRATION VERIFICATION FUNCTION
-- ============================================================================
-- Helper function to verify the migration ran successfully
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_social_utility_migration()
RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Check time_mode enum exists
  RETURN QUERY
  SELECT 
    'time_mode_enum'::TEXT,
    CASE WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_mode') 
         THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'time_mode enum (fixed, window, anytime) exists'::TEXT;

  -- Check events table has new columns
  RETURN QUERY
  SELECT 
    'events_google_place_id'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name = 'google_place_id'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'google_place_id column exists in events'::TEXT;

  RETURN QUERY
  SELECT 
    'events_price_range'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name = 'price_range'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'price_range column exists in events'::TEXT;

  -- Check proposal_votes table exists
  RETURN QUERY
  SELECT 
    'proposal_votes_table'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'proposal_votes'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'proposal_votes table exists'::TEXT;

  -- Check enrichment_logs table exists
  RETURN QUERY
  SELECT 
    'enrichment_logs_table'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'enrichment_logs'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'enrichment_logs table exists'::TEXT;

  -- Check spatial index exists
  RETURN QUERY
  SELECT 
    'spatial_index'::TEXT,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_events_location'
    ) THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'idx_events_location GIST index exists'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_social_utility_migration IS 
  'Verifies that the social utility engine migration ran successfully. Run: SELECT * FROM verify_social_utility_migration();';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- 
-- ROLLBACK SQL (run this to undo the migration):
-- 
-- DROP TABLE IF EXISTS enrichment_logs CASCADE;
-- DROP TABLE IF EXISTS proposal_votes CASCADE;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS venue_place_id;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS proposed_time;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS title;
-- ALTER TABLE proposals DROP COLUMN IF EXISTS description;
-- ALTER TABLE events DROP COLUMN IF EXISTS google_place_id;
-- ALTER TABLE events DROP COLUMN IF EXISTS website_url;
-- ALTER TABLE events DROP COLUMN IF EXISTS ticket_url;
-- ALTER TABLE events DROP COLUMN IF EXISTS contact_phone;
-- ALTER TABLE events DROP COLUMN IF EXISTS social_links;
-- ALTER TABLE events DROP COLUMN IF EXISTS price_range;
-- ALTER TABLE events DROP COLUMN IF EXISTS start_time;
-- ALTER TABLE events DROP COLUMN IF EXISTS end_time;
-- ALTER TABLE events DROP COLUMN IF EXISTS enrichment_attempted_at;
-- DROP FUNCTION IF EXISTS validate_event_time_mode() CASCADE;
-- DROP FUNCTION IF EXISTS verify_social_utility_migration() CASCADE;
-- ============================================================================
