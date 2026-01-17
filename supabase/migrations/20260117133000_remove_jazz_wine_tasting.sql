/*
  # Remove Jazz & Wine Tasting Events
  
  This migration removes events with the title 'Jazz & Wine Tasting' from the database.
  
  ## Changes
  - Hard-delete event_attendees records first (to avoid FK violations)
  - Hard-delete events where title matches 'Jazz & Wine Tasting' (case-insensitive)
  
  ## Notes
  - This is a hard delete, not a soft delete, as the events table does not have a deleted_at column
  - Consider adding a deleted_at column to events table if soft deletes are needed in the future
  - Related records in event_attendees are deleted first to maintain referential integrity
  - If other tables reference events (tickets, favorites, etc.), add their cleanup here
  
  ## Rollback
  - This cannot be automatically rolled back as data will be permanently deleted
  - Ensure database backup exists before running in production
*/

-- Step 1: Delete related event_attendees records first
-- This prevents foreign key constraint violations
DELETE FROM event_attendees 
WHERE event_id IN (
  SELECT id FROM events 
  WHERE LOWER(title) = LOWER('Jazz & Wine Tasting')
);

-- Step 2: Delete the events themselves
DELETE FROM events 
WHERE LOWER(title) = LOWER('Jazz & Wine Tasting');

-- Optional: Log the number of deleted events
-- Note: This will return 0 rows affected after the delete completes
-- but can be useful for verification
COMMENT ON TABLE events IS 'Events table - Jazz & Wine Tasting events removed on 2026-01-17';
