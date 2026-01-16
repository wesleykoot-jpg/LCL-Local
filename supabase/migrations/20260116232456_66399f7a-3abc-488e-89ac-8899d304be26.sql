-- Insert a clean test event for the planning page (no image, like the working examples)
INSERT INTO events (
  id,
  title,
  description,
  category,
  event_type,
  venue_name,
  location,
  event_date,
  event_time,
  status,
  image_url,
  match_percentage
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'Sunday Brunch Meetup',
  'Casual brunch gathering with friends',
  'social',
  'anchor',
  'Café de Buurman',
  ST_SetSRID(ST_MakePoint(5.12, 52.09), 4326)::geography,
  (CURRENT_DATE + interval '2 days')::timestamp + interval '11 hours',
  '11:00',
  'active',
  NULL,
  85
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  venue_name = EXCLUDED.venue_name,
  event_date = EXCLUDED.event_date,
  image_url = NULL;

-- Add attendance for the test user profile
INSERT INTO event_attendees (event_id, profile_id, status)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'de595401-5c4f-40fc-8d3a-a627e49780ff', 'going')
ON CONFLICT DO NOTHING;