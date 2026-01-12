-- Fix RLS policies for event_attendees to properly link profile_id to auth.uid() via profiles table

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can join events" ON event_attendees;
DROP POLICY IF EXISTS "Users can update own attendance" ON event_attendees;
DROP POLICY IF EXISTS "Users can cancel own attendance" ON event_attendees;

-- Create INSERT policy: Allow if profile belongs to authenticated user
CREATE POLICY "Authenticated users can join events"
ON event_attendees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create UPDATE policy: Allow if profile belongs to authenticated user
CREATE POLICY "Users can update own attendance"
ON event_attendees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = profile_id 
    AND profiles.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = profile_id 
    AND profiles.user_id = auth.uid()
  )
);

-- Create DELETE policy: Allow if profile belongs to authenticated user
CREATE POLICY "Users can cancel own attendance"
ON event_attendees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = profile_id 
    AND profiles.user_id = auth.uid()
  )
);