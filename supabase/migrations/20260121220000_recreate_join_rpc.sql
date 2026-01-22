/*
  # Re-Add Atomic Event Join RPC
  
  (Re-applying logic from 20260109120000 because it was missing in remote DB)

  1. Changes
    - Create join_event_atomic RPC function for atomic, idempotent join
    - Function enforces capacity constraints and prevents duplicates
    - Returns clear status: 'ok', 'exists', 'full', or 'error'
    - Uses FOR UPDATE lock for concurrency safety

  2. Features
    - Atomic transaction at DB level
    - Capacity checking (max_attendees)
    - Unique constraint prevents duplicates
    - Clear return codes for client-side UX
*/

-- Drop existing function if present
DROP FUNCTION IF EXISTS join_event_atomic(uuid, uuid, text);

-- Create atomic join event RPC function
CREATE OR REPLACE FUNCTION join_event_atomic(
  p_event_id uuid,
  p_profile_id uuid,
  p_status text DEFAULT 'going'
)
RETURNS jsonb AS $$
DECLARE
  v_max_attendees int;
  v_current_count int;
  v_exists boolean;
  v_result jsonb;
BEGIN
  -- Check if already attending (UNIQUE constraint will catch duplicate inserts)
  SELECT EXISTS(
    SELECT 1 FROM event_attendees 
    WHERE event_id = p_event_id AND profile_id = p_profile_id
  ) INTO v_exists;

  IF v_exists THEN
    RETURN jsonb_build_object(
      'status', 'exists',
      'message', 'User is already attending this event'
    );
  END IF;

  -- Get event capacity and current attendee count with FOR UPDATE lock
  SELECT e.max_attendees, COUNT(ea.id)::int
  INTO v_max_attendees, v_current_count
  FROM events e
  LEFT JOIN event_attendees ea ON e.id = ea.event_id
  WHERE e.id = p_event_id
  GROUP BY e.id, e.max_attendees
  FOR UPDATE OF e;

  -- Check if event exists
  IF v_max_attendees IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Event not found'
    );
  END IF;

  -- Check capacity
  IF v_max_attendees IS NOT NULL AND v_current_count >= v_max_attendees THEN
    RETURN jsonb_build_object(
      'status', 'full',
      'message', 'Event is at capacity',
      'current_count', v_current_count,
      'max_attendees', v_max_attendees
    );
  END IF;

  -- Insert attendance record
  INSERT INTO event_attendees (event_id, profile_id, status, joined_at)
  VALUES (p_event_id, p_profile_id, p_status, now())
  ON CONFLICT (event_id, profile_id) DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'ok',
    'message', 'Successfully joined event',
    'event_id', p_event_id,
    'profile_id', p_profile_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'status', 'error',
    'message', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure UNIQUE constraint exists on event_attendees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'event_attendees_event_id_profile_id_key'
    AND conrelid = 'event_attendees'::regclass
  ) THEN
    ALTER TABLE event_attendees
    ADD CONSTRAINT event_attendees_event_id_profile_id_key
    UNIQUE (event_id, profile_id);
  END IF;
END $$;

-- Create covering index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_attendees_lookup
ON event_attendees (event_id, profile_id)
INCLUDE (status, joined_at);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION join_event_atomic(uuid, uuid, text) TO authenticated, anon;
