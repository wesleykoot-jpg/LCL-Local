-- Fix test profile UUID mismatch
-- This ensures the Alex van Berg profile and test events have expected UUIDs

DO $$
DECLARE
  v_existing_profile_id uuid;
  v_target_profile_id uuid := 'de595401-5c4f-40fc-8d3a-a627e49780ff';
  v_event1_id uuid := 'adb96d9e-60f5-49f0-a855-61ace082fc45';
  v_event2_id uuid := '2a9aefb0-82a5-42b1-b715-819f48b5d362';
  v_event3_id uuid := '5dd99a4a-9e15-4ac6-aa8b-89bed8fb7ec3';
  v_event4_id uuid := 'bbd9adcf-158e-49ae-b237-43a396ebeee8';
  v_event5_id uuid := '71b39cff-d9a8-4f22-885d-5c2244f6f9c5';
BEGIN
  -- Check if the target profile already exists
  SELECT id INTO v_existing_profile_id 
  FROM profiles 
  WHERE id = v_target_profile_id;

  -- If target profile doesn't exist, we need to create or migrate it
  IF v_existing_profile_id IS NULL THEN
    -- Check if there's an "Alex van Berg" profile with a different ID
    SELECT id INTO v_existing_profile_id 
    FROM profiles 
    WHERE full_name = 'Alex van Berg' 
    LIMIT 1;

    IF v_existing_profile_id IS NOT NULL THEN
      -- Update the existing profile to use the target UUID
      -- First, we need to handle foreign key constraints
      
      -- Temporarily update event_attendees to point to new ID
      UPDATE event_attendees 
      SET profile_id = v_target_profile_id 
      WHERE profile_id = v_existing_profile_id;
      
      -- Update persona_stats
      UPDATE persona_stats 
      SET profile_id = v_target_profile_id 
      WHERE profile_id = v_existing_profile_id;
      
      -- Update persona_badges
      UPDATE persona_badges 
      SET profile_id = v_target_profile_id 
      WHERE profile_id = v_existing_profile_id;
      
      -- Update events created_by
      UPDATE events 
      SET created_by = v_target_profile_id 
      WHERE created_by = v_existing_profile_id;
      
      -- Update the profile ID itself
      UPDATE profiles 
      SET id = v_target_profile_id 
      WHERE id = v_existing_profile_id;
      
      RAISE NOTICE 'Migrated existing Alex van Berg profile from % to %', v_existing_profile_id, v_target_profile_id;
    ELSE
      -- Create the profile with the target UUID
      INSERT INTO profiles (
        id, full_name, location_city, location_country,
        location_coordinates, reliability_score, events_attended,
        events_committed, current_persona, verified_resident
      ) VALUES (
        v_target_profile_id, 'Alex van Berg', 'Meppel', 'NL',
        ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
        96, 48, 50, 'family', true
      );
      
      -- Insert persona stats
      INSERT INTO persona_stats (profile_id, persona_type, rallies_hosted, newcomers_welcomed, host_rating)
      VALUES
        (v_target_profile_id, 'family', 8, 15, 4.9),
        (v_target_profile_id, 'gamer', 12, 8, 4.8);

      -- Insert family badges
      INSERT INTO persona_badges (profile_id, persona_type, badge_name, badge_level, badge_icon)
      VALUES
        (v_target_profile_id, 'family', 'Safe Host', 'Verified', 'Shield'),
        (v_target_profile_id, 'family', 'Parent Pro', 'Level 3', 'Users'),
        (v_target_profile_id, 'family', 'Community Leader', 'Gold', 'Star');
      
      RAISE NOTICE 'Created Alex van Berg profile with UUID %', v_target_profile_id;
    END IF;
  ELSE
    RAISE NOTICE 'Alex van Berg profile already exists with correct UUID %', v_target_profile_id;
  END IF;

  -- Create test events with expected UUIDs (if they don't already exist)
  -- Event 1: Tomorrow
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event1_id) THEN
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES (
      v_event1_id, 'Avatar: Fire & Ash 3D', 'The epic conclusion to the Avatar saga',
      'cinema', 'anchor', 'Luxor Cinema Meppel',
      ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
      CURRENT_DATE + interval '1 day', '19:30',
      'Tickets Available', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=1000',
      98, v_target_profile_id
    );
    RAISE NOTICE 'Created event %', v_event1_id;
  END IF;

  -- Event 2: Tomorrow evening
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event2_id) THEN
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES (
      v_event2_id, 'Painting Workshop with Sylvia', 'Learn watercolor techniques',
      'crafts', 'anchor', 'Reestkerk',
      ST_SetSRID(ST_MakePoint(6.195, 52.705), 4326)::geography,
      CURRENT_DATE + interval '1 day', '20:00',
      '3 spots left', NULL, 92, v_target_profile_id
    );
    RAISE NOTICE 'Created event %', v_event2_id;
  END IF;

  -- Event 3: Tomorrow night
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event3_id) THEN
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES (
      v_event3_id, 'Battlefield 6 Friday', 'Gaming squad meetup',
      'gaming', 'signal', 'Online',
      ST_SetSRID(ST_MakePoint(6.2, 52.7), 4326)::geography,
      CURRENT_DATE + interval '1 day', '21:00',
      'Lobby Open', NULL, 88, v_target_profile_id
    );
    RAISE NOTICE 'Created event %', v_event3_id;
  END IF;

  -- Event 4: Day after tomorrow
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event4_id) THEN
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES (
      v_event4_id, 'Alcides vs. Marum', 'Local football match',
      'sports', 'anchor', 'Sportpark Ezinge',
      ST_SetSRID(ST_MakePoint(6.21, 52.695), 4326)::geography,
      CURRENT_DATE + interval '2 days', '15:00',
      'Match Day', NULL, 85, v_target_profile_id
    );
    RAISE NOTICE 'Created event %', v_event4_id;
  END IF;

  -- Event 5: Three days from now
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event5_id) THEN
    INSERT INTO events (
      id, title, description, category, event_type, venue_name,
      location, event_date, event_time, status, image_url,
      match_percentage, created_by
    ) VALUES (
      v_event5_id, 'Craft Market Sunday', 'Local artisans showcase',
      'market', 'anchor', 'Marktplein',
      ST_SetSRID(ST_MakePoint(6.19, 52.71), 4326)::geography,
      CURRENT_DATE + interval '3 days', '10:00',
      'Free Entry', NULL, 90, v_target_profile_id
    );
    RAISE NOTICE 'Created event %', v_event5_id;
  END IF;

  -- Create additional test profiles for other attendees (if they don't exist)
  INSERT INTO profiles (id, full_name, location_city, location_country, reliability_score, current_persona, verified_resident)
  VALUES 
    ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'Test User 1', 'Meppel', 'NL', 95, 'family', true),
    ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Test User 2', 'Meppel', 'NL', 92, 'gamer', true),
    ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Test User 3', 'Meppel', 'NL', 98, 'family', true),
    ('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'Test User 4', 'Meppel', 'NL', 90, 'gamer', true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test data setup complete!';
END $$;
