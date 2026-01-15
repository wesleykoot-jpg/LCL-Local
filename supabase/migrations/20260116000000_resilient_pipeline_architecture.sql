-- Migration: Resilient Pipeline Architecture v2.0
-- This migration adds the infrastructure for the stage-based, non-breaking scraper pipeline

-- ============================================================================
-- STAGE 1: Pipeline Jobs (replaces scrape_jobs for new architecture)
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,  -- Groups jobs from same orchestration run
  source_id UUID REFERENCES scraper_sources(id) ON DELETE CASCADE,
  
  -- Stage progression
  current_stage TEXT DEFAULT 'fetch' CHECK (current_stage IN ('fetch', 'parse', 'normalize', 'persist', 'completed', 'dead_letter')),
  stage_status JSONB DEFAULT '{
    "fetch": "pending",
    "parse": "pending", 
    "normalize": "pending",
    "persist": "pending"
  }'::jsonb,
  
  -- Retry tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Priority (higher = processed first)
  priority INTEGER DEFAULT 0
);

-- Index for worker job claiming (pending jobs by priority)
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_pending 
  ON pipeline_jobs(priority DESC, created_at ASC) 
  WHERE current_stage NOT IN ('completed', 'dead_letter');

-- Index for run aggregation
CREATE INDEX IF NOT EXISTS idx_pipeline_jobs_run_id ON pipeline_jobs(run_id);

COMMENT ON TABLE pipeline_jobs IS 'Stage-based pipeline job queue for resilient event scraping';

-- ============================================================================
-- STAGE 2: Raw Pages (HTML storage checkpoint)
-- ============================================================================

CREATE TABLE IF NOT EXISTS raw_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
  source_id UUID REFERENCES scraper_sources(id) ON DELETE CASCADE,
  
  -- Fetch results
  url TEXT NOT NULL,
  final_url TEXT,  -- After redirects
  html TEXT,
  status_code INTEGER,
  fetcher_used TEXT CHECK (fetcher_used IN ('static', 'scrapingbee', 'puppeteer', 'playwright')),
  fetch_duration_ms INTEGER,
  
  -- Content hash for detecting unchanged pages
  content_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for detecting unchanged pages (skip re-parsing)
CREATE INDEX IF NOT EXISTS idx_raw_pages_content_hash ON raw_pages(source_id, content_hash);

-- Index for cleanup of old pages
CREATE INDEX IF NOT EXISTS idx_raw_pages_created_at ON raw_pages(created_at);

COMMENT ON TABLE raw_pages IS 'Checkpoint storage for fetched HTML pages before parsing';

-- ============================================================================
-- STAGE 3: Raw Events (before normalization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
  page_id UUID REFERENCES raw_pages(id) ON DELETE CASCADE,
  source_id UUID REFERENCES scraper_sources(id) ON DELETE CASCADE,
  
  -- Raw extracted data (before normalization)
  raw_title TEXT,
  raw_date TEXT,
  raw_time TEXT,
  raw_location TEXT,
  raw_description TEXT,
  detail_url TEXT,
  image_url TEXT,
  raw_html TEXT,  -- The specific HTML block for this event
  
  -- Extraction metadata
  parse_strategy TEXT,  -- json-ld, microdata, selectors, heuristic
  confidence_score FLOAT DEFAULT 0.5,
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'normalized', 'failed', 'skipped')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for normalize worker to claim pending events
CREATE INDEX IF NOT EXISTS idx_raw_events_pending 
  ON raw_events(created_at ASC) 
  WHERE status = 'pending';

COMMENT ON TABLE raw_events IS 'Checkpoint storage for parsed event cards before normalization';

-- ============================================================================
-- STAGE 4: Staged Events (after normalization, before persist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS staged_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES pipeline_jobs(id) ON DELETE CASCADE,
  raw_event_id UUID REFERENCES raw_events(id) ON DELETE CASCADE,
  source_id UUID REFERENCES scraper_sources(id) ON DELETE CASCADE,
  
  -- Normalized data (ready for events table)
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  event_time TEXT,
  venue_name TEXT,
  location GEOGRAPHY(POINT, 4326),
  category TEXT,
  image_url TEXT,
  
  -- Structured fields (JSONB for flexibility)
  structured_date JSONB,
  structured_location JSONB,
  
  -- Deduplication fingerprint
  event_fingerprint TEXT NOT NULL,
  
  -- Quality metrics
  confidence_score FLOAT DEFAULT 0.5,
  normalization_method TEXT CHECK (normalization_method IN ('rules', 'ai', 'hybrid')),
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'persisted', 'duplicate', 'failed')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for persist worker to claim pending events
CREATE INDEX IF NOT EXISTS idx_staged_events_pending 
  ON staged_events(created_at ASC) 
  WHERE status = 'pending';

-- Unique index for deduplication within a batch
CREATE UNIQUE INDEX IF NOT EXISTS idx_staged_events_fingerprint 
  ON staged_events(source_id, event_fingerprint) 
  WHERE status = 'pending';

COMMENT ON TABLE staged_events IS 'Checkpoint storage for normalized events before final persistence';

-- ============================================================================
-- CIRCUIT BREAKER STATE
-- ============================================================================

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  source_id UUID PRIMARY KEY REFERENCES scraper_sources(id) ON DELETE CASCADE,
  
  -- State machine
  state TEXT DEFAULT 'CLOSED' CHECK (state IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
  
  -- Counters
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  
  -- Timestamps
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,  -- When circuit tripped
  cooldown_until TIMESTAMPTZ,  -- When to try HALF_OPEN
  
  -- Exponential backoff for repeated failures
  consecutive_opens INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE circuit_breaker_state IS 'Persistent circuit breaker state for source health tracking';

-- ============================================================================
-- DEAD LETTER QUEUE
-- ============================================================================

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Original context
  original_job_id UUID,
  source_id UUID REFERENCES scraper_sources(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN ('fetch', 'parse', 'normalize', 'persist', 'discovery')),
  
  -- Failure details
  error_type TEXT,  -- timeout, rate_limit, parse_error, db_error, etc.
  error_message TEXT,
  error_stack TEXT,
  
  -- Payload for retry (full context)
  payload JSONB,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Resolution
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'discarded')),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding unresolved items
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved 
  ON dead_letter_queue(created_at ASC) 
  WHERE status = 'pending';

-- Index for auto-retry
CREATE INDEX IF NOT EXISTS idx_dlq_retry 
  ON dead_letter_queue(next_retry_at ASC) 
  WHERE status = 'pending' AND next_retry_at IS NOT NULL;

COMMENT ON TABLE dead_letter_queue IS 'Failed pipeline items for debugging and manual retry';

-- ============================================================================
-- SOURCE HEALTH STATUS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW source_health_status AS
SELECT 
  s.id,
  s.name,
  s.url,
  s.enabled,
  s.auto_disabled,
  s.fetcher_type,
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
  
FROM scraper_sources s
LEFT JOIN circuit_breaker_state cb ON s.id = cb.source_id;

COMMENT ON VIEW source_health_status IS 'Unified view of source health for orchestrator decision making';

-- ============================================================================
-- CIRCUIT BREAKER FUNCTIONS
-- ============================================================================

-- Record a successful request (may close circuit)
CREATE OR REPLACE FUNCTION cb_record_success(p_source_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO circuit_breaker_state (source_id, state, success_count, last_success_at, failure_count, consecutive_opens)
  VALUES (p_source_id, 'CLOSED', 1, NOW(), 0, 0)
  ON CONFLICT (source_id) DO UPDATE SET
    state = 'CLOSED',
    success_count = circuit_breaker_state.success_count + 1,
    last_success_at = NOW(),
    failure_count = 0,
    consecutive_opens = 0,
    cooldown_until = NULL,
    opened_at = NULL,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Record a failed request (may open circuit)
CREATE OR REPLACE FUNCTION cb_record_failure(
  p_source_id UUID,
  p_error_message TEXT DEFAULT NULL,
  p_failure_threshold INTEGER DEFAULT 5
)
RETURNS TABLE(circuit_opened BOOLEAN, new_state TEXT) AS $$
DECLARE
  v_current_state TEXT;
  v_failure_count INTEGER;
  v_consecutive_opens INTEGER;
  v_base_cooldown INTERVAL := INTERVAL '30 minutes';
  v_max_cooldown INTERVAL := INTERVAL '24 hours';
  v_cooldown INTERVAL;
BEGIN
  -- Get or create circuit breaker state
  INSERT INTO circuit_breaker_state (source_id, state, failure_count, last_failure_at)
  VALUES (p_source_id, 'CLOSED', 1, NOW())
  ON CONFLICT (source_id) DO UPDATE SET
    failure_count = circuit_breaker_state.failure_count + 1,
    last_failure_at = NOW(),
    updated_at = NOW()
  RETURNING state, failure_count, consecutive_opens
  INTO v_current_state, v_failure_count, v_consecutive_opens;
  
  -- Check if we need to open the circuit
  IF v_current_state IN ('CLOSED', 'HALF_OPEN') AND v_failure_count >= p_failure_threshold THEN
    -- Calculate cooldown with exponential backoff
    v_cooldown := LEAST(v_base_cooldown * POWER(2, COALESCE(v_consecutive_opens, 0)), v_max_cooldown);
    
    UPDATE circuit_breaker_state SET
      state = 'OPEN',
      opened_at = NOW(),
      cooldown_until = NOW() + v_cooldown,
      consecutive_opens = COALESCE(consecutive_opens, 0) + 1,
      updated_at = NOW()
    WHERE source_id = p_source_id;
    
    RETURN QUERY SELECT true, 'OPEN'::TEXT;
  ELSE
    RETURN QUERY SELECT false, v_current_state;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Check and transition from OPEN to HALF_OPEN if cooldown elapsed
CREATE OR REPLACE FUNCTION cb_check_cooldown()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE circuit_breaker_state SET
    state = 'HALF_OPEN',
    updated_at = NOW()
  WHERE state = 'OPEN' 
    AND cooldown_until IS NOT NULL 
    AND cooldown_until <= NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DLQ FUNCTIONS
-- ============================================================================

-- Move failed item to DLQ
CREATE OR REPLACE FUNCTION dlq_add(
  p_job_id UUID,
  p_source_id UUID,
  p_stage TEXT,
  p_error_type TEXT,
  p_error_message TEXT,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_dlq_id UUID;
BEGIN
  INSERT INTO dead_letter_queue (
    original_job_id,
    source_id,
    stage,
    error_type,
    error_message,
    payload,
    next_retry_at
  ) VALUES (
    p_job_id,
    p_source_id,
    p_stage,
    p_error_type,
    p_error_message,
    p_payload,
    NOW() + INTERVAL '1 hour'  -- First retry after 1 hour
  )
  RETURNING id INTO v_dlq_id;
  
  RETURN v_dlq_id;
END;
$$ LANGUAGE plpgsql;

-- Get items ready for retry
CREATE OR REPLACE FUNCTION dlq_get_ready_for_retry(p_limit INTEGER DEFAULT 10)
RETURNS SETOF dead_letter_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM dead_letter_queue
  WHERE status = 'pending'
    AND next_retry_at IS NOT NULL
    AND next_retry_at <= NOW()
    AND retry_count < max_retries
  ORDER BY next_retry_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- Mark DLQ item as retrying (with exponential backoff for next retry)
CREATE OR REPLACE FUNCTION dlq_mark_retrying(p_dlq_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE dead_letter_queue SET
    status = 'retrying',
    retry_count = retry_count + 1,
    next_retry_at = NOW() + (INTERVAL '1 hour' * POWER(2, retry_count))
  WHERE id = p_dlq_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PROACTIVE RATE LIMITING (add columns to scraper_sources)
-- ============================================================================

-- Add columns individually to handle partial existence
ALTER TABLE scraper_sources ADD COLUMN IF NOT EXISTS requests_this_window INTEGER DEFAULT 0;
ALTER TABLE scraper_sources ADD COLUMN IF NOT EXISTS window_start_at TIMESTAMPTZ;
ALTER TABLE scraper_sources ADD COLUMN IF NOT EXISTS max_requests_per_window INTEGER DEFAULT 60;
ALTER TABLE scraper_sources ADD COLUMN IF NOT EXISTS window_duration_seconds INTEGER DEFAULT 60;

-- Function to check if request is allowed
CREATE OR REPLACE FUNCTION rate_limit_check(p_source_id UUID)
RETURNS TABLE(allowed BOOLEAN, wait_ms INTEGER) AS $$
DECLARE
  v_requests INTEGER;
  v_max_requests INTEGER;
  v_window_start TIMESTAMPTZ;
  v_window_duration INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT 
    requests_this_window,
    max_requests_per_window,
    window_start_at,
    window_duration_seconds
  INTO v_requests, v_max_requests, v_window_start, v_window_duration
  FROM scraper_sources
  WHERE id = p_source_id;
  
  -- If no window or window expired, reset
  IF v_window_start IS NULL OR (v_now - v_window_start) > (v_window_duration || ' seconds')::INTERVAL THEN
    UPDATE scraper_sources SET
      requests_this_window = 0,
      window_start_at = v_now
    WHERE id = p_source_id;
    
    RETURN QUERY SELECT true, 0;
    RETURN;
  END IF;
  
  -- Check if within limit
  IF v_requests < v_max_requests THEN
    RETURN QUERY SELECT true, 0;
  ELSE
    -- Calculate wait time until window resets
    RETURN QUERY SELECT 
      false, 
      EXTRACT(EPOCH FROM ((v_window_start + (v_window_duration || ' seconds')::INTERVAL) - v_now))::INTEGER * 1000;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to record a request (increment counter)
CREATE OR REPLACE FUNCTION rate_limit_record(p_source_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE scraper_sources SET
    requests_this_window = requests_this_window + 1
  WHERE id = p_source_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP FUNCTION (run weekly)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_pipeline_data(p_days_old INTEGER DEFAULT 7)
RETURNS TABLE(
  pipeline_jobs_deleted INTEGER,
  raw_pages_deleted INTEGER,
  raw_events_deleted INTEGER,
  staged_events_deleted INTEGER,
  dlq_resolved_deleted INTEGER
) AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - (p_days_old || ' days')::INTERVAL;
  v_pj INTEGER;
  v_rp INTEGER;
  v_re INTEGER;
  v_se INTEGER;
  v_dlq INTEGER;
BEGIN
  -- Delete old staged events first (FK constraints)
  DELETE FROM staged_events WHERE created_at < v_cutoff AND status IN ('persisted', 'duplicate');
  GET DIAGNOSTICS v_se = ROW_COUNT;
  
  -- Delete old raw events
  DELETE FROM raw_events WHERE created_at < v_cutoff AND status IN ('normalized', 'skipped');
  GET DIAGNOSTICS v_re = ROW_COUNT;
  
  -- Delete old raw pages that don't have pending raw_events
  DELETE FROM raw_pages rp
  WHERE rp.created_at < v_cutoff
    AND NOT EXISTS (
      SELECT 1 FROM raw_events re 
      WHERE re.page_id = rp.id AND re.status = 'pending'
    );
  GET DIAGNOSTICS v_rp = ROW_COUNT;
  
  -- Delete old completed pipeline jobs
  DELETE FROM pipeline_jobs WHERE created_at < v_cutoff AND current_stage = 'completed';
  GET DIAGNOSTICS v_pj = ROW_COUNT;
  
  -- Delete old resolved DLQ items (with NULL check for resolved_at)
  DELETE FROM dead_letter_queue 
  WHERE status IN ('resolved', 'discarded')
    AND resolved_at IS NOT NULL 
    AND resolved_at < v_cutoff;
  GET DIAGNOSTICS v_dlq = ROW_COUNT;
  
  RETURN QUERY SELECT v_pj, v_rp, v_re, v_se, v_dlq;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Scraper sources indexes
CREATE INDEX IF NOT EXISTS idx_scraper_sources_enabled ON scraper_sources(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scraper_sources_available ON scraper_sources(enabled, auto_disabled) 
  WHERE enabled = true AND (auto_disabled = false OR auto_disabled IS NULL);

-- Events fingerprint index (for deduplication)
CREATE INDEX IF NOT EXISTS idx_events_fingerprint ON events(source_id, event_fingerprint);

-- ============================================================================
-- GRANTS (if using RLS)
-- ============================================================================

-- Service role needs full access to pipeline tables
GRANT ALL ON pipeline_jobs TO service_role;
GRANT ALL ON raw_pages TO service_role;
GRANT ALL ON raw_events TO service_role;
GRANT ALL ON staged_events TO service_role;
GRANT ALL ON circuit_breaker_state TO service_role;
GRANT ALL ON dead_letter_queue TO service_role;

-- Anon/authenticated should not access pipeline tables
REVOKE ALL ON pipeline_jobs FROM anon, authenticated;
REVOKE ALL ON raw_pages FROM anon, authenticated;
REVOKE ALL ON raw_events FROM anon, authenticated;
REVOKE ALL ON staged_events FROM anon, authenticated;
REVOKE ALL ON circuit_breaker_state FROM anon, authenticated;
REVOKE ALL ON dead_letter_queue FROM anon, authenticated;

COMMENT ON COLUMN pipeline_jobs.run_id IS 'Groups all jobs from a single orchestration run for aggregation';
COMMENT ON COLUMN raw_pages.content_hash IS 'MD5 hash of HTML for detecting unchanged pages';
COMMENT ON COLUMN staged_events.event_fingerprint IS 'SHA256 hash of title|date|source_id for deduplication';
COMMENT ON COLUMN circuit_breaker_state.consecutive_opens IS 'Used for exponential backoff of cooldown period';
COMMENT ON COLUMN dead_letter_queue.next_retry_at IS 'When this item should be auto-retried';
