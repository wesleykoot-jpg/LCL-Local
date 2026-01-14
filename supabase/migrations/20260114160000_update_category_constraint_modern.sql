-- Update category constraint to use modern 10-category system
-- This aligns the database with the UI and scraper category systems
-- Modern categories: active, gaming, entertainment, social, family, outdoors, music, workshops, foodie, community

-- Drop old category constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;

-- Add new constraint with modern categories
ALTER TABLE public.events ADD CONSTRAINT events_category_check 
CHECK (category = ANY (ARRAY[
  'active',
  'gaming', 
  'entertainment',
  'social',
  'family',
  'outdoors',
  'music',
  'workshops',
  'foodie',
  'community'
]));
