-- ============================================================================
-- Waterfall v2 Quick Apply Script
-- Run this in Supabase Dashboard SQL Editor to apply the new schema
-- ============================================================================

-- 1. Add nl_tier column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraper_sources' 
    AND column_name = 'nl_tier'
  ) THEN
    ALTER TABLE public.scraper_sources ADD COLUMN nl_tier integer DEFAULT 3 CHECK (nl_tier BETWEEN 1 AND 3);
    COMMENT ON COLUMN public.scraper_sources.nl_tier IS 'Dutch rollout tier: 1=G4, 2=Centrum, 3=Villages';
    CREATE INDEX IF NOT EXISTS idx_scraper_sources_nl_tier ON public.scraper_sources(nl_tier);
  END IF;
END $$;

-- 2. Add health_score column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scraper_sources' 
    AND column_name = 'health_score'
  ) THEN
    ALTER TABLE public.scraper_sources ADD COLUMN health_score integer DEFAULT 70 CHECK (health_score BETWEEN 0 AND 100);
    COMMENT ON COLUMN public.scraper_sources.health_score IS 'Source reliability score (0-100)';
    ALTER TABLE public.scraper_sources ADD COLUMN health_last_updated_at timestamptz DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS idx_scraper_sources_health_score ON public.scraper_sources(health_score DESC) WHERE enabled = true;
  END IF;
END $$;

-- 3. Add Social Five columns to events if not exists
DO $$
BEGIN
  -- doors_open_time
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'doors_open_time') THEN
    ALTER TABLE public.events ADD COLUMN doors_open_time time;
    COMMENT ON COLUMN public.events.doors_open_time IS 'When doors/entry opens (distinct from event start)';
  END IF;

  -- language_profile
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'language_profile') THEN
    ALTER TABLE public.events ADD COLUMN language_profile varchar(10) DEFAULT 'NL' CHECK (language_profile IN ('NL', 'EN', 'Mixed', 'Other'));
    COMMENT ON COLUMN public.events.language_profile IS 'Primary language: NL, EN, Mixed, Other';
  END IF;

  -- interaction_mode
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'interaction_mode') THEN
    ALTER TABLE public.events ADD COLUMN interaction_mode varchar(10) DEFAULT 'medium' CHECK (interaction_mode IN ('high', 'medium', 'low', 'passive'));
    COMMENT ON COLUMN public.events.interaction_mode IS 'Social interaction level: high (workshop), medium (concert), low (talk), passive (movie)';
  END IF;

  -- structured_address
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'structured_address') THEN
    ALTER TABLE public.events ADD COLUMN structured_address jsonb;
    COMMENT ON COLUMN public.events.structured_address IS 'Map-ready address: {street, city, postal_code, country}';
  END IF;

  -- social_five_score
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'social_five_score') THEN
    ALTER TABLE public.events ADD COLUMN social_five_score integer DEFAULT 0 CHECK (social_five_score BETWEEN 0 AND 5);
    COMMENT ON COLUMN public.events.social_five_score IS 'Count of Social Five fields populated (0-5)';
  END IF;
END $$;

-- 4. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_events_language_profile ON public.events(language_profile);
CREATE INDEX IF NOT EXISTS idx_events_interaction_mode ON public.events(interaction_mode);
CREATE INDEX IF NOT EXISTS idx_events_social_five_score ON public.events(social_five_score DESC);

-- Done!
SELECT 'Waterfall v2 schema applied successfully!' as status;
