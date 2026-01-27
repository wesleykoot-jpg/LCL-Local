-- WATERFALL INTELLIGENCE SCHEMA
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
CREATE TYPE public.nl_tier_enum AS ENUM ('tier1_g4', 'tier2_centrum', 'tier3_village');
CREATE TYPE public.language_profile_enum AS ENUM ('NL', 'EN', 'DE', 'MIXED');
CREATE TYPE public.interaction_mode_enum AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'PASSIVE');
CREATE TYPE public.fetcher_type_enum AS ENUM ('static', 'playwright', 'browserless', 'scrapingbee');
CREATE TYPE public.pipeline_status_enum AS ENUM ('awaiting_fetch', 'awaiting_enrichment', 'processing', 'completed', 'failed', 'quarantined');
CREATE TYPE public.ai_job_type_enum AS ENUM ('analyze_js_heavy', 'enrich_social_five', 'heal_selectors', 'classify_vibe');
CREATE TYPE public.ai_job_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed', 'rate_limited');
CREATE TYPE public.circuit_state_enum AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- TABLE: scraper_sources
CREATE TABLE public.scraper_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  domain TEXT GENERATED ALWAYS AS (substring(url from 'https?://([^/]+)')) STORED,
  nl_tier public.nl_tier_enum DEFAULT 'tier3_village',
  health_score INTEGER NOT NULL DEFAULT 70 CHECK (health_score >= 0 AND health_score <= 100),
  quarantined_at TIMESTAMPTZ NULL,
  detected_render_strategy public.fetcher_type_enum DEFAULT 'static',
  requires_proxy BOOLEAN DEFAULT FALSE,
  fetcher_config JSONB DEFAULT '{}',
  rate_limit_ms INTEGER DEFAULT 2000,
  dynamic_rate_limit_ms INTEGER,
  rate_limit_expires_at TIMESTAMPTZ,
  preferred_method TEXT DEFAULT 'auto',
  selectors_config JSONB DEFAULT '{}',
  last_working_selectors JSONB,
  language TEXT DEFAULT 'nl',
  country TEXT DEFAULT 'NL',
  default_coordinates JSONB,
  detected_cms TEXT,
  detected_framework_version TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  auto_disabled BOOLEAN DEFAULT FALSE,
  consecutive_failures INTEGER DEFAULT 0,
  consecutive_successes INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  next_scrape_at TIMESTAMPTZ,
  scrape_frequency_hours INTEGER DEFAULT 24,
  last_payload_hash TEXT,
  total_skipped_runs INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sources_enabled ON public.scraper_sources(enabled) WHERE enabled = TRUE;
CREATE INDEX idx_sources_nl_tier ON public.scraper_sources(nl_tier);
CREATE INDEX idx_sources_health ON public.scraper_sources(health_score);
CREATE INDEX idx_sources_next_scrape ON public.scraper_sources(next_scrape_at) WHERE enabled = TRUE;
CREATE INDEX idx_sources_quarantine ON public.scraper_sources(quarantined_at) WHERE quarantined_at IS NOT NULL;

-- TABLE: raw_event_staging
CREATE TABLE public.raw_event_staging (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
  status public.pipeline_status_enum DEFAULT 'awaiting_fetch',
  processing_started_at TIMESTAMPTZ,
  source_url TEXT NOT NULL,
  detail_url TEXT,
  raw_html TEXT,
  detail_html TEXT,
  parsing_method TEXT,
  event_date DATE,
  event_time TIME,
  doors_open_time TIME,
  venue_name TEXT,
  venue_address TEXT,
  coordinates JSONB,
  end_date DATE,
  end_time TIME,
  language_profile public.language_profile_enum DEFAULT 'NL',
  interaction_mode public.interaction_mode_enum,
  title TEXT,
  description TEXT,
  image_url TEXT,
  category TEXT,
  price TEXT,
  price_min_cents INTEGER,
  price_max_cents INTEGER,
  tickets_url TEXT,
  organizer TEXT,
  performer TEXT,
  age_restriction TEXT,
  accessibility TEXT,
  persona_tags TEXT[] DEFAULT '{}',
  quality_score NUMERIC(3,2) DEFAULT 0,
  data_completeness NUMERIC(3,2) DEFAULT 0,
  content_hash TEXT,
  event_fingerprint TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staging_status ON public.raw_event_staging(status);
CREATE INDEX idx_staging_source ON public.raw_event_staging(source_id);
CREATE INDEX idx_staging_fingerprint ON public.raw_event_staging(event_fingerprint);
CREATE INDEX idx_staging_date ON public.raw_event_staging(event_date) WHERE event_date IS NOT NULL;
CREATE INDEX idx_staging_processing ON public.raw_event_staging(processing_started_at) WHERE status = 'processing';

-- TABLE: ai_job_queue
CREATE TABLE public.ai_job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type public.ai_job_type_enum NOT NULL,
  related_id UUID,
  payload JSONB NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  status public.ai_job_status_enum DEFAULT 'pending',
  result JSONB,
  completed_at TIMESTAMPTZ,
  priority INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_queue_pending ON public.ai_job_queue(next_retry_at, priority) WHERE status IN ('pending', 'rate_limited');
CREATE INDEX idx_ai_queue_related ON public.ai_job_queue(related_id);
CREATE INDEX idx_ai_queue_type ON public.ai_job_queue(job_type);

-- TABLE: circuit_breaker_state
CREATE TABLE public.circuit_breaker_state (
  source_id UUID PRIMARY KEY REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
  state public.circuit_state_enum DEFAULT 'CLOSED',
  failure_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  cooldown_until TIMESTAMPTZ,
  consecutive_opens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLE: scraper_insights
CREATE TABLE public.scraper_insights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
  run_timestamp TIMESTAMPTZ DEFAULT NOW(),
  run_duration_ms INTEGER,
  events_discovered INTEGER DEFAULT 0,
  events_enriched INTEGER DEFAULT 0,
  events_persisted INTEGER DEFAULT 0,
  events_deduplicated INTEGER DEFAULT 0,
  events_failed INTEGER DEFAULT 0,
  social_five_complete INTEGER DEFAULT 0,
  health_delta INTEGER DEFAULT 0,
  ai_calls_made INTEGER DEFAULT 0,
  ai_calls_rate_limited INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  error_types JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_insights_source ON public.scraper_insights(source_id, run_timestamp DESC);
CREATE INDEX idx_insights_time ON public.scraper_insights(run_timestamp DESC);

-- TABLE: selector_healing_log
CREATE TABLE public.selector_healing_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
  old_selectors JSONB NOT NULL,
  new_selectors JSONB NOT NULL,
  ai_reasoning TEXT,
  test_successful BOOLEAN,
  events_extracted_before INTEGER,
  events_extracted_after INTEGER,
  applied_at TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_healing_source ON public.selector_healing_log(source_id, created_at DESC);

-- TABLE: raw_pages
CREATE TABLE public.raw_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES public.scraper_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  final_url TEXT,
  html TEXT,
  content_hash TEXT,
  status_code INTEGER,
  headers JSONB,
  fetcher_used public.fetcher_type_enum,
  fetch_duration_ms INTEGER,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raw_pages_source ON public.raw_pages(source_id, created_at DESC);
CREATE INDEX idx_raw_pages_hash ON public.raw_pages(content_hash);

-- Trigger to keep only last 5 versions per source
CREATE OR REPLACE FUNCTION prune_old_raw_pages()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.raw_pages 
  WHERE source_id = NEW.source_id 
  AND id NOT IN (
    SELECT id FROM public.raw_pages 
    WHERE source_id = NEW.source_id 
    ORDER BY created_at DESC 
    LIMIT 5
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prune_raw_pages
AFTER INSERT ON public.raw_pages
FOR EACH ROW EXECUTE FUNCTION prune_old_raw_pages();

-- TABLE: dutch_municipalities
CREATE TABLE public.dutch_municipalities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  province TEXT,
  population INTEGER NOT NULL,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  nl_tier public.nl_tier_enum GENERATED ALWAYS AS (
    CASE 
      WHEN name IN ('Amsterdam', 'Rotterdam', 'Den Haag', 'Utrecht') THEN 'tier1_g4'::public.nl_tier_enum
      WHEN population >= 50000 THEN 'tier2_centrum'::public.nl_tier_enum
      ELSE 'tier3_village'::public.nl_tier_enum
    END
  ) STORED
);

CREATE INDEX idx_municipalities_tier ON public.dutch_municipalities(nl_tier);
CREATE INDEX idx_municipalities_name ON public.dutch_municipalities USING gin(name gin_trgm_ops);

-- FUNCTION: Update health score with bounds checking
CREATE OR REPLACE FUNCTION update_source_health(
  p_source_id UUID,
  p_delta INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_score INTEGER;
  v_quarantine_threshold INTEGER := 40;
BEGIN
  UPDATE public.scraper_sources
  SET 
    health_score = GREATEST(0, LEAST(100, health_score + p_delta)),
    updated_at = NOW(),
    quarantined_at = CASE 
      WHEN health_score + p_delta < v_quarantine_threshold AND quarantined_at IS NULL 
      THEN NOW() 
      ELSE quarantined_at 
    END
  WHERE id = p_source_id
  RETURNING health_score INTO v_new_score;
  
  INSERT INTO public.scraper_insights (source_id, health_delta, metadata)
  VALUES (p_source_id, p_delta, jsonb_build_object('reason', p_reason));
  
  RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Claim AI jobs for processing
CREATE OR REPLACE FUNCTION claim_ai_jobs(
  p_job_type public.ai_job_type_enum DEFAULT NULL,
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF public.ai_job_queue AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM public.ai_job_queue
    WHERE status IN ('pending', 'rate_limited')
    AND next_retry_at <= NOW()
    AND (p_job_type IS NULL OR job_type = p_job_type)
    ORDER BY priority ASC, next_retry_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ai_job_queue q
  SET 
    status = 'processing',
    attempts = attempts + 1,
    updated_at = NOW()
  FROM claimed c
  WHERE q.id = c.id
  RETURNING q.*;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Complete AI job
CREATE OR REPLACE FUNCTION complete_ai_job(
  p_job_id UUID,
  p_result JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.ai_job_queue
  SET 
    status = 'completed',
    result = p_result,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Fail AI job with retry scheduling
CREATE OR REPLACE FUNCTION fail_ai_job(
  p_job_id UUID,
  p_error TEXT,
  p_is_rate_limited BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
  v_attempts INTEGER;
  v_max_attempts INTEGER;
  v_backoff_ms INTEGER;
BEGIN
  SELECT attempts, max_attempts INTO v_attempts, v_max_attempts
  FROM public.ai_job_queue WHERE id = p_job_id;
  
  IF v_attempts >= v_max_attempts THEN
    UPDATE public.ai_job_queue
    SET 
      status = 'failed',
      last_error = p_error,
      updated_at = NOW()
    WHERE id = p_job_id;
  ELSE
    v_backoff_ms := LEAST(1000 * POWER(2, v_attempts), 300000);
    
    UPDATE public.ai_job_queue
    SET 
      status = CASE WHEN p_is_rate_limited THEN 'rate_limited' ELSE 'pending' END,
      last_error = p_error,
      next_retry_at = NOW() + (v_backoff_ms || ' milliseconds')::INTERVAL,
      updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Claim staging rows for processing
CREATE OR REPLACE FUNCTION claim_staging_rows(
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF public.raw_event_staging AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM public.raw_event_staging
    WHERE status = 'awaiting_enrichment'
    AND retry_count < 3
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.raw_event_staging s
  SET 
    status = 'processing',
    processing_started_at = NOW(),
    updated_at = NOW()
  FROM claimed c
  WHERE s.id = c.id
  RETURNING s.*;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: Auto-assign nl_tier based on URL domain matching
CREATE OR REPLACE FUNCTION auto_assign_nl_tier()
RETURNS TRIGGER AS $$
DECLARE
  v_domain TEXT;
  v_municipality RECORD;
BEGIN
  v_domain := substring(NEW.url from 'https?://([^/]+)');
  
  SELECT * INTO v_municipality
  FROM public.dutch_municipalities
  WHERE 
    v_domain ILIKE '%' || lower(name) || '%'
    OR v_domain ILIKE '%visit' || lower(name) || '%'
    OR v_domain ILIKE '%uit' || lower(name) || '%'
    OR v_domain ILIKE '%ontdek' || lower(name) || '%'
  LIMIT 1;
  
  IF v_municipality IS NOT NULL THEN
    NEW.nl_tier := v_municipality.nl_tier;
    NEW.default_coordinates := jsonb_build_object(
      'lat', v_municipality.lat,
      'lng', v_municipality.lng
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_nl_tier
BEFORE INSERT ON public.scraper_sources
FOR EACH ROW EXECUTE FUNCTION auto_assign_nl_tier();

-- FUNCTION: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sources_updated_at
BEFORE UPDATE ON public.scraper_sources
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_staging_updated_at
BEFORE UPDATE ON public.raw_event_staging
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_ai_queue_updated_at
BEFORE UPDATE ON public.ai_job_queue
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_circuit_breaker_updated_at
BEFORE UPDATE ON public.circuit_breaker_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- VIEW: Source Health Dashboard
CREATE VIEW public.source_health_dashboard AS
SELECT 
  s.id,
  s.name,
  s.url,
  s.domain,
  s.nl_tier,
  s.health_score,
  s.enabled,
  s.quarantined_at IS NOT NULL AS is_quarantined,
  s.detected_render_strategy,
  s.consecutive_failures,
  s.consecutive_successes,
  s.last_scraped_at,
  s.next_scrape_at,
  cb.state AS circuit_state,
  cb.failure_count AS circuit_failures,
  cb.cooldown_until,
  CASE 
    WHEN s.quarantined_at IS NOT NULL THEN 'quarantined'
    WHEN NOT s.enabled THEN 'disabled'
    WHEN cb.state = 'OPEN' THEN 'circuit_open'
    WHEN cb.cooldown_until > NOW() THEN 'cooling_down'
    ELSE 'healthy'
  END AS status
FROM public.scraper_sources s
LEFT JOIN public.circuit_breaker_state cb ON cb.source_id = s.id;

-- RLS: Enable Row Level Security
ALTER TABLE public.scraper_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_event_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circuit_breaker_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selector_healing_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dutch_municipalities ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "service_role_all" ON public.scraper_sources FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.raw_event_staging FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.ai_job_queue FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.circuit_breaker_state FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.scraper_insights FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.selector_healing_log FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.raw_pages FOR ALL TO service_role USING (true);
CREATE POLICY "service_role_all" ON public.dutch_municipalities FOR ALL TO service_role USING (true);

-- Public read for municipalities
CREATE POLICY "public_read" ON public.dutch_municipalities FOR SELECT TO anon, authenticated USING (true);

-- SEED: Dutch municipalities
INSERT INTO public.dutch_municipalities (name, province, population, lat, lng) VALUES
('Amsterdam', 'Noord-Holland', 882633, 52.3676, 4.9041),
('Rotterdam', 'Zuid-Holland', 656050, 51.9225, 4.4792),
('Den Haag', 'Zuid-Holland', 552995, 52.0705, 4.3007),
('Utrecht', 'Utrecht', 361924, 52.0907, 5.1214),
('Eindhoven', 'Noord-Brabant', 238478, 51.4416, 5.4697),
('Groningen', 'Groningen', 234649, 53.2194, 6.5665),
('Tilburg', 'Noord-Brabant', 224702, 51.5555, 5.0913),
('Almere', 'Flevoland', 218096, 52.3508, 5.2647),
('Breda', 'Noord-Brabant', 185587, 51.5719, 4.7683),
('Nijmegen', 'Gelderland', 179073, 51.8126, 5.8372),
('Apeldoorn', 'Gelderland', 165474, 52.2112, 5.9699),
('Arnhem', 'Gelderland', 163888, 51.9851, 5.8987),
('Haarlem', 'Noord-Holland', 162902, 52.3874, 4.6462),
('Enschede', 'Overijssel', 158553, 52.2215, 6.8937),
('Amersfoort', 'Utrecht', 158005, 52.1561, 5.3878),
('Zaanstad', 'Noord-Holland', 156802, 52.4566, 4.8083),
('s-Hertogenbosch', 'Noord-Brabant', 156754, 51.6978, 5.3037),
('Zwolle', 'Overijssel', 132397, 52.5168, 6.0830),
('Leiden', 'Zuid-Holland', 125574, 52.1601, 4.4970),
('Leeuwarden', 'Friesland', 124481, 53.2012, 5.7999),
('Maastricht', 'Limburg', 121151, 50.8514, 5.6910),
('Dordrecht', 'Zuid-Holland', 119395, 51.8133, 4.6901),
('Zoetermeer', 'Zuid-Holland', 126322, 52.0572, 4.4931),
('Ede', 'Gelderland', 119802, 52.0484, 5.6650),
('Alkmaar', 'Noord-Holland', 110918, 52.6324, 4.7534),
('Delft', 'Zuid-Holland', 104463, 52.0116, 4.3571),
('Deventer', 'Overijssel', 101514, 52.2500, 6.1640),
('Venlo', 'Limburg', 101999, 51.3704, 6.1724),
('Meppel', 'Drenthe', 34893, 52.6957, 6.1944),
('Middelburg', 'Zeeland', 49161, 51.4988, 3.6136),
('Vlissingen', 'Zeeland', 44534, 51.4536, 3.5714),
('Goes', 'Zeeland', 38788, 51.5040, 3.8901)
ON CONFLICT (name) DO NOTHING;

-- GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- COMMENTS
COMMENT ON TABLE public.scraper_sources IS 'Core source configuration for Waterfall Intelligence scraper pipeline';
COMMENT ON TABLE public.raw_event_staging IS 'ELT staging area with Social Five enrichment fields';
COMMENT ON TABLE public.ai_job_queue IS 'Retry queue for rate-limited OpenAI calls';
COMMENT ON TABLE public.circuit_breaker_state IS 'Circuit breaker state per source for resilience';
COMMENT ON TABLE public.scraper_insights IS 'Observability and analytics for scraper runs';
COMMENT ON TABLE public.selector_healing_log IS 'Self-healing selector update history';
COMMENT ON TABLE public.raw_pages IS 'HTML checkpoints for delta detection and selector healing';
COMMENT ON TABLE public.dutch_municipalities IS 'Reference data for automatic nl_tier assignment';
