-- Add tags column and GIN index for search performance
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN (tags);

COMMENT ON COLUMN public.events.tags IS 'Granular sub-category tags (e.g. techno, yoga, market) used for filtering.';
