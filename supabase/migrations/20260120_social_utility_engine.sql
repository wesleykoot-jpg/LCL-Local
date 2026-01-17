-- Migration: Social Utility Engine (Temporal Modes + Enrichment)
-- Adds temporal physics, actionable metadata, enrichment tracking, and proposal voting.

-- ============================================================================
-- PHASE 0: Enums
-- ============================================================================
DO $$ BEGIN
  CREATE TYPE time_mode AS ENUM ('fixed', 'window', 'anytime');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE price_range AS ENUM ('free', '€', '€€', '€€€', '€€€€');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PHASE 1: Events table enhancements (temporal physics + metadata)
-- ============================================================================
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS end_time timestamptz,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS ticket_url text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS social_links jsonb,
  ADD COLUMN IF NOT EXISTS price_range price_range,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_retry_count integer DEFAULT 0;

COMMENT ON COLUMN events.start_time IS 'Start timestamp for fixed events (concerts, matches). Required when time_mode = fixed.';
COMMENT ON COLUMN events.end_time IS 'End timestamp for fixed events. Required when time_mode = fixed.';
COMMENT ON COLUMN events.time_mode IS 'fixed: hard start/end times. window: recurring opening hours. anytime: always available.';
COMMENT ON COLUMN events.opening_hours IS
  'Opening hours JSON structure (Option A). Example: {"always_open":false,"monday":[{"open":"09:00","close":"17:00"}],"friday":[{"open":"23:00","close":"02:00","closes_next_day":true}],"saturday":"closed"}.';
COMMENT ON COLUMN events.social_links IS
  'Social handles keyed by platform (store handles/IDs, not full URLs). Example: {"instagram":"venue","facebook":"page","tiktok":"@handle"}.';
COMMENT ON COLUMN events.google_place_id IS
  'Google Places place_id for venue deduplication and enrichment caching.';

-- ✅ CORRECT: ST_SetSRID(ST_MakePoint(4.9041, 52.3676), 4326)  -- Amsterdam
-- ❌ WRONG:    ST_SetSRID(ST_MakePoint(52.3676, 4.9041), 4326)  -- Middle of ocean!
COMMENT ON COLUMN events.location IS 'PostGIS geography(POINT, 4326) - longitude first (lng, lat).';

-- Backfill defaults for existing rows
UPDATE events
SET time_mode = COALESCE(time_mode, 'fixed');

UPDATE events
SET time_mode = CASE
  WHEN event_date IS NULL AND opening_hours IS NOT NULL THEN 'window'
  WHEN event_date IS NULL AND opening_hours IS NULL THEN 'anytime'
  ELSE time_mode
END
WHERE time_mode IS NOT NULL;

UPDATE events
SET start_time = COALESCE(start_time, event_date),
    end_time = COALESCE(end_time, event_date)
WHERE time_mode = 'fixed'
  AND event_date IS NOT NULL
  AND (start_time IS NULL OR end_time IS NULL);

ALTER TABLE events
  ALTER COLUMN time_mode SET DEFAULT 'fixed';

ALTER TABLE events
  ALTER COLUMN time_mode SET NOT NULL;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS check_fixed_event_has_date;

DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT events_time_mode_requirements CHECK (
      (time_mode = 'fixed' AND start_time IS NOT NULL AND end_time IS NOT NULL)
      OR (time_mode = 'window' AND opening_hours IS NOT NULL)
      OR (time_mode = 'anytime')
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT events_contact_phone_e164 CHECK (
      contact_phone IS NULL OR contact_phone ~ '^\\+[1-9]\\d{1,14}$'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT events_website_url_valid CHECK (
      website_url IS NULL OR website_url ~* '^https?://[^\\s]+$'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE events
    ADD CONSTRAINT events_ticket_url_valid CHECK (
      ticket_url IS NULL OR ticket_url ~* '^https?://[^\\s]+$'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Update parent_event_id FK to preserve fork events when parent is removed
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_parent_event_id_fkey;
ALTER TABLE events
  ADD CONSTRAINT events_parent_event_id_fkey
  FOREIGN KEY (parent_event_id) REFERENCES events(id) ON DELETE SET NULL;

-- ============================================================================
-- PHASE 2: Events indexes
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_google_place_id_unique
  ON events(google_place_id) WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_time_mode ON events(time_mode);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_parent_id ON events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_price_range ON events(price_range);
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_events_opening_hours ON events USING GIN (opening_hours jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_events_social_links ON events USING GIN (social_links);

-- ============================================================================
-- PHASE 3: Proposals + proposal votes (social negotiation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  venue_place_id text REFERENCES events(google_place_id),
  proposed_by uuid REFERENCES profiles(id) NOT NULL,
  proposed_time timestamptz,
  status text NOT NULL DEFAULT 'draft',
  title text,
  description text,
  participants jsonb,
  -- Legacy support for existing flows
  creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  proposed_times jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS venue_place_id text,
  ADD COLUMN IF NOT EXISTS proposed_by uuid,
  ADD COLUMN IF NOT EXISTS proposed_time timestamptz,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS participants jsonb;

ALTER TABLE proposals
  ALTER COLUMN event_id DROP NOT NULL;

UPDATE proposals
SET proposed_by = COALESCE(proposed_by, creator_id)
WHERE proposed_by IS NULL AND creator_id IS NOT NULL;

ALTER TABLE proposals
  ALTER COLUMN proposed_by SET NOT NULL;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
DO $$ BEGIN
  ALTER TABLE proposals
    ADD CONSTRAINT proposals_status_check CHECK (
      status IN ('draft', 'voting', 'confirmed', 'cancelled')
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE proposals
    ADD CONSTRAINT proposals_event_or_place_check CHECK (
      event_id IS NOT NULL OR venue_place_id IS NOT NULL
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_venue_place_id_fkey;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_venue_place_id_fkey
  FOREIGN KEY (venue_place_id) REFERENCES events(google_place_id) ON DELETE SET NULL;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_proposed_by_fkey;
ALTER TABLE proposals
  ADD CONSTRAINT proposals_proposed_by_fkey
  FOREIGN KEY (proposed_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- Ensure proposed_by mirrors legacy creator_id when inserts omit it
CREATE OR REPLACE FUNCTION set_proposed_by_from_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proposed_by IS NULL THEN
    NEW.proposed_by := NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS proposals_set_proposed_by ON proposals;
CREATE TRIGGER proposals_set_proposed_by
  BEFORE INSERT OR UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION set_proposed_by_from_creator();

-- Proposal votes
CREATE TABLE IF NOT EXISTS proposal_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  vote text NOT NULL CHECK (vote IN ('yes', 'no', 'maybe')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(proposal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_event_id ON proposals(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal ON proposal_votes(proposal_id);

-- ============================================================================
-- PHASE 4: Enrichment logs (observability)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  status text NOT NULL,
  api_calls_used int DEFAULT 0,
  error_message text,
  data_enriched jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_logs_event ON enrichment_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_status ON enrichment_logs(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_created ON enrichment_logs(created_at DESC);

-- ============================================================================
-- PHASE 5: Row Level Security (RLS)
-- ============================================================================
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Proposals are viewable by everyone" ON proposals;
  DROP POLICY IF EXISTS "Users can create proposals" ON proposals;
  DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
  DROP POLICY IF EXISTS "Users can delete own proposals" ON proposals;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

-- Proposals: public read, authenticated create/update/delete own
CREATE POLICY "Proposals are viewable by everyone"
  ON proposals FOR SELECT
  USING (true);

CREATE POLICY "Users can create proposals"
  ON proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    proposed_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own proposals"
  ON proposals FOR UPDATE
  TO authenticated
  USING (
    proposed_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    proposed_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own proposals"
  ON proposals FOR DELETE
  TO authenticated
  USING (
    proposed_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Proposal votes are viewable by authenticated users" ON proposal_votes;
  DROP POLICY IF EXISTS "Users can vote on proposals" ON proposal_votes;
  DROP POLICY IF EXISTS "Users can update own votes" ON proposal_votes;
  DROP POLICY IF EXISTS "Users can delete own votes" ON proposal_votes;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Proposal votes are viewable by authenticated users"
  ON proposal_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can vote on proposals"
  ON proposal_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own votes"
  ON proposal_votes FOR UPDATE
  TO authenticated
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own votes"
  ON proposal_votes FOR DELETE
  TO authenticated
  USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DO $$ BEGIN
  DROP POLICY IF EXISTS "Enrichment logs readable by authenticated users" ON enrichment_logs;
  DROP POLICY IF EXISTS "Service role manages enrichment logs" ON enrichment_logs;
EXCEPTION
  WHEN undefined_object THEN null;
END $$;

CREATE POLICY "Enrichment logs readable by authenticated users"
  ON enrichment_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role manages enrichment logs"
  ON enrichment_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PHASE 6: Trigger for proposals updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
