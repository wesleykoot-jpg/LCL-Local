-- Ensure events.category accepts the modern 10-category taxonomy used by the scraper
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_category_check;

ALTER TABLE public.events
ADD CONSTRAINT events_category_check CHECK (
  category = ANY (
    ARRAY[
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
    ]
  )
);
