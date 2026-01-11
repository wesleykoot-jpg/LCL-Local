import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const schema = `
-- Enable PostGIS extension for geospatial features
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create profiles table
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

-- Create persona_stats table
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

-- Create persona_badges table
CREATE TABLE IF NOT EXISTS persona_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  persona_type text NOT NULL CHECK (persona_type IN ('family', 'gamer')),
  badge_name text NOT NULL,
  badge_level text NOT NULL,
  badge_icon text NOT NULL,
  earned_at timestamptz DEFAULT now()
);

-- Create events table with PostGIS support
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

-- Create event_attendees table
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_profile ON event_attendees(profile_id);
CREATE INDEX IF NOT EXISTS idx_persona_stats_profile ON persona_stats(profile_id);
CREATE INDEX IF NOT EXISTS idx_persona_badges_profile ON persona_badges(profile_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can view all persona stats" ON persona_stats;
  DROP POLICY IF EXISTS "Users can manage own persona stats" ON persona_stats;
  DROP POLICY IF EXISTS "Users can view all persona badges" ON persona_badges;
  DROP POLICY IF EXISTS "Users can manage own persona badges" ON persona_badges;
  DROP POLICY IF EXISTS "Anyone can view events" ON events;
  DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
  DROP POLICY IF EXISTS "Event creators can update own events" ON events;
  DROP POLICY IF EXISTS "Event creators can delete own events" ON events;
  DROP POLICY IF EXISTS "Users can view all attendees" ON event_attendees;
  DROP POLICY IF EXISTS "Users can join events" ON event_attendees;
  DROP POLICY IF EXISTS "Users can update own attendance" ON event_attendees;
  DROP POLICY IF EXISTS "Users can cancel own attendance" ON event_attendees;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- RLS Policies for profiles (PUBLIC ACCESS for demo)
CREATE POLICY "Anyone can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update profiles"
  ON profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- RLS Policies for persona_stats (PUBLIC ACCESS for demo)
CREATE POLICY "Anyone can view persona stats"
  ON persona_stats FOR SELECT
  USING (true);

CREATE POLICY "Anyone can manage persona stats"
  ON persona_stats FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for persona_badges (PUBLIC ACCESS for demo)
CREATE POLICY "Anyone can view persona badges"
  ON persona_badges FOR SELECT
  USING (true);

CREATE POLICY "Anyone can manage persona badges"
  ON persona_badges FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for events (PUBLIC ACCESS for demo)
CREATE POLICY "Anyone can view all events"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create events"
  ON events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update events"
  ON events FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete events"
  ON events FOR DELETE
  USING (true);

-- RLS Policies for event_attendees (PUBLIC ACCESS for demo)
CREATE POLICY "Anyone can view attendees"
  ON event_attendees FOR SELECT
  USING (true);

CREATE POLICY "Anyone can join events"
  ON event_attendees FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update attendance"
  ON event_attendees FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can cancel attendance"
  ON event_attendees FOR DELETE
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_persona_stats_updated_at ON persona_stats;
DROP TRIGGER IF EXISTS update_events_updated_at ON events;

-- Create triggers for updated_at
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
`;

async function setupDatabase() {
  console.log('Setting up database schema...');

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: schema });

    if (error) {
      console.error('Error setting up database:', error);

      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      console.log('Trying to execute statements one by one...');
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i] + ';';
        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({ sql: stmt }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`Warning on statement ${i + 1}:`, errorText);
        }
      }
    }

    console.log('✅ Database schema setup completed!');
  } catch (error) {
    console.error('Setup error:', error);
    process.exit(1);
  }
}

setupDatabase();
