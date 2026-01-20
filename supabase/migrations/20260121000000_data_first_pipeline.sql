-- Migration: Data-First Event Pipeline & Architecture Overhaul
-- Description: Adds tier configuration, preferred extraction method, and scraper_insights table
-- 
-- This migration implements the "Smart Extraction" engine database requirements:
-- 1. Source tier configuration (aggregator/venue/general)
-- 2. Preferred extraction method (hydration/json_ld/feed/dom/auto)
-- 3. Deep scrape toggle
-- 4. Scraper insights table for debugging and strategy trace logging

-- =============================================================================
-- 1. Enhance scraper_sources Table
-- =============================================================================

-- Add tier column for source classification
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS tier text DEFAULT 'general' 
CHECK (tier IN ('aggregator', 'venue', 'general'));

COMMENT ON COLUMN public.scraper_sources.tier IS 
  'Source tier: aggregator (Tier 1, major sources), venue (Tier 2, local venues), general (Tier 3, discovery)';

-- Add preferred extraction method
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS preferred_method text DEFAULT 'auto'
CHECK (preferred_method IN ('hydration', 'json_ld', 'feed', 'dom', 'auto'));

COMMENT ON COLUMN public.scraper_sources.preferred_method IS 
  'Preferred extraction method: auto runs waterfall, specific values skip lower-priority methods';

-- Add deep scrape toggle (for clicking into detail pages)
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS deep_scrape_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.scraper_sources.deep_scrape_enabled IS 
  'Whether to fetch detail pages for additional data (times, descriptions). Tier 2/3 typically enabled.';

-- Add detected CMS column
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS detected_cms text DEFAULT NULL;

COMMENT ON COLUMN public.scraper_sources.detected_cms IS 
  'Auto-detected CMS platform (wordpress, wix, squarespace, next.js, etc.)';

-- Add detected framework version for debugging
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS detected_framework_version text DEFAULT NULL;

COMMENT ON COLUMN public.scraper_sources.detected_framework_version IS 
  'Version of detected framework if available (e.g., Next.js 14.0.0)';

-- =============================================================================
-- 2. Create Scraper Insights Table for Debugging
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.scraper_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id UUID REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
    run_id UUID DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- The Outcome
    status TEXT CHECK (status IN ('success', 'partial', 'failure')),
    total_events_found INT DEFAULT 0,
    winning_strategy TEXT, -- e.g., 'hydration', 'json_ld', 'feed', 'dom'
    
    -- The "Why" - Strategy Trace (JSONB for flexibility)
    strategy_trace JSONB DEFAULT '{}'::jsonb,
    -- Example: {"hydration": {"tried": true, "found": 0, "error": null}, "json_ld": {"tried": true, "found": 15, "error": null}}
    
    -- CMS Detection Results
    detected_cms TEXT,
    detected_framework TEXT, -- e.g., 'next.js', 'wordpress', 'wix'
    
    -- Performance Metrics
    execution_time_ms INT,
    fetch_time_ms INT,
    parse_time_ms INT,
    
    -- HTML Analysis
    html_size_bytes INT,
    has_hydration_data BOOLEAN DEFAULT FALSE,
    has_json_ld BOOLEAN DEFAULT FALSE,
    has_rss_feed BOOLEAN DEFAULT FALSE,
    has_ics_feed BOOLEAN DEFAULT FALSE,
    
    -- Error details if any
    error_message TEXT,
    error_stack TEXT
);

-- Index for quick analysis of failures by source
CREATE INDEX IF NOT EXISTS idx_scraper_insights_source 
ON public.scraper_insights(source_id);

-- Index for finding recent insights
CREATE INDEX IF NOT EXISTS idx_scraper_insights_created 
ON public.scraper_insights(created_at DESC);

-- Index for finding failures
CREATE INDEX IF NOT EXISTS idx_scraper_insights_status 
ON public.scraper_insights(status) WHERE status IN ('partial', 'failure');

-- Index for finding by winning strategy
CREATE INDEX IF NOT EXISTS idx_scraper_insights_strategy 
ON public.scraper_insights(winning_strategy);

-- RLS for scraper_insights (admin only through service role)
ALTER TABLE public.scraper_insights ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage scraper_insights"
ON public.scraper_insights
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to view insights (for admin dashboard)
CREATE POLICY "Authenticated users can view scraper_insights"
ON public.scraper_insights
FOR SELECT
TO authenticated
USING (true);

COMMENT ON TABLE public.scraper_insights IS 
  'Detailed trace logs for each scraper run. Enables debugging and automatic strategy optimization.';

-- =============================================================================
-- 3. Add Helper Function for Updating Preferred Method
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_source_preferred_method(
    p_source_id UUID,
    p_preferred_method TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.scraper_sources
    SET 
        preferred_method = p_preferred_method,
        updated_at = NOW()
    WHERE id = p_source_id;
    
    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.update_source_preferred_method IS 
  'Updates a source''s preferred extraction method based on insights analysis';

-- =============================================================================
-- 4. Add Function to Log Scraper Insights
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_scraper_insight(
    p_source_id UUID,
    p_status TEXT,
    p_total_events_found INT,
    p_winning_strategy TEXT,
    p_strategy_trace JSONB,
    p_detected_cms TEXT DEFAULT NULL,
    p_detected_framework TEXT DEFAULT NULL,
    p_execution_time_ms INT DEFAULT NULL,
    p_fetch_time_ms INT DEFAULT NULL,
    p_parse_time_ms INT DEFAULT NULL,
    p_html_size_bytes INT DEFAULT NULL,
    p_has_hydration_data BOOLEAN DEFAULT FALSE,
    p_has_json_ld BOOLEAN DEFAULT FALSE,
    p_has_rss_feed BOOLEAN DEFAULT FALSE,
    p_has_ics_feed BOOLEAN DEFAULT FALSE,
    p_error_message TEXT DEFAULT NULL,
    p_run_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_insight_id UUID;
BEGIN
    INSERT INTO public.scraper_insights (
        source_id,
        run_id,
        status,
        total_events_found,
        winning_strategy,
        strategy_trace,
        detected_cms,
        detected_framework,
        execution_time_ms,
        fetch_time_ms,
        parse_time_ms,
        html_size_bytes,
        has_hydration_data,
        has_json_ld,
        has_rss_feed,
        has_ics_feed,
        error_message
    ) VALUES (
        p_source_id,
        p_run_id,
        p_status,
        p_total_events_found,
        p_winning_strategy,
        p_strategy_trace,
        p_detected_cms,
        p_detected_framework,
        p_execution_time_ms,
        p_fetch_time_ms,
        p_parse_time_ms,
        p_html_size_bytes,
        p_has_hydration_data,
        p_has_json_ld,
        p_has_rss_feed,
        p_has_ics_feed,
        p_error_message
    )
    RETURNING id INTO v_insight_id;
    
    -- If strategy consistently works (3+ times), update source's preferred_method
    IF p_winning_strategy IS NOT NULL AND p_status = 'success' THEN
        DECLARE
            v_consistent_count INT;
        BEGIN
            SELECT COUNT(*) INTO v_consistent_count
            FROM public.scraper_insights
            WHERE source_id = p_source_id
              AND winning_strategy = p_winning_strategy
              AND status = 'success'
              AND created_at > NOW() - INTERVAL '7 days';
            
            -- Auto-optimize after 3 consistent successes with same strategy
            IF v_consistent_count >= 3 THEN
                UPDATE public.scraper_sources
                SET 
                    preferred_method = p_winning_strategy,
                    detected_cms = COALESCE(p_detected_cms, detected_cms),
                    detected_framework_version = COALESCE(p_detected_framework, detected_framework_version),
                    updated_at = NOW()
                WHERE id = p_source_id
                  AND preferred_method = 'auto'; -- Only update if still on auto
            END IF;
        END;
    END IF;
    
    RETURN v_insight_id;
END;
$$;

COMMENT ON FUNCTION public.log_scraper_insight IS 
  'Logs a scraper run insight and auto-optimizes preferred_method after consistent success';

-- =============================================================================
-- 5. Add View for Source Health with Insights
-- =============================================================================

CREATE OR REPLACE VIEW public.source_health_with_insights AS
SELECT 
    s.*,
    COALESCE(latest.status, 'unknown') as last_insight_status,
    latest.winning_strategy as last_winning_strategy,
    latest.total_events_found as last_events_found,
    latest.execution_time_ms as last_execution_time_ms,
    latest.detected_framework,
    stats.success_count,
    stats.failure_count,
    stats.avg_events_per_run,
    stats.most_common_strategy
FROM public.scraper_sources s
LEFT JOIN LATERAL (
    SELECT *
    FROM public.scraper_insights i
    WHERE i.source_id = s.id
    ORDER BY i.created_at DESC
    LIMIT 1
) latest ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'failure') as failure_count,
        ROUND(AVG(total_events_found)::numeric, 1) as avg_events_per_run,
        MODE() WITHIN GROUP (ORDER BY winning_strategy) as most_common_strategy
    FROM public.scraper_insights i
    WHERE i.source_id = s.id
      AND i.created_at > NOW() - INTERVAL '30 days'
) stats ON true;

COMMENT ON VIEW public.source_health_with_insights IS 
  'Combined view of source configuration with latest insights and 30-day statistics';
