-- Add structured event data columns for better data modeling
-- Existing date, time, and location columns are kept for backward compatibility

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS structured_date JSONB,
  ADD COLUMN IF NOT EXISTS structured_location JSONB,
  ADD COLUMN IF NOT EXISTS organizer TEXT;

-- Add comment to describe the structured_date JSONB schema
COMMENT ON COLUMN public.events.structured_date IS 'Structured date/time data: {utc_start: string, utc_end?: string, timezone?: string, all_day?: boolean}';

-- Add comment to describe the structured_location JSONB schema
COMMENT ON COLUMN public.events.structured_location IS 'Structured location data: {name: string, coordinates?: {lat: number, lng: number}, address?: string, venue_id?: string}';

-- Add comment to describe organizer column
COMMENT ON COLUMN public.events.organizer IS 'Name of the event organizer if available';
