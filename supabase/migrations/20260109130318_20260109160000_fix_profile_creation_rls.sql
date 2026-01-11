/*
  # Fix Profile Creation RLS Policy

  1. Issue
    - Profile creation was failing during signup because auth.uid() wasn't set during insert
    - Need to allow profile creation without strict user_id check during signup flow

  2. Solution
    - Keep existing policy for authenticated users updating their own profiles
    - Add new INSERT policy that allows any authenticated user to create a profile with their own user_id
    - Profile must have user_id = auth.uid() in INSERT WITH CHECK
*/

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
