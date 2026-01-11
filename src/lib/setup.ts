import { supabase } from '@/integrations/supabase/client';

export async function setupDatabase() {
  console.log('🚀 Setting up LCL database schema...');

  const sqlStatements = [
    `CREATE EXTENSION IF NOT EXISTS postgis`,

    `CREATE TABLE IF NOT EXISTS profiles (
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
    )`,

    `CREATE TABLE IF NOT EXISTS persona_stats (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      persona_type text NOT NULL CHECK (persona_type IN ('family', 'gamer')),
      rallies_hosted int DEFAULT 0,
      newcomers_welcomed int DEFAULT 0,
      host_rating numeric DEFAULT 0.0 CHECK (host_rating >= 0 AND host_rating <= 5.0),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(profile_id, persona_type)
    )`,

    `CREATE TABLE IF NOT EXISTS persona_badges (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      persona_type text NOT NULL CHECK (persona_type IN ('family', 'gamer')),
      badge_name text NOT NULL,
      badge_level text NOT NULL,
      badge_icon text NOT NULL,
      earned_at timestamptz DEFAULT now()
    )`,

    `CREATE TABLE IF NOT EXISTS events (
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
    )`,

    `CREATE TABLE IF NOT EXISTS event_attendees (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      status text DEFAULT 'going' CHECK (status IN ('going', 'interested', 'cancelled')),
      ticket_number text,
      checked_in boolean DEFAULT false,
      joined_at timestamptz DEFAULT now(),
      UNIQUE(event_id, profile_id)
    )`,

    `CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST(location)`,
    `CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id) WHERE parent_event_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)`,
    `CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type)`,
    `CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_event_attendees_profile ON event_attendees(profile_id)`,
    `CREATE INDEX IF NOT EXISTS idx_persona_stats_profile ON persona_stats(profile_id)`,
    `CREATE INDEX IF NOT EXISTS idx_persona_badges_profile ON persona_badges(profile_id)`,

    `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE persona_stats ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE persona_badges ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE events ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY`,
  ];

  const policies = [
    `DROP POLICY IF EXISTS "public_read_profiles" ON profiles`,
    `CREATE POLICY "public_read_profiles" ON profiles FOR SELECT USING (true)`,
    `DROP POLICY IF EXISTS "public_insert_profiles" ON profiles`,
    `CREATE POLICY "public_insert_profiles" ON profiles FOR INSERT WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "public_update_profiles" ON profiles`,
    `CREATE POLICY "public_update_profiles" ON profiles FOR UPDATE USING (true)`,

    `DROP POLICY IF EXISTS "public_read_persona_stats" ON persona_stats`,
    `CREATE POLICY "public_read_persona_stats" ON persona_stats FOR SELECT USING (true)`,
    `DROP POLICY IF EXISTS "public_manage_persona_stats" ON persona_stats`,
    `CREATE POLICY "public_manage_persona_stats" ON persona_stats FOR ALL USING (true)`,

    `DROP POLICY IF EXISTS "public_read_persona_badges" ON persona_badges`,
    `CREATE POLICY "public_read_persona_badges" ON persona_badges FOR SELECT USING (true)`,
    `DROP POLICY IF EXISTS "public_manage_persona_badges" ON persona_badges`,
    `CREATE POLICY "public_manage_persona_badges" ON persona_badges FOR ALL USING (true)`,

    `DROP POLICY IF EXISTS "public_read_events" ON events`,
    `CREATE POLICY "public_read_events" ON events FOR SELECT USING (true)`,
    `DROP POLICY IF EXISTS "public_create_events" ON events`,
    `CREATE POLICY "public_create_events" ON events FOR INSERT WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "public_update_events" ON events`,
    `CREATE POLICY "public_update_events" ON events FOR UPDATE USING (true)`,
    `DROP POLICY IF EXISTS "public_delete_events" ON events`,
    `CREATE POLICY "public_delete_events" ON events FOR DELETE USING (true)`,

    `DROP POLICY IF EXISTS "public_read_attendees" ON event_attendees`,
    `CREATE POLICY "public_read_attendees" ON event_attendees FOR SELECT USING (true)`,
    `DROP POLICY IF EXISTS "public_join_events" ON event_attendees`,
    `CREATE POLICY "public_join_events" ON event_attendees FOR INSERT WITH CHECK (true)`,
    `DROP POLICY IF EXISTS "public_update_attendance" ON event_attendees`,
    `CREATE POLICY "public_update_attendance" ON event_attendees FOR UPDATE USING (true)`,
    `DROP POLICY IF EXISTS "public_cancel_attendance" ON event_attendees`,
    `CREATE POLICY "public_cancel_attendance" ON event_attendees FOR DELETE USING (true)`,
  ];

  for (const sql of sqlStatements) {
    try {
      const { error } = await supabase.rpc('exec', { sql });
      if (error) console.warn(`Warning:`, error.message);
    } catch (e: unknown) {
      console.warn(`Warning:`, e instanceof Error ? e.message : 'Unknown error');
    }
  }

  for (const sql of policies) {
    try {
      const { error } = await supabase.rpc('exec', { sql });
      if (error) console.warn(`Policy warning:`, error.message);
    } catch (e: unknown) {
      console.warn(`Policy warning:`, e instanceof Error ? e.message : 'Unknown error');
    }
  }

  console.log('✅ Database schema setup complete!');
}

export async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');

  const profileId = crypto.randomUUID();

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existingProfile) {
    console.log('✅ Database already seeded!');
    return;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: profileId,
      full_name: 'Alex van Berg',
      location_city: 'Meppel',
      location_country: 'NL',
      location_coordinates: 'POINT(6.2 52.7)',
      reliability_score: 96,
      events_attended: 48,
      events_committed: 50,
      current_persona: 'family',
      verified_resident: true,
    });

  if (profileError) {
    console.error('Error creating profile:', profileError);
    return;
  }

  await supabase
    .from('persona_stats')
    .insert({
      profile_id: profileId,
      persona_type: 'family',
      rallies_hosted: 8,
      newcomers_welcomed: 15,
      host_rating: 4.9,
    });

  await supabase
    .from('persona_stats')
    .insert({
      profile_id: profileId,
      persona_type: 'gamer',
      rallies_hosted: 12,
      newcomers_welcomed: 8,
      host_rating: 4.8,
    });

  const familyBadges = [
    { badge_name: 'Safe Host', badge_level: 'Verified', badge_icon: 'Shield' },
    { badge_name: 'Parent Pro', badge_level: 'Level 3', badge_icon: 'Users' },
    { badge_name: 'Coffee Regular', badge_level: '12 meetups', badge_icon: '☕' },
  ];

  const gamerBadges = [
    { badge_name: 'BF6 Veteran', badge_level: 'Rank 47', badge_icon: 'Trophy' },
    { badge_name: 'Night Owl', badge_level: 'Active 20:00-02:00', badge_icon: '🦉' },
    { badge_name: 'Squad Leader', badge_level: '23 wins', badge_icon: 'Star' },
  ];

  for (const badge of familyBadges) {
    await supabase.from('persona_badges').insert({
      profile_id: profileId,
      persona_type: 'family',
      ...badge,
    });
  }

  for (const badge of gamerBadges) {
    await supabase.from('persona_badges').insert({
      profile_id: profileId,
      persona_type: 'gamer',
      ...badge,
    });
  }

  const anchorEvent1 = crypto.randomUUID();
  const anchorEvent2 = crypto.randomUUID();
  const anchorEvent3 = crypto.randomUUID();

  const events = [
    {
      id: anchorEvent1,
      title: 'Avatar: Fire & Ash 3D',
      description: 'The epic conclusion to the Avatar saga',
      category: 'cinema',
      event_type: 'anchor',
      venue_name: 'Luxor Cinema Meppel',
      location: 'POINT(6.2 52.7)',
      event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      event_time: 'This Weekend • 19:30 & 21:45',
      status: 'Tickets Available',
      image_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000',
      match_percentage: 98,
      created_by: profileId,
    },
    {
      id: anchorEvent2,
      title: 'Painting Workshop with Sylvia',
      description: 'Learn watercolor techniques',
      category: 'crafts',
      event_type: 'anchor',
      venue_name: 'Reestkerk',
      location: 'POINT(6.195 52.705)',
      event_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      event_time: 'Tomorrow • 14:00',
      status: '3 spots left',
      match_percentage: 92,
      created_by: profileId,
    },
    {
      id: anchorEvent3,
      title: 'Alcides vs. Marum',
      description: 'Local football match',
      category: 'sports',
      event_type: 'anchor',
      venue_name: 'Sportpark Ezinge',
      location: 'POINT(6.21 52.695)',
      event_date: new Date('2026-01-17T15:00:00').toISOString(),
      event_time: 'Jan 17 • 15:00',
      status: 'Match Day',
      match_percentage: 85,
      created_by: profileId,
    },
    {
      title: 'Parents Night Out - Drinks at De Beurs',
      description: 'Pre-movie drinks for parents',
      category: 'cinema',
      event_type: 'fork',
      parent_event_id: anchorEvent1,
      venue_name: 'De Beurs',
      location: 'POINT(6.2 52.7)',
      event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      event_time: '19:00 Before Movie',
      status: 'Join us!',
      created_by: profileId,
    },
    {
      title: 'Post-Match Drinks',
      description: 'Celebrate at the clubhouse',
      category: 'sports',
      event_type: 'fork',
      parent_event_id: anchorEvent3,
      venue_name: 'Clubhouse',
      location: 'POINT(6.21 52.695)',
      event_date: new Date('2026-01-17T17:00:00').toISOString(),
      event_time: 'After Game',
      created_by: profileId,
    },
    {
      title: 'Battlefield 6 Friday',
      description: 'Gaming squad meetup',
      category: 'gaming',
      event_type: 'signal',
      venue_name: 'Online • Meppel Area',
      location: 'POINT(6.19 52.71)',
      event_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      event_time: 'Friday • 20:00',
      status: 'Lobby Open',
      created_by: profileId,
    },
    {
      title: 'Hot & Toasty Sing-Along',
      description: 'Music and drinks night',
      category: 'market',
      event_type: 'signal',
      venue_name: 'De Plataan',
      location: 'POINT(6.203 52.698)',
      event_date: new Date().toISOString(),
      event_time: 'Tonight',
      status: 'Starting Soon',
      created_by: profileId,
    },
  ];

  for (const event of events) {
    const { error: eventError, data: eventData } = await supabase
      .from('events')
      .insert(event)
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      continue;
    }

    if (event.event_type !== 'fork') {
      await supabase.from('event_attendees').insert({
        event_id: eventData.id,
        profile_id: profileId,
        status: 'going',
        ticket_number: `#${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      });
    }
  }

  console.log('✅ Database seeded successfully!');
}
