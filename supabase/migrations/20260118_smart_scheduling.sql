-- Migration: Smart Scheduling - Proposals Table and Enhanced Time Intelligence
-- This migration adds the proposals table for venue meetup planning and additional indexes

-- ============================================================================
-- PHASE 1: Create proposals table
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  proposed_times JSONB NOT NULL, -- Array of ISO datetime strings or date ranges
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments for documentation
COMMENT ON TABLE proposals IS 'Stores meetup proposals for venues (window/anytime events). Users propose times to meet at a venue.';
COMMENT ON COLUMN proposals.event_id IS 'The venue/event this proposal is for (parent event with time_mode = window or anytime)';
COMMENT ON COLUMN proposals.creator_id IS 'The user who created the proposal';
COMMENT ON COLUMN proposals.status IS 'Proposal status: draft (pending), confirmed (accepted), cancelled';
COMMENT ON COLUMN proposals.proposed_times IS 'JSON array of proposed meeting times, e.g., ["2026-02-14T12:30:00Z", "2026-02-14T18:00:00Z"]';

-- ============================================================================
-- PHASE 2: Indexes for proposals table
-- ============================================================================

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_proposals_event_id ON proposals(event_id);

-- Index for fast lookup by creator
CREATE INDEX IF NOT EXISTS idx_proposals_creator_id ON proposals(creator_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status) WHERE status = 'draft';

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_proposals_event_status ON proposals(event_id, status);

-- ============================================================================
-- PHASE 3: Additional indexes for events table (if not exists)
-- ============================================================================

-- GIN index on opening_hours for JSONB queries
-- COMMENTED OUT: Column opening_hours doesn't exist yet in events table
-- CREATE INDEX IF NOT EXISTS idx_events_opening_hours ON events USING gin (opening_hours jsonb_path_ops);

-- Index on time_mode for filtering (if not already exists)
-- Already created in previous migration, but ensure it exists
-- COMMENTED OUT: Column time_mode doesn't exist yet in events table
-- CREATE INDEX IF NOT EXISTS idx_events_time_mode ON events(time_mode);

-- ============================================================================
-- PHASE 4: Row-Level Security for proposals
-- ============================================================================

-- Enable RLS on proposals table
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read proposals (for discovering meetups)
DROP POLICY IF EXISTS "Proposals are viewable by everyone" ON proposals;
CREATE POLICY "Proposals are viewable by everyone"
  ON proposals FOR SELECT
  USING (true);

-- Policy: Users can create proposals if they are authenticated
DROP POLICY IF EXISTS "Users can create proposals" ON proposals;
CREATE POLICY "Users can create proposals"
  ON proposals FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policy: Users can update their own proposals
DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
CREATE POLICY "Users can update own proposals"
  ON proposals FOR UPDATE
  USING (
    creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Policy: Users can delete their own proposals
DROP POLICY IF EXISTS "Users can delete own proposals" ON proposals;
CREATE POLICY "Users can delete own proposals"
  ON proposals FOR DELETE
  USING (
    creator_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ============================================================================
-- PHASE 5: Trigger for updated_at timestamp
-- ============================================================================

-- Create or replace the trigger function (may already exist from other tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for proposals table
DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
