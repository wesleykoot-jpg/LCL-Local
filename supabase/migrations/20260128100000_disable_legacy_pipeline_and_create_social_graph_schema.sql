-- ============================================================================
-- Migration: Disable Legacy Pipeline & Create Social Graph Intelligence Schema
-- Version: 3.2 (Waterfall Architecture, Production-Hardened)
-- Date: 2026-01-28
-- ============================================================================
-- 
-- This migration:
-- 1. Disables ALL legacy scraper cron jobs
-- 2. Marks legacy sources as deprecated
-- 3. Creates the new Social Graph Intelligence Pipeline schema
-- 4. Sets up geocode caching, Serper discovery, and failure tracking
--
-- ============================================================================

-- ============================================================================
-- PHASE 1: DISABLE LEGACY PIPELINE
-- ============================================================================

-- 1.1 Unschedule ALL legacy cron jobs (safe - handles missing pg_cron gracefully)
DO $$
DECLARE
  v_has_cron BOOLEAN;
BEGIN
  -- Check if cron schema and tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'cron' AND table_name = 'job'
  ) INTO v_has_cron;

  IF v_has_cron THEN
    RAISE NOTICE '[LEGACY DISABLE] Found pg_cron, disabling scraper jobs...';
    
    -- Try to unschedule via cron schema
    BEGIN
      -- Disable by setting active = false instead of deleting
      UPDATE cron.job 
      SET active = false 
      WHERE jobname LIKE '%scrape%' 
         OR jobname LIKE '%coordinator%' 
         OR jobname LIKE '%discovery%'
         OR jobname LIKE '%enrichment%'
         OR jobname LIKE '%indexing%';
      
      RAISE NOTICE '[LEGACY DISABLE] Disabled legacy cron jobs';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[LEGACY DISABLE] Could not disable cron jobs: % (continuing anyway)', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '[LEGACY DISABLE] pg_cron not installed or cron.job table not found - skipping cron cleanup';
  END IF;
END $$;

-- 1.2 Mark all legacy scraper_sources as deprecated (if table exists)
DO $$
DECLARE
  v_has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'scraper_sources'
  ) INTO v_has_table;

  IF v_has_table THEN
    UPDATE public.scraper_sources 
    SET 
      enabled = FALSE,
      config = jsonb_set(
        COALESCE(config, '{}'::jsonb),
        '{deprecated}',
        'true'::jsonb
      )
    WHERE enabled = TRUE;
    
    -- Add legacy flag column if not exists
    ALTER TABLE public.scraper_sources 
    ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT TRUE;
    
    UPDATE public.scraper_sources SET is_legacy = TRUE;
    
    RAISE NOTICE '[LEGACY DISABLE] Marked all legacy scraper_sources as deprecated';
  ELSE
    RAISE NOTICE '[LEGACY DISABLE] No legacy scraper_sources table found - skipping';
  END IF;
END $$;

-- ============================================================================
-- PHASE 2: CREATE SOCIAL GRAPH INTELLIGENCE PIPELINE SCHEMA
-- ============================================================================

-- 2.1 Pipeline Status Enum (if not exists from previous migration)
DO $$ BEGIN
  CREATE TYPE public.sg_pipeline_stage AS ENUM (
    'discovered',           -- Stage 1: Scout found URL
    'analyzing',            -- Stage 2: Strategist analyzing fetch strategy
    'awaiting_fetch',       -- Stage 2: Ready for fetch
    'fetching',             -- Stage 3a: Rendering page
    'cleaning',             -- Stage 3b: Cleaning HTML
    'extracting',           -- Stage 3c: AI extraction
    'validating',           -- Stage 3d: Schema validation
    'enriching',            -- Stage 3e: Geocoding + vibe + media
    'deduplicating',        -- Stage 3f: Deduplication check
    'ready_to_persist',     -- Stage 3g: Ready to write to events table
    'vectorizing',          -- Stage 4: Embedding generation
    'indexed',              -- Complete: In production
    'geo_incomplete',       -- Partial: Missing lat/lng
    'quarantined',          -- Failure: Needs human intervention
    'failed'                -- Permanent failure after max retries
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2.2 Source Tier Enum
DO $$ BEGIN
  CREATE TYPE public.source_tier AS ENUM (
    'tier_1_metropolis',    -- APIs: Ticketmaster, Eventbrite, Meetup
    'tier_2_regional',      -- Aggregators: Uitagenda, city portals
    'tier_3_hyperlocal'     -- Venues: Cafes, libraries, community centers
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2.3 Discovery Method Enum
DO $$ BEGIN
  CREATE TYPE public.discovery_method AS ENUM (
    'serper_search',        -- Discovered via Serper.dev Google Search
    'api_webhook',          -- Real-time from API
    'seed_list',            -- Manual seed list
    'internal_link',        -- Found via internal link crawl
    'sitemap'               -- Found via sitemap.xml
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2.4 Failure Level Enum
DO $$ BEGIN
  CREATE TYPE public.failure_level AS ENUM (
    'transient',            -- Level 1: Timeout, 5xx - retry with backoff
    'source_drift',         -- Level 2: Selector/layout changed - trigger AI repair
    'repair_failure',       -- Level 3: AI repair failed - quarantine
    'systemic'              -- Level 4: LLM/DB down - circuit breaker
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2.5 CREATE sg_sources - New Source Registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  domain TEXT GENERATED ALWAYS AS (
    regexp_replace(url, '^https?://([^/]+).*$', '\1')
  ) STORED,
  
  -- Classification
  tier source_tier NOT NULL DEFAULT 'tier_3_hyperlocal',
  discovery_method discovery_method NOT NULL DEFAULT 'seed_list',
  
  -- Geography
  city TEXT,
  country_code TEXT DEFAULT 'NL',
  
  -- Fetch Strategy (populated by Strategist)
  fetch_strategy JSONB DEFAULT '{}',
  -- Example: { "fetcher": "playwright", "wait_for": ".event-card", "anti_bot": true }
  
  -- Extraction Config (populated by AI or manual)
  extraction_config JSONB DEFAULT '{}',
  -- Example: { "selectors": {...}, "schema_version": "3.2" }
  
  -- Health Metrics
  reliability_score NUMERIC(3,2) DEFAULT 1.00,
  consecutive_failures INTEGER DEFAULT 0,
  total_events_extracted INTEGER DEFAULT 0,
  last_successful_scrape TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  
  -- Rate Limiting
  rate_limit_state JSONB DEFAULT '{"requests_per_second": 1, "last_request_at": null}',
  
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  quarantined BOOLEAN DEFAULT FALSE,
  quarantine_reason TEXT,
  quarantined_at TIMESTAMPTZ,
  
  -- Versioning
  schema_version TEXT DEFAULT '3.2',
  config_version INTEGER DEFAULT 1,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'system',
  
  -- Serper discovery metadata
  serper_query TEXT,
  serper_discovered_at TIMESTAMPTZ
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sg_sources_enabled ON public.sg_sources (enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_sg_sources_tier ON public.sg_sources (tier);
CREATE INDEX IF NOT EXISTS idx_sg_sources_domain ON public.sg_sources (domain);
CREATE INDEX IF NOT EXISTS idx_sg_sources_city ON public.sg_sources (city);
CREATE INDEX IF NOT EXISTS idx_sg_sources_quarantined ON public.sg_sources (quarantined) WHERE quarantined = TRUE;

-- ============================================================================
-- 2.6 CREATE sg_pipeline_queue - Main Processing Queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_pipeline_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source Reference
  source_id UUID REFERENCES public.sg_sources(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  detail_url TEXT,
  
  -- Current Stage
  stage sg_pipeline_stage DEFAULT 'discovered',
  
  -- Discovery Metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovery_method discovery_method,
  priority INTEGER DEFAULT 50, -- 1-100, higher = process sooner
  
  -- Raw Data
  raw_html TEXT,
  cleaned_markdown TEXT,
  
  -- Extracted Data (Social Five + more)
  extracted_data JSONB,
  -- Schema: { "what", "when", "where", "who", "vibe", ... }
  
  -- Geocoding
  geocode_status TEXT DEFAULT 'pending', -- pending, success, failed, cached
  geocode_attempts INTEGER DEFAULT 0,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geocode_raw_response JSONB,
  
  -- Embedding
  embedding vector(1536),
  
  -- Failure Tracking
  failure_level failure_level,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  
  -- Worker Assignment
  worker_id UUID,
  claimed_at TIMESTAMPTZ,
  
  -- Stage Timestamps
  analyzed_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ,
  extracted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  enriched_at TIMESTAMPTZ,
  vectorized_at TIMESTAMPTZ,
  persisted_at TIMESTAMPTZ,
  
  -- Final Event Reference
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  
  -- Deduplication
  content_hash TEXT,
  duplicate_of UUID REFERENCES public.sg_pipeline_queue(id),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stage-based processing
CREATE INDEX IF NOT EXISTS idx_sg_queue_stage ON public.sg_pipeline_queue (stage);
CREATE INDEX IF NOT EXISTS idx_sg_queue_discovered ON public.sg_pipeline_queue (priority DESC, discovered_at ASC) 
  WHERE stage = 'discovered';
CREATE INDEX IF NOT EXISTS idx_sg_queue_awaiting_fetch ON public.sg_pipeline_queue (priority DESC, analyzed_at ASC) 
  WHERE stage = 'awaiting_fetch';
CREATE INDEX IF NOT EXISTS idx_sg_queue_ready_to_persist ON public.sg_pipeline_queue (priority DESC, enriched_at ASC) 
  WHERE stage = 'ready_to_persist';
CREATE INDEX IF NOT EXISTS idx_sg_queue_geo_incomplete ON public.sg_pipeline_queue (geocode_attempts ASC, last_failure_at ASC)
  WHERE stage = 'geo_incomplete';
CREATE INDEX IF NOT EXISTS idx_sg_queue_content_hash ON public.sg_pipeline_queue (content_hash);
CREATE INDEX IF NOT EXISTS idx_sg_queue_source_id ON public.sg_pipeline_queue (source_id);

-- ============================================================================
-- 2.7 CREATE sg_geocode_cache - Nominatim Response Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_geocode_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Normalized address key (lowercase, trimmed)
  address_key TEXT NOT NULL UNIQUE,
  -- Format: "{venue}|{street}|{postal}|{city}|{country}"
  
  -- Original input
  original_query TEXT NOT NULL,
  
  -- Cached result
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  
  -- Full Nominatim response
  raw_response JSONB,
  display_name TEXT,
  place_type TEXT,
  importance NUMERIC,
  
  -- Cache metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '180 days',
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sg_geocode_cache_key ON public.sg_geocode_cache (address_key);
CREATE INDEX IF NOT EXISTS idx_sg_geocode_cache_expires ON public.sg_geocode_cache (expires_at);

-- ============================================================================
-- 2.8 CREATE sg_serper_queries - Discovery Query Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_serper_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Query details
  query_text TEXT NOT NULL,
  city TEXT,
  category TEXT,
  template TEXT, -- e.g., "{city} events calendar"
  
  -- Results
  result_count INTEGER DEFAULT 0,
  urls_discovered TEXT[],
  sources_created INTEGER DEFAULT 0,
  
  -- Rate limiting
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  response_time_ms INTEGER,
  credits_used INTEGER DEFAULT 1,
  
  -- Status
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sg_serper_queries_city ON public.sg_serper_queries (city);
CREATE INDEX IF NOT EXISTS idx_sg_serper_queries_executed ON public.sg_serper_queries (executed_at DESC);

-- ============================================================================
-- 2.9 CREATE sg_failure_log - Comprehensive Failure Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_failure_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  queue_item_id UUID REFERENCES public.sg_pipeline_queue(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.sg_sources(id) ON DELETE CASCADE,
  
  -- Failure details
  stage sg_pipeline_stage NOT NULL,
  failure_level failure_level NOT NULL,
  error_code TEXT,
  error_message TEXT,
  stack_trace TEXT,
  
  -- Context
  raw_input TEXT,
  ai_response TEXT,
  http_status INTEGER,
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  
  -- Metrics
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sg_failure_log_unresolved ON public.sg_failure_log (created_at DESC) 
  WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_sg_failure_log_level ON public.sg_failure_log (failure_level);
CREATE INDEX IF NOT EXISTS idx_sg_failure_log_source ON public.sg_failure_log (source_id);

-- ============================================================================
-- 2.10 CREATE sg_ai_repair_log - Self-Healing Audit Trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_ai_repair_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source being repaired
  source_id UUID REFERENCES public.sg_sources(id) ON DELETE CASCADE,
  
  -- Repair context
  trigger_reason TEXT NOT NULL, -- "selector_failure", "layout_change", etc.
  raw_html_sample TEXT,
  
  -- AI analysis
  ai_diagnosis TEXT,
  old_config JSONB,
  new_config JSONB,
  
  -- Validation
  validation_passed BOOLEAN,
  validation_sample_size INTEGER,
  validation_success_rate NUMERIC(5,2),
  
  -- Result
  applied BOOLEAN DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  rollback_available BOOLEAN DEFAULT TRUE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sg_repair_log_source ON public.sg_ai_repair_log (source_id);

-- ============================================================================
-- 2.11 CREATE sg_pipeline_metrics - Observability
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sg_pipeline_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Time bucket
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  
  -- Stage metrics
  stage sg_pipeline_stage NOT NULL,
  
  -- Counts
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  
  -- Timing
  avg_duration_ms NUMERIC,
  p50_duration_ms NUMERIC,
  p95_duration_ms NUMERIC,
  p99_duration_ms NUMERIC,
  
  -- Costs
  total_ai_tokens INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4) DEFAULT 0,
  
  -- Unique constraint
  UNIQUE (bucket_start, stage)
);

CREATE INDEX IF NOT EXISTS idx_sg_metrics_bucket ON public.sg_pipeline_metrics (bucket_start DESC);
CREATE INDEX IF NOT EXISTS idx_sg_metrics_stage ON public.sg_pipeline_metrics (stage);

-- ============================================================================
-- PHASE 3: RLS POLICIES
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.sg_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_pipeline_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_geocode_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_serper_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_failure_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_ai_repair_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sg_pipeline_metrics ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON public.sg_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.sg_pipeline_queue
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.sg_geocode_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.sg_serper_queries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.sg_failure_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.sg_ai_repair_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON public.sg_pipeline_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- PHASE 4: HELPER FUNCTIONS
-- ============================================================================

-- 4.1 Normalize address for geocode cache key
CREATE OR REPLACE FUNCTION public.sg_normalize_address_key(
  p_venue TEXT,
  p_street TEXT,
  p_postal TEXT,
  p_city TEXT,
  p_country TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(TRIM(
    COALESCE(p_venue, '') || '|' ||
    COALESCE(p_street, '') || '|' ||
    COALESCE(p_postal, '') || '|' ||
    COALESCE(p_city, '') || '|' ||
    COALESCE(p_country, 'NL')
  ));
END;
$$;

-- 4.2 Claim items from queue for processing
CREATE OR REPLACE FUNCTION public.sg_claim_for_stage(
  p_stage sg_pipeline_stage,
  p_worker_id UUID DEFAULT gen_random_uuid(),
  p_limit INTEGER DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  source_id UUID,
  source_url TEXT,
  detail_url TEXT,
  raw_html TEXT,
  extracted_data JSONB,
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT q.id
    FROM sg_pipeline_queue q
    WHERE q.stage = p_stage
      AND q.worker_id IS NULL
      AND q.failure_count < 3
    ORDER BY q.priority DESC, q.discovered_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE sg_pipeline_queue q
  SET 
    worker_id = p_worker_id,
    claimed_at = NOW(),
    updated_at = NOW()
  FROM claimed
  WHERE q.id = claimed.id
  RETURNING 
    q.id,
    q.source_id,
    q.source_url,
    q.detail_url,
    q.raw_html,
    q.extracted_data,
    q.priority;
END;
$$;

-- 4.3 Advance item to next stage
CREATE OR REPLACE FUNCTION public.sg_advance_stage(
  p_item_id UUID,
  p_next_stage sg_pipeline_stage,
  p_extracted_data JSONB DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sg_pipeline_queue
  SET 
    stage = p_next_stage,
    worker_id = NULL,
    claimed_at = NULL,
    extracted_data = COALESCE(p_extracted_data, extracted_data),
    lat = COALESCE(p_lat, lat),
    lng = COALESCE(p_lng, lng),
    updated_at = NOW(),
    -- Set stage-specific timestamps
    analyzed_at = CASE WHEN p_next_stage = 'awaiting_fetch' THEN NOW() ELSE analyzed_at END,
    fetched_at = CASE WHEN p_next_stage = 'cleaning' THEN NOW() ELSE fetched_at END,
    extracted_at = CASE WHEN p_next_stage = 'validating' THEN NOW() ELSE extracted_at END,
    validated_at = CASE WHEN p_next_stage = 'enriching' THEN NOW() ELSE validated_at END,
    enriched_at = CASE WHEN p_next_stage = 'deduplicating' THEN NOW() ELSE enriched_at END,
    vectorized_at = CASE WHEN p_next_stage = 'indexed' THEN NOW() ELSE vectorized_at END,
    persisted_at = CASE WHEN p_next_stage = 'indexed' THEN NOW() ELSE persisted_at END
  WHERE id = p_item_id;
END;
$$;

-- 4.4 Record failure
CREATE OR REPLACE FUNCTION public.sg_record_failure(
  p_item_id UUID,
  p_failure_level failure_level,
  p_error_message TEXT,
  p_error_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stage sg_pipeline_stage;
  v_source_id UUID;
  v_failure_count INTEGER;
BEGIN
  -- Get current state
  SELECT stage, source_id, failure_count 
  INTO v_current_stage, v_source_id, v_failure_count
  FROM sg_pipeline_queue
  WHERE id = p_item_id;

  -- Log the failure
  INSERT INTO sg_failure_log (
    queue_item_id, source_id, stage, failure_level,
    error_code, error_message
  ) VALUES (
    p_item_id, v_source_id, v_current_stage, p_failure_level,
    p_error_code, p_error_message
  );

  -- Update queue item
  UPDATE sg_pipeline_queue
  SET 
    failure_count = failure_count + 1,
    failure_level = p_failure_level,
    last_failure_at = NOW(),
    last_failure_reason = p_error_message,
    worker_id = NULL,
    claimed_at = NULL,
    -- Move to failed/quarantined if max retries exceeded
    stage = CASE 
      WHEN failure_count >= 2 AND p_failure_level = 'transient' THEN 'quarantined'::sg_pipeline_stage
      WHEN p_failure_level = 'repair_failure' THEN 'quarantined'::sg_pipeline_stage
      WHEN p_failure_level = 'systemic' THEN 'quarantined'::sg_pipeline_stage
      ELSE stage
    END,
    updated_at = NOW()
  WHERE id = p_item_id;

  -- Update source health
  UPDATE sg_sources
  SET 
    consecutive_failures = consecutive_failures + 1,
    last_failure_at = NOW(),
    last_failure_reason = p_error_message,
    reliability_score = GREATEST(0, reliability_score - 0.05),
    -- Quarantine source if too many failures
    quarantined = CASE WHEN consecutive_failures >= 5 THEN TRUE ELSE quarantined END,
    quarantine_reason = CASE WHEN consecutive_failures >= 5 THEN 'Exceeded failure threshold' ELSE quarantine_reason END,
    quarantined_at = CASE WHEN consecutive_failures >= 5 THEN NOW() ELSE quarantined_at END,
    updated_at = NOW()
  WHERE id = v_source_id;
END;
$$;

-- 4.5 Lookup geocode cache
CREATE OR REPLACE FUNCTION public.sg_lookup_geocode_cache(
  p_venue TEXT,
  p_street TEXT,
  p_postal TEXT,
  p_city TEXT,
  p_country TEXT DEFAULT 'NL'
)
RETURNS TABLE (lat DOUBLE PRECISION, lng DOUBLE PRECISION, cached BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := sg_normalize_address_key(p_venue, p_street, p_postal, p_city, p_country);
  
  -- Check cache
  RETURN QUERY
  SELECT 
    gc.lat::DOUBLE PRECISION, 
    gc.lng::DOUBLE PRECISION, 
    TRUE::BOOLEAN
  FROM sg_geocode_cache gc
  WHERE gc.address_key = v_key
    AND gc.expires_at > NOW();
    
  -- Update hit count if found
  UPDATE sg_geocode_cache
  SET 
    hit_count = hit_count + 1,
    last_hit_at = NOW()
  WHERE address_key = v_key;
END;
$$;

-- 4.6 Insert geocode cache
CREATE OR REPLACE FUNCTION public.sg_insert_geocode_cache(
  p_venue TEXT,
  p_street TEXT,
  p_postal TEXT,
  p_city TEXT,
  p_country TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_raw_response JSONB DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  v_key := sg_normalize_address_key(p_venue, p_street, p_postal, p_city, p_country);
  
  INSERT INTO sg_geocode_cache (
    address_key, original_query, lat, lng, 
    raw_response, display_name
  ) VALUES (
    v_key,
    COALESCE(p_venue, '') || ', ' || COALESCE(p_street, '') || ', ' || COALESCE(p_city, '') || ', ' || COALESCE(p_country, 'NL'),
    p_lat, p_lng,
    p_raw_response, p_display_name
  )
  ON CONFLICT (address_key) DO UPDATE SET
    hit_count = sg_geocode_cache.hit_count + 1,
    last_hit_at = NOW();
END;
$$;

-- 4.7 Get pipeline stats
CREATE OR REPLACE FUNCTION public.sg_get_pipeline_stats()
RETURNS TABLE (
  stage TEXT,
  count BIGINT,
  oldest_item TIMESTAMPTZ,
  avg_wait_time_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.stage::TEXT,
    COUNT(*)::BIGINT,
    MIN(q.discovered_at),
    EXTRACT(EPOCH FROM AVG(NOW() - q.discovered_at)) / 60
  FROM sg_pipeline_queue q
  WHERE q.stage NOT IN ('indexed', 'failed')
  GROUP BY q.stage
  ORDER BY 
    CASE q.stage 
      WHEN 'discovered' THEN 1
      WHEN 'analyzing' THEN 2
      WHEN 'awaiting_fetch' THEN 3
      WHEN 'fetching' THEN 4
      WHEN 'cleaning' THEN 5
      WHEN 'extracting' THEN 6
      WHEN 'validating' THEN 7
      WHEN 'enriching' THEN 8
      WHEN 'deduplicating' THEN 9
      WHEN 'ready_to_persist' THEN 10
      WHEN 'vectorizing' THEN 11
      ELSE 99
    END;
END;
$$;

-- ============================================================================
-- PHASE 5: SCHEDULED CLEANUP JOBS (new pipeline only)
-- ============================================================================

-- Register new scheduled jobs for Social Graph pipeline (safe - handles missing pg_cron)
-- NOTE: Skipping cron job scheduling as it requires specific pg_cron permissions
-- These jobs can be set up manually via Supabase dashboard or run via external scheduler
DO $schedule_jobs$
BEGIN
  RAISE NOTICE '[SG PIPELINE] Cron job scheduling skipped - set up via Supabase Dashboard:';
  RAISE NOTICE '  - sg-geocode-retry: 0 4 * * * (daily geocode retries)';
  RAISE NOTICE '  - sg-cache-cleanup: 0 3 * * 0 (weekly cache cleanup)';
END $schedule_jobs$;

-- ============================================================================
-- PHASE 6: TRIGGER FOR STAGE TRANSITIONS
-- ============================================================================

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.sg_update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all SG tables
DROP TRIGGER IF EXISTS sg_sources_updated ON public.sg_sources;
CREATE TRIGGER sg_sources_updated
  BEFORE UPDATE ON public.sg_sources
  FOR EACH ROW EXECUTE FUNCTION public.sg_update_timestamp();

DROP TRIGGER IF EXISTS sg_queue_updated ON public.sg_pipeline_queue;
CREATE TRIGGER sg_queue_updated
  BEFORE UPDATE ON public.sg_pipeline_queue
  FOR EACH ROW EXECUTE FUNCTION public.sg_update_timestamp();

-- ============================================================================
-- DONE - Log completion
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Social Graph Intelligence Pipeline v3.2';
  RAISE NOTICE 'Migration completed successfully';
  RAISE NOTICE '- Legacy pipeline disabled';
  RAISE NOTICE '- New tables created: sg_sources, sg_pipeline_queue, sg_geocode_cache, sg_serper_queries, sg_failure_log, sg_ai_repair_log, sg_pipeline_metrics';
  RAISE NOTICE '- Helper functions created';
  RAISE NOTICE '- RLS policies applied';
  RAISE NOTICE '============================================';
END $$;
