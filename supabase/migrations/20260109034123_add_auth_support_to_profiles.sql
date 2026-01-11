/*
  # Add Authentication Support to Profiles

  1. Schema Changes
    - Add user_id column to profiles table (references auth.users, nullable for existing data)
    - Add profile_complete boolean flag to track onboarding status
    - Add unique constraint on user_id to enforce one profile per user

  2. Security Changes
    - Enable Row Level Security on profiles table
    - Add policies for authenticated users to manage their profiles
    - Allow reading all profiles for social features (temporary for development)
*/

-- Add user_id column to link profiles to auth.users (nullable for existing profiles)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add profile_complete flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'profile_complete'
  ) THEN
    ALTER TABLE profiles ADD COLUMN profile_complete boolean DEFAULT false;
  END IF;
END $$;

-- Add unique constraint on user_id (only for non-null values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
  ) THEN
    CREATE UNIQUE INDEX profiles_user_id_key ON profiles(user_id) WHERE user_id IS NOT NULL;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Allow read access for development" ON profiles;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Allow authenticated users to read all profiles (for social features and development)
CREATE POLICY "Authenticated users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow anonymous read access for development/testing
CREATE POLICY "Allow read access for development"
  ON profiles
  FOR SELECT
  TO anon
  USING (true);
