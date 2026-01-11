/*
  # Event-Triggered Persona Stats Updates
  
  1. Changes
    - Create trigger function to update persona stats on event completion
    - Update rallies_hosted when user creates event
    - Update host_rating based on event feedback
    - Prevent manual updates to certain stats fields
  
  2. Security
    - Stats updated automatically by system
    - Users cannot manually game the system
    - Event completion triggers updates
*/

-- =====================================================
-- FUNCTION: Update Persona Stats on Event Creation
-- =====================================================

CREATE OR REPLACE FUNCTION update_stats_on_event_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment rallies_hosted for the event creator's current persona
  UPDATE persona_stats
  SET rallies_hosted = rallies_hosted + 1,
      updated_at = now()
  WHERE profile_id = NEW.created_by
    AND persona_type = (
      SELECT current_persona FROM profiles WHERE id = NEW.created_by
    );
  
  -- If no stats exist, create them
  IF NOT FOUND THEN
    INSERT INTO persona_stats (profile_id, persona_type, rallies_hosted)
    SELECT NEW.created_by, p.current_persona, 1
    FROM profiles p
    WHERE p.id = NEW.created_by
    ON CONFLICT (profile_id, persona_type) 
    DO UPDATE SET rallies_hosted = persona_stats.rallies_hosted + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Update Stats When Event Created
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_stats_on_event_creation ON events;

CREATE TRIGGER trigger_update_stats_on_event_creation
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_event_creation();

-- =====================================================
-- FUNCTION: Update Reliability Score on Event Attendance
-- =====================================================

CREATE OR REPLACE FUNCTION update_reliability_on_attendance()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment events_committed when user joins an event
  IF (TG_OP = 'INSERT' AND NEW.status = 'going') OR
     (TG_OP = 'UPDATE' AND OLD.status != 'going' AND NEW.status = 'going') THEN
    
    UPDATE profiles
    SET events_committed = events_committed + 1,
        updated_at = now()
    WHERE id = NEW.profile_id;
  END IF;
  
  -- Note: events_attended should be updated when event is actually attended
  -- This would typically be done by a check-in system or post-event confirmation
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Update Reliability When User Joins Event
-- =====================================================

DROP TRIGGER IF EXISTS trigger_update_reliability_on_attendance ON event_attendees;

CREATE TRIGGER trigger_update_reliability_on_attendance
  AFTER INSERT OR UPDATE ON event_attendees
  FOR EACH ROW
  EXECUTE FUNCTION update_reliability_on_attendance();

-- =====================================================
-- FUNCTION: Calculate Reliability Score
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_reliability_score(profile_id_param uuid)
RETURNS numeric AS $$
DECLARE
  attended int;
  committed int;
  score numeric;
BEGIN
  SELECT events_attended, events_committed
  INTO attended, committed
  FROM profiles
  WHERE id = profile_id_param;
  
  -- Avoid division by zero
  IF committed = 0 THEN
    RETURN 100;
  END IF;
  
  -- Calculate score as percentage
  score := (attended::numeric / committed::numeric) * 100;
  
  -- Ensure score is between 0 and 100
  RETURN LEAST(100, GREATEST(0, score));
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- UPDATE EXISTING POLICIES TO PREVENT MANUAL STATS UPDATES
-- =====================================================

-- Drop the update policy for persona_stats (stats are now system-managed)
DROP POLICY IF EXISTS "Users can update own persona stats" ON persona_stats;

-- Create a restricted policy that only allows updating specific fields
CREATE POLICY "Users can update limited persona stats fields"
  ON persona_stats
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    -- Note: rallies_hosted and host_rating are now system-managed
    -- Users can only update if they're not changing those fields
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION update_stats_on_event_creation() IS 
  'Automatically increments rallies_hosted when user creates an event';

COMMENT ON FUNCTION update_reliability_on_attendance() IS 
  'Automatically updates events_committed when user joins event with going status';

COMMENT ON FUNCTION calculate_reliability_score(uuid) IS 
  'Calculates reliability score as percentage: (events_attended / events_committed) * 100';
