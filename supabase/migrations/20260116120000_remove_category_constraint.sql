-- Remove the events_category_check constraint to allow flexible category values
-- This fixes scraper errors where valid categories were being rejected
-- The application and scraper code handle category validation

-- Drop the category constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;

-- Add a comment to document why we removed the constraint
COMMENT ON COLUMN public.events.category IS 'Event category. No database constraint - validated at application layer via scraper categoryMapping.ts and frontend categories.ts';
