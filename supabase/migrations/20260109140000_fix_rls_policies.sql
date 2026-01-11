/*
  # Fix RLS Policies - Critical Security Fix
  
  1. Changes
    - Fix all RLS policies to use user_id instead of id
    - Remove anonymous access policies (keep public read as requested)
    - Implement verified-only event creation
    - Add waitlist support for event capacity
  
  2. Security
    - Policies now correctly check user_id = auth.uid()
    - Event creation restricted to verified residents
    - Profile updates/deletes properly scoped to user
*/

-- =====================================================
-- DROP OLD BROKEN POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Allow read access for development" ON profiles;

DROP POLICY IF EXISTS "Users can create own persona stats" ON persona_stats;
DROP POLICY IF EXISTS "Users can update own persona stats" ON persona_stats;
DROP POLICY IF EXISTS "Users can delete own persona stats" ON persona_stats;

DROP POLICY IF EXISTS "Users can create own persona badges" ON persona_badges;
DROP POLICY IF EXISTS "Users can update own persona badges" ON persona_badges;
DROP POLICY IF EXISTS "Users can delete own persona badges" ON persona_badges;

DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Event creators can update own events" ON events;
DROP POLICY IF EXISTS "Event creators can delete own events" ON events;

DROP POLICY IF EXISTS "Authenticated users can join events" ON event_attendees;
DROP POLICY IF EXISTS "Users can update own attendance" ON event_attendees;
DROP POLICY IF EXISTS "Users can cancel own attendance" ON event_attendees;

-- =====================================================
-- PROFILES TABLE - FIXED POLICIES
-- =====================================================

-- Anyone can view profiles (public as per user request)
-- Existing "Anyone can view profiles" policy remains

-- Authenticated users can create profiles (no change needed)
-- Existing "Authenticated users can create profiles" policy remains

-- FIXED: Users can update own profile using user_id
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- FIXED: Users can delete own profile using user_id
CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- PERSONA STATS TABLE - FIXED POLICIES
-- =====================================================

-- Anyone can view persona stats (public)
-- Existing "Anyone can view persona stats" policy remains

-- FIXED: Users can create own persona stats
CREATE POLICY "Users can create own persona stats"
  ON persona_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- FIXED: Users can update own persona stats
CREATE POLICY "Users can update own persona stats"
  ON persona_stats
  FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- FIXED: Users can delete own persona stats
CREATE POLICY "Users can delete own persona stats"
  ON persona_stats
  FOR DELETE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- =====================================================
-- PERSONA BADGES TABLE - FIXED POLICIES
-- =====================================================

-- Anyone can view persona badges (public)
-- Existing "Anyone can view persona badges" policy remains

-- FIXED: Users can create own persona badges
CREATE POLICY "Users can create own persona badges"
  ON persona_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- FIXED: Users can update own persona badges
CREATE POLICY "Users can update own persona badges"
  ON persona_badges
  FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- FIXED: Users can delete own persona badges
CREATE POLICY "Users can delete own persona badges"
  ON persona_badges
  FOR DELETE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- =====================================================
-- EVENTS TABLE - FIXED POLICIES WITH VERIFIED-ONLY
-- =====================================================

-- Anyone can view events (public)
-- Existing "Anyone can view events" policy remains

-- NEW: Only verified residents can create events
CREATE POLICY "Verified residents can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IN (
      SELECT id FROM profiles 
      WHERE user_id = auth.uid() 
      AND verified_resident = true
    )
  );

-- FIXED: Event creators can update own events
CREATE POLICY "Event creators can update own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- FIXED: Event creators can delete own events
CREATE POLICY "Event creators can delete own events"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- EVENT ATTENDEES TABLE - FIXED POLICIES WITH WAITLIST
-- =====================================================

-- Anyone can view attendees (public)
-- Existing "Anyone can view attendees" policy remains

-- FIXED: Authenticated users can join events (including waitlist)
CREATE POLICY "Authenticated users can join events"
  ON event_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- FIXED: Users can update own attendance (for waitlist → going)
CREATE POLICY "Users can update own attendance"
  ON event_attendees
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
  );

-- FIXED: Users can cancel own attendance
CREATE POLICY "Users can cancel own attendance"
  ON event_attendees
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- =====================================================
-- ADD WAITLIST SUPPORT TO EVENT_ATTENDEES
-- =====================================================

-- Update status constraint to include 'waitlist'
ALTER TABLE event_attendees 
  DROP CONSTRAINT IF EXISTS event_attendees_status_check;

ALTER TABLE event_attendees
  ADD CONSTRAINT event_attendees_status_check 
  CHECK (status IN ('going', 'interested', 'cancelled', 'waitlist'));

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON POLICY "Users can update own profile" ON profiles IS 
  'Fixed: Uses user_id instead of id to match auth.uid()';

COMMENT ON POLICY "Verified residents can create events" ON events IS 
  'Only users with verified_resident = true can create events';

COMMENT ON TABLE event_attendees IS 
  'Supports waitlist status for capacity management';
