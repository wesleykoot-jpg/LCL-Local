-- Create geocode cache table to store venue coordinates
CREATE TABLE public.geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_key text UNIQUE NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  display_name text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (cache is shared)
CREATE POLICY "Anyone can view geocode cache"
ON public.geocode_cache
FOR SELECT
USING (true);

-- Allow service role to insert/update (edge functions)
CREATE POLICY "Service role can manage geocode cache"
ON public.geocode_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for fast lookups
CREATE INDEX idx_geocode_cache_venue_key ON public.geocode_cache(venue_key);