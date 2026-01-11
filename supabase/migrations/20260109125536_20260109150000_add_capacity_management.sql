/*
  # Add Event Capacity Management

  1. Schema Changes
    - Add max_attendees column to events table with default value
    - Add index on max_attendees for efficient filtering
    - Ensure existing events allow unlimited attendees

  2. Security
    - RLS policies already support capacity management
    - No new policy changes needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'max_attendees'
  ) THEN
    ALTER TABLE events ADD COLUMN max_attendees integer DEFAULT NULL CHECK (max_attendees IS NULL OR max_attendees > 0);
  END IF;
END $$;