-- Drop old category constraint and add new one with all internal categories
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;

ALTER TABLE public.events ADD CONSTRAINT events_category_check 
CHECK (category = ANY (ARRAY['nightlife', 'food', 'culture', 'active', 'family', 'cinema', 'crafts', 'sports', 'gaming', 'market']));