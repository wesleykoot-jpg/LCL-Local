-- Migration: Add start_datetime/end_datetime columns for proper time handling
-- This implements Option 3 (Hybrid) for improved event time representation
--
-- Benefits:
-- - Proper timezone support with timestamptz
-- - Duration calculation (end - start)
-- - Filter ended events easily
-- - Support multi-day festivals
-- - Keep backward compatibility with existing event_date/start_time

-- Add new datetime columns
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS start_datetime timestamptz,
ADD COLUMN IF NOT EXISTS end_datetime timestamptz,
ADD COLUMN IF NOT EXISTS is_all_day boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_multi_day boolean DEFAULT false;

-- Add index for time-based queries
CREATE INDEX IF NOT EXISTS idx_events_start_datetime ON events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_events_end_datetime ON events(end_datetime);

-- Create composite index for filtering active events (not ended)
CREATE INDEX IF NOT EXISTS idx_events_active ON events(start_datetime, end_datetime) 
WHERE end_datetime IS NULL OR end_datetime > NOW();

-- Backfill start_datetime from existing event_date + start_time
-- This handles the legacy data with separate date and time fields
UPDATE events 
SET start_datetime = 
  CASE 
    WHEN event_date IS NOT NULL AND start_time IS NOT NULL THEN
      (event_date::date + start_time::time)::timestamptz
    WHEN event_date IS NOT NULL THEN
      event_date::timestamptz
    ELSE
      NULL
  END
WHERE start_datetime IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN events.start_datetime IS 'Event start with timezone (replaces event_date + start_time)';
COMMENT ON COLUMN events.end_datetime IS 'Event end with timezone (for duration/ended filtering)';
COMMENT ON COLUMN events.is_all_day IS 'True for all-day events (no specific time)';
COMMENT ON COLUMN events.is_multi_day IS 'True for multi-day events/festivals';

-- Add constraint to ensure end_datetime is after start_datetime if both present
ALTER TABLE events 
ADD CONSTRAINT check_datetime_order 
CHECK (end_datetime IS NULL OR start_datetime IS NULL OR end_datetime >= start_datetime);
