-- Migration: Add Time Mode and Opening Hours Support
-- Enables the system to distinguish between fixed events, venues with opening hours, and anytime locations

-- ============================================================================
-- PHASE 1: Add time_mode enum and opening_hours column
-- ============================================================================

-- Create enum for time mode
DO $$ BEGIN
  CREATE TYPE time_mode AS ENUM ('fixed', 'window', 'anytime');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS time_mode time_mode DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL;

-- Add comment for opening_hours structure
COMMENT ON COLUMN events.opening_hours IS 
  'Opening hours in Google-like structure. Example: {"monday": ["09:00-17:00"], "friday": ["09:00-12:00", "13:00-22:00"]}. Used when time_mode is "window".';

-- ============================================================================
-- PHASE 2: Relax constraints and add validation
-- ============================================================================

-- Make event_date nullable (but still enforce it for fixed events)
ALTER TABLE events
  ALTER COLUMN event_date DROP NOT NULL;

-- Add check constraint: if time_mode is 'fixed', event_date must be set
ALTER TABLE events
  ADD CONSTRAINT check_fixed_event_has_date 
  CHECK (
    time_mode != 'fixed' OR event_date IS NOT NULL
  );

-- Add check constraint: if time_mode is 'window', opening_hours should be set
-- This is a soft constraint (no hard enforcement to allow for missing data)
COMMENT ON COLUMN events.time_mode IS 
  'fixed: Event with specific start/end time. window: Venue with recurring opening hours. anytime: Always accessible (parks, monuments).';

-- ============================================================================
-- PHASE 3: Add indexes for performance
-- ============================================================================

-- Index for filtering by time_mode
CREATE INDEX IF NOT EXISTS idx_events_time_mode ON events(time_mode);

-- Index for venues (window mode) to quickly find open venues
CREATE INDEX IF NOT EXISTS idx_events_window_mode 
  ON events(time_mode) 
  WHERE time_mode = 'window';

-- ============================================================================
-- PHASE 4: Update existing data
-- ============================================================================

-- Set all existing events to 'fixed' mode (they all have event_date)
UPDATE events 
SET time_mode = 'fixed' 
WHERE time_mode IS NULL;

-- ============================================================================
-- PHASE 5: Update staged_events and raw_events tables
-- ============================================================================

-- Add time_mode to staged_events for pipeline
ALTER TABLE staged_events
  ADD COLUMN IF NOT EXISTS time_mode time_mode DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL;

-- Make event_date nullable in staged_events
ALTER TABLE staged_events
  ALTER COLUMN event_date DROP NOT NULL;

-- Add check constraint for staged_events
ALTER TABLE staged_events
  ADD CONSTRAINT check_staged_fixed_event_has_date 
  CHECK (
    time_mode != 'fixed' OR event_date IS NOT NULL
  );

-- ============================================================================
-- PHASE 6: Helper functions for opening hours
-- ============================================================================

-- Function to check if a venue is currently open
CREATE OR REPLACE FUNCTION is_venue_open_now(
  p_opening_hours JSONB,
  p_check_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_day_name TEXT;
  v_hours_array JSONB;
  v_hour_range TEXT;
  v_open_time TIME;
  v_close_time TIME;
  v_current_time TIME;
BEGIN
  -- Return false if no opening hours provided
  IF p_opening_hours IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get day of week (lowercase)
  v_day_name := LOWER(TO_CHAR(p_check_time, 'Day'));
  v_day_name := TRIM(v_day_name);
  
  -- Get current time
  v_current_time := p_check_time::TIME;
  
  -- Get hours for this day
  v_hours_array := p_opening_hours->v_day_name;
  
  -- If no hours for this day, venue is closed
  IF v_hours_array IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check each time range for this day
  FOR v_hour_range IN SELECT jsonb_array_elements_text(v_hours_array)
  LOOP
    -- Parse "HH:MM-HH:MM" format
    v_open_time := SPLIT_PART(v_hour_range, '-', 1)::TIME;
    v_close_time := SPLIT_PART(v_hour_range, '-', 2)::TIME;
    
    -- Check if current time falls within this range
    IF v_current_time >= v_open_time AND v_current_time <= v_close_time THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION is_venue_open_now IS 
  'Checks if a venue is currently open based on its opening_hours JSONB. Returns false for venues without opening hours.';

-- Function to get next opening time
CREATE OR REPLACE FUNCTION get_next_opening_time(
  p_opening_hours JSONB,
  p_from_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
  v_day_name TEXT;
  v_hours_array JSONB;
  v_day_offset INTEGER;
  v_check_date DATE;
BEGIN
  -- Return null if no opening hours
  IF p_opening_hours IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check next 7 days
  FOR v_day_offset IN 0..6 LOOP
    v_check_date := (p_from_time + (v_day_offset || ' days')::INTERVAL)::DATE;
    v_day_name := LOWER(TO_CHAR(v_check_date, 'Day'));
    v_day_name := TRIM(v_day_name);
    
    v_hours_array := p_opening_hours->v_day_name;
    
    IF v_hours_array IS NOT NULL AND jsonb_array_length(v_hours_array) > 0 THEN
      -- Return the first opening time for this day
      v_result := jsonb_build_object(
        'day', v_day_name,
        'date', v_check_date,
        'opens_at', v_hours_array->0
      );
      RETURN v_result;
    END IF;
  END LOOP;
  
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION get_next_opening_time IS 
  'Returns the next opening time for a venue in the next 7 days. Returns JSONB with day, date, and opens_at fields.';
