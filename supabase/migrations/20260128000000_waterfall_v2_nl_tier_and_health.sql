-- ============================================================================
-- Migration: Waterfall Intelligence v2 - Dutch Tier Classification & Health Score
-- Description: Adds nl_tier (1-3) for Dutch rollout and health_score (0-100) for source reliability
-- PRD Reference: Phase 1 - Database Schema Extension
-- ============================================================================

-- =============================================================================
-- 1. Add Dutch Tier Classification (nl_tier)
-- =============================================================================

-- nl_tier: 1 = G4 cities (Amsterdam, Rotterdam, The Hague, Utrecht)
--          2 = Centrum (regional aggregators, Uitagenda sites)
--          3 = Villages (local café/library sites)
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS nl_tier integer DEFAULT 3
CHECK (nl_tier BETWEEN 1 AND 3);

COMMENT ON COLUMN public.scraper_sources.nl_tier IS 
  'Dutch rollout tier: 1=G4 cities (Amsterdam, Rotterdam, Den Haag, Utrecht), 2=Centrum (regional aggregators), 3=Villages (local sites)';

-- Index for tier-based scheduling and prioritization
CREATE INDEX IF NOT EXISTS idx_scraper_sources_nl_tier 
ON public.scraper_sources(nl_tier);

-- =============================================================================
-- 2. Add Source Health Score (0-100)
-- =============================================================================

-- Health score represents source reliability
-- Gain: +10 for full "Social Five" extraction
-- Decay: -20 for 4xx/5xx errors, -10 for missing images/addresses
-- Quarantine: Sources with score < 40 are moved to low-priority queue
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 70
CHECK (health_score BETWEEN 0 AND 100);

COMMENT ON COLUMN public.scraper_sources.health_score IS 
  'Source reliability score (0-100). +10 for full Social Five, -20 for HTTP errors, -10 for missing data. Quarantine at <40.';

-- Track when health was last updated
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS health_last_updated_at timestamptz DEFAULT NOW();

-- Index for prioritizing healthy sources in scheduling
CREATE INDEX IF NOT EXISTS idx_scraper_sources_health_score 
ON public.scraper_sources(health_score DESC) 
WHERE enabled = true;

-- Composite index for tier + health based scheduling
CREATE INDEX IF NOT EXISTS idx_scraper_sources_tier_health
ON public.scraper_sources(nl_tier, health_score DESC)
WHERE enabled = true AND (auto_disabled = false OR auto_disabled IS NULL);

-- =============================================================================
-- 3. Health Score Management Functions
-- =============================================================================

-- Update health score based on scrape result
CREATE OR REPLACE FUNCTION public.update_source_health(
    p_source_id UUID,
    p_social_five_complete BOOLEAN,
    p_has_error BOOLEAN,
    p_error_code INTEGER DEFAULT NULL,
    p_missing_image BOOLEAN DEFAULT FALSE,
    p_missing_address BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_score INTEGER;
    v_new_score INTEGER;
    v_delta INTEGER := 0;
    v_was_quarantined BOOLEAN;
BEGIN
    -- Get current score
    SELECT health_score, (health_score < 40) INTO v_current_score, v_was_quarantined
    FROM public.scraper_sources
    WHERE id = p_source_id;
    
    IF v_current_score IS NULL THEN
        v_current_score := 70;
    END IF;
    
    -- Calculate delta based on result
    IF p_has_error THEN
        -- HTTP 4xx/5xx errors: -20 points
        v_delta := v_delta - 20;
    ELSIF p_social_five_complete THEN
        -- Full Social Five extraction: +10 points
        v_delta := v_delta + 10;
    ELSE
        -- Partial success: +2 points (source is working)
        v_delta := v_delta + 2;
    END IF;
    
    -- Penalties for missing data
    IF p_missing_image THEN
        v_delta := v_delta - 5;
    END IF;
    
    IF p_missing_address THEN
        v_delta := v_delta - 5;
    END IF;
    
    -- Calculate new score (clamp to 0-100)
    v_new_score := GREATEST(0, LEAST(100, v_current_score + v_delta));
    
    -- Update source
    UPDATE public.scraper_sources
    SET 
        health_score = v_new_score,
        health_last_updated_at = NOW(),
        -- Auto-quarantine at <40, auto-enable if recovered above 50
        enabled = CASE 
            WHEN v_new_score < 40 THEN false 
            WHEN v_was_quarantined AND v_new_score >= 50 THEN true
            ELSE enabled 
        END,
        disabled_reason = CASE 
            WHEN v_new_score < 40 THEN 'health_score_quarantine' 
            WHEN v_was_quarantined AND v_new_score >= 50 THEN NULL
            ELSE disabled_reason 
        END
    WHERE id = p_source_id;
    
    RETURN v_new_score;
END;
$$;

COMMENT ON FUNCTION public.update_source_health IS 
  'Updates source health score based on scrape results. Auto-quarantines at <40, auto-recovers at >=50.';

-- =============================================================================
-- 4. Get Healthy Sources for Scraping
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_healthy_sources(
    p_nl_tier INTEGER DEFAULT NULL,
    p_min_health INTEGER DEFAULT 40,
    p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.scraper_sources
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT *
    FROM public.scraper_sources
    WHERE enabled = true
      AND (auto_disabled = false OR auto_disabled IS NULL)
      AND health_score >= p_min_health
      AND (p_nl_tier IS NULL OR nl_tier = p_nl_tier)
    ORDER BY 
        nl_tier ASC,           -- Prioritize Tier 1 (G4 cities)
        health_score DESC,      -- Then by reliability
        last_scraped_at ASC NULLS FIRST  -- Then by staleness
    LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_healthy_sources IS 
  'Returns healthy sources for scraping, prioritized by tier and health score.';

-- =============================================================================
-- 5. Get Quarantined Sources for Review
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_quarantined_sources()
RETURNS TABLE(
    id UUID,
    name TEXT,
    url TEXT,
    health_score INTEGER,
    nl_tier INTEGER,
    last_error TEXT,
    health_last_updated_at TIMESTAMPTZ,
    consecutive_failures INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        id, name, url, health_score, nl_tier,
        last_error, health_last_updated_at, consecutive_failures
    FROM public.scraper_sources
    WHERE health_score < 40
       OR disabled_reason = 'health_score_quarantine'
    ORDER BY health_score ASC, health_last_updated_at DESC;
$$;

COMMENT ON FUNCTION public.get_quarantined_sources IS 
  'Returns sources in quarantine (health_score < 40) for manual review.';

-- =============================================================================
-- 6. Batch Update nl_tier for Existing Sources
-- =============================================================================

-- Tag G4 cities as Tier 1
UPDATE public.scraper_sources
SET nl_tier = 1
WHERE location_name ILIKE ANY(ARRAY['%amsterdam%', '%rotterdam%', '%den haag%', '%the hague%', '%utrecht%'])
   OR name ILIKE ANY(ARRAY['%amsterdam%', '%rotterdam%', '%den haag%', '%the hague%', '%utrecht%']);

-- Tag known aggregators as Tier 2
UPDATE public.scraper_sources
SET nl_tier = 2
WHERE url ILIKE ANY(ARRAY['%uitagenda%', '%uitburo%', '%uitloper%', '%ticketmaster%', '%eventbrite%', '%partyflock%'])
   OR tier = 'aggregator';

-- Everything else stays at Tier 3 (default)

-- =============================================================================
-- 7. Grants
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.update_source_health(UUID, BOOLEAN, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_healthy_sources(INTEGER, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_quarantined_sources() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_healthy_sources(INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quarantined_sources() TO authenticated;
