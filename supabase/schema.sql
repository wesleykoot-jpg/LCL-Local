-- =====================================================
-- LCL (Hyper-Local Social App) - Complete Database Schema
-- =====================================================
--
-- INSTALLATION INSTRUCTIONS:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to the SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
--
-- This will create all tables, indexes, RLS policies, and seed data
-- =====================================================

-- Enable PostGIS extension for geospatial features
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- TABLE DEFINITIONS
-- =====================================================

-- Profiles table: User profiles with reliability scores
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  location_city text DEFAULT '',
  location_country text DEFAULT '',
  location_coordinates geography(POINT, 4326),
  avatar_url text,
  reliability_score numeric DEFAULT 100 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  events_attended int DEFAULT 0,
  events_committed int DEFAULT 0,
  current_persona text DEFAULT 'family' CHECK (current_persona IN ('family', 'gamer')),
  verified_resident boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Persona stats: Per-persona statistics
CREATE TABLE IF NOT EXISTS persona_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  persona_type text NOT NULL CHECK (persona_type IN ('family', 'gamer')),
  rallies_hosted int DEFAULT 0,
  newcomers_welcomed int DEFAULT 0,
  host_rating numeric DEFAULT 0.0 CHECK (host_rating >= 0 AND host_rating <= 5.0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, persona_type)
);

-- Persona badges: Badges earned by users
CREATE TABLE IF NOT EXISTS persona_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  persona_type text NOT NULL CHECK (persona_type IN ('family', 'gamer')),
  badge_name text NOT NULL,
  badge_level text NOT NULL,
  badge_icon text NOT NULL,
  earned_at timestamptz DEFAULT now()
);

-- Events table: All events (anchors, forks, signals)
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL CHECK (category IN ('cinema', 'crafts', 'sports', 'gaming', 'market')),
  event_type text NOT NULL CHECK (event_type IN ('anchor', 'fork', 'signal')),
  parent_event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  venue_name text NOT NULL,
  location geography(POINT, 4326) NOT NULL,
  event_date timestamptz NOT NULL,
  event_time text NOT NULL,
  status text DEFAULT '',
  image_url text,
  match_percentage int DEFAULT 0 CHECK (match_percentage >= 0 AND match_percentage <= 100),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Event attendees: Many-to-many relationship
CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'going' CHECK (status IN ('going', 'interested', 'cancelled')),
  ticket_number text,
  checked_in boolean DEFAULT false,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(event_id, profile_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_profile ON event_attendees(profile_id);
CREATE INDEX IF NOT EXISTS idx_persona_stats_profile ON persona_stats(profile_id);
CREATE INDEX IF NOT EXISTS idx_persona_badges_profile ON persona_badges(profile_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
  DROP POLICY IF EXISTS "public_insert_profiles" ON profiles;
  DROP POLICY IF EXISTS "public_update_profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated users can create profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

  DROP POLICY IF EXISTS "public_read_persona_stats" ON persona_stats;
  DROP POLICY IF EXISTS "public_manage_persona_stats" ON persona_stats;
  DROP POLICY IF EXISTS "Authenticated users can view all persona stats" ON persona_stats;
  DROP POLICY IF EXISTS "Anyone can view persona stats" ON persona_stats;
  DROP POLICY IF EXISTS "Users can create own persona stats" ON persona_stats;
  DROP POLICY IF EXISTS "Users can update own persona stats" ON persona_stats;
  DROP POLICY IF EXISTS "Users can delete own persona stats" ON persona_stats;

  DROP POLICY IF EXISTS "public_read_persona_badges" ON persona_badges;
  DROP POLICY IF EXISTS "public_manage_persona_badges" ON persona_badges;
  DROP POLICY IF EXISTS "Authenticated users can view all persona badges" ON persona_badges;
  DROP POLICY IF EXISTS "Anyone can view persona badges" ON persona_badges;
  DROP POLICY IF EXISTS "Users can create own persona badges" ON persona_badges;
  DROP POLICY IF EXISTS "Users can update own persona badges" ON persona_badges;
  DROP POLICY IF EXISTS "Users can delete own persona badges" ON persona_badges;

  DROP POLICY IF EXISTS "public_read_events" ON events;
  DROP POLICY IF EXISTS "public_create_events" ON events;
  DROP POLICY IF EXISTS "public_update_events" ON events;
  DROP POLICY IF EXISTS "public_delete_events" ON events;
  DROP POLICY IF EXISTS "Authenticated users can view all events" ON events;
  DROP POLICY IF EXISTS "Anyone can view events" ON events;
  DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
  DROP POLICY IF EXISTS "Event creators can update own events" ON events;
  DROP POLICY IF EXISTS "Event creators can delete own events" ON events;

  DROP POLICY IF EXISTS "public_read_attendees" ON event_attendees;
  DROP POLICY IF EXISTS "public_join_events" ON event_attendees;
  DROP POLICY IF EXISTS "public_update_attendance" ON event_attendees;
  DROP POLICY IF EXISTS "public_cancel_attendance" ON event_attendees;
  DROP POLICY IF EXISTS "Authenticated users can view all attendees" ON event_attendees;
  DROP POLICY IF EXISTS "Anyone can view attendees" ON event_attendees;
  DROP POLICY IF EXISTS "Authenticated users can join events" ON event_attendees;
  DROP POLICY IF EXISTS "Users can update own attendance" ON event_attendees;
  DROP POLICY IF EXISTS "Users can cancel own attendance" ON event_attendees;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- =====================================================
-- PROFILES TABLE - SECURE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view profiles"
  ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- =====================================================
-- PERSONA STATS TABLE - SECURE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view persona stats"
  ON persona_stats
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create own persona stats"
  ON persona_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own persona stats"
  ON persona_stats
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own persona stats"
  ON persona_stats
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- =====================================================
-- PERSONA BADGES TABLE - SECURE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view persona badges"
  ON persona_badges
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create own persona badges"
  ON persona_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own persona badges"
  ON persona_badges
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own persona badges"
  ON persona_badges
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- =====================================================
-- EVENTS TABLE - SECURE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view events"
  ON events
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Event creators can update own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Event creators can delete own events"
  ON events
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- =====================================================
-- EVENT ATTENDEES TABLE - SECURE POLICIES
-- =====================================================

CREATE POLICY "Anyone can view attendees"
  ON event_attendees
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can join events"
  ON event_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own attendance"
  ON event_attendees
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can cancel own attendance"
  ON event_attendees
  FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_persona_stats_updated_at ON persona_stats;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_persona_stats_updated_at
  BEFORE UPDATE ON persona_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Create sample profile
DO $$
DECLARE
  v_profile_id uuid := gen_random_uuid();
  v_event1_id uuid := gen_random_uuid();
  v_event2_id uuid := gen_random_uuid();
  v_event3_id uuid := gen_random_uuid();
BEGIN
  -- Check if data already exists
  IF NOT EXISTS (SELECT 1 FROM profiles LIMIT 1) THEN

    -- Insert profile
    INSERT INTO profiles (
      id, full_name, location_city, location_country,
      location_coordinates, reliability_score, events_attended,
      events_committed, current_persona, verified_resident
    ) VALUES (
      v_profile_id, 'Alex van Berg', 'Meppel', 'NL',
      ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
      96, 48, 50, 'family', true
    );

    -- Insert persona stats
    INSERT INTO persona_stats (profile_id, persona_type, rallies_hosted, newcomers_welcomed, host_rating)
    VALUES
      (v_profile_id, 'family', 8, 15, 4.9),
      (v_profile_id, 'gamer', 12, 8, 4.8);

    -- Insert family badges
    INSERT INTO persona_badges (profile_id, persona_type, badge_name, badge_level, badge_icon)
    VALUES
      (v_profile_id, 'family', 'Safe Host', 'Verified', 'Shield'),
      (v_profile_id, 'family', 'Parent Pro', 'Level 3', 'Users'),
      (v_profile_id, 'family', 'Coffee Regular', '12 meetups', '☕');

    -- Insert gamer badges
    INSERT INTO persona_badges (profile_id, persona_type, badge_name, badge_level, badge_icon)
    VALUES
      (v_profile_id, 'gamer', 'BF6 Veteran', 'Rank 47', 'Trophy'),
      (v_profile_id, 'gamer', 'Night Owl', 'Active 20:00-02:00', '🦉'),
      (v_profile_id, 'gamer', 'Squad Leader', '23 wins', 'Star');

    -- Insert anchor events
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES
      (
        v_event1_id, 'Avatar: Fire & Ash 3D', 'The epic conclusion to the Avatar saga',
        'cinema', 'anchor', 'Luxor Cinema Meppel',
        ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
        now() + interval '2 days', 'This Weekend • 19:30 & 21:45',
        'Tickets Available', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000',
        98, v_profile_id
      ),
      (
        v_event2_id, 'Painting Workshop with Sylvia', 'Learn watercolor techniques',
        'crafts', 'anchor', 'Reestkerk',
        ST_SetSRID(ST_MakePoint(6.195, 52.705), 4326)::geography,
        now() + interval '1 day', 'Tomorrow • 14:00',
        '3 spots left', NULL, 92, v_profile_id
      ),
      (
        v_event3_id, 'Alcides vs. Marum', 'Local football match',
        'sports', 'anchor', 'Sportpark Ezinge',
        ST_SetSRID(ST_MakePoint(6.21, 52.695), 4326)::geography,
        '2026-01-17 15:00:00'::timestamptz, 'Jan 17 • 15:00',
        'Match Day', NULL, 85, v_profile_id
      );

    -- Insert sidecar events
    INSERT INTO events (
      title, description, category, event_type, parent_event_id,
      venue_name, location, event_date, event_time, status, created_by
    ) VALUES
      (
        'Parents Night Out - Drinks at De Beurs', 'Pre-movie drinks for parents',
        'cinema', 'fork', v_event1_id, 'De Beurs',
        ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
        now() + interval '2 days', '19:00 Before Movie',
        'Join us!', v_profile_id
      ),
      (
        'Post-Match Drinks', 'Celebrate at the clubhouse',
        'sports', 'fork', v_event3_id, 'Clubhouse',
        ST_SetSRID(ST_MakePoint(6.21, 52.695), 4326)::geography,
        '2026-01-17 17:00:00'::timestamptz, 'After Game',
        '', v_profile_id
      );

    -- Insert signal events
    INSERT INTO events (
      title, description, category, event_type, venue_name,
      location, event_date, event_time, status, created_by
    ) VALUES
      (
        'Battlefield 6 Friday', 'Gaming squad meetup',
        'gaming', 'signal', 'Online • Meppel Area',
        ST_SetSRID(ST_MakePoint(6.19, 52.71), 4326)::geography,
        now() + interval '4 days', 'Friday • 20:00',
        'Lobby Open', v_profile_id
      ),
      (
        'Hot & Toasty Sing-Along', 'Music and drinks night',
        'market', 'signal', 'De Plataan',
        ST_SetSRID(ST_MakePoint(6.203, 52.698), 4326)::geography,
        now(), 'Tonight', 'Starting Soon', v_profile_id
      );

    -- Add attendees to events
    INSERT INTO event_attendees (event_id, profile_id, status, ticket_number)
    SELECT id, v_profile_id, 'going',
           '#' || substring(md5(random()::text) from 1 for 6)
    FROM events
    WHERE event_type IN ('anchor', 'signal')
    LIMIT 3;

  END IF;
END $$;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================
-- Your LCL database is now ready!
-- The app will automatically fetch and display this data.
