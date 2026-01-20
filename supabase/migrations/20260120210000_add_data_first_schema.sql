-- Migration: Add Data-First Schema Support
-- Description: Adds tables and columns required for the Data-First extraction architecture (Hydration, CMS detection, Insights).

-- 1. Create scraper_insights table for extraction telemetry
CREATE TABLE IF NOT EXISTS public.scraper_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
    run_id UUID, -- Links to pipeline_jobs or scrape_jobs
    winning_strategy TEXT, -- 'hydration', 'json_ld', 'feed', 'dom', 'ai_fallback'
    strategy_trace JSONB, -- Recursive log: { "hydration": "failed", "json_ld": "success", "methods_tried": [...] }
    events_found INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    payload_size_bytes INTEGER,
    detected_cms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.scraper_insights IS 'Telemetry for scraper extraction performance and strategy selection';

-- 2. Add configuration columns to scraper_sources
ALTER TABLE public.scraper_sources
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS preferred_method TEXT, -- The "winning" method to try first next time
ADD COLUMN IF NOT EXISTS deep_scrape_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS detected_cms TEXT,
ADD COLUMN IF NOT EXISTS tier_config JSONB DEFAULT '{}'::jsonb; -- config for specific tiers (e.g. feed patterns)

COMMENT ON COLUMN public.scraper_sources.tier IS 'Scraping tier: standard, premium, or discovery';
COMMENT ON COLUMN public.scraper_sources.preferred_method IS 'Auto-optimized extraction method priority';

-- 3. Recreate the source_health_status view to include new columns
-- We drop it first to ensure schema changes are picked up
DROP VIEW IF EXISTS public.source_health_status;

CREATE OR REPLACE VIEW public.source_health_status AS
SELECT 
  s.id,
  s.name,
  s.url,
  s.enabled,
  s.auto_disabled,
  s.fetcher_type,
  s.tier,
  s.preferred_method,
  s.detected_cms,
  s.consecutive_failures,
  s.total_events_scraped,
  s.last_scraped_at,
  s.last_error,
  
  -- Circuit breaker info
  COALESCE(cb.state, 'CLOSED') as circuit_state,
  COALESCE(cb.failure_count, 0) as circuit_failure_count,
  COALESCE(cb.success_count, 0) as circuit_success_count,
  cb.cooldown_until,
  cb.last_failure_at as circuit_last_failure,
  cb.last_success_at as circuit_last_success,
  
  -- Availability calculation
  CASE 
    WHEN cb.state = 'OPEN' AND cb.cooldown_until > NOW() THEN false
    WHEN s.auto_disabled = true THEN false
    WHEN s.enabled = false THEN false
    ELSE true
  END as is_available,
  
  -- Priority score for orchestrator (higher = process first)
  COALESCE(
    (EXTRACT(EPOCH FROM (NOW() - COALESCE(s.last_scraped_at, '2020-01-01'))) / 3600)::INTEGER  -- Hours since last scrape
    + (COALESCE(s.total_events_scraped, 0) / 10)  -- Bonus for productive sources
    - (COALESCE(s.consecutive_failures, 0) * 20),  -- Penalty for failures
    0
  ) as priority_score
  
FROM public.scraper_sources s
LEFT JOIN public.circuit_breaker_state cb ON s.id = cb.source_id;

COMMENT ON VIEW public.source_health_status IS 'Unified view of source health including Data-First attributes';

-- 4. Enable RLS on new table
ALTER TABLE public.scraper_insights ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.scraper_insights TO service_role;
REVOKE ALL ON public.scraper_insights FROM anon, authenticated;
