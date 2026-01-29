-- Migration: SG Quality Dashboard daily stats
-- Creates a materialized view for daily per-source quality metrics

-- 1) Materialized view with daily stats
CREATE MATERIALIZED VIEW IF NOT EXISTS public.sg_source_daily_stats AS
SELECT
  DATE_TRUNC('day', COALESCE(q.persisted_at, q.last_failure_at, q.updated_at))::date AS day,
  q.source_id,
  s.name AS source_name,
  s.city,
  COUNT(*) FILTER (WHERE q.stage IN ('indexed', 'failed')) AS total_attempts,
  COUNT(*) FILTER (WHERE q.stage = 'indexed') AS indexed_count,
  COUNT(*) FILTER (WHERE q.stage = 'failed') AS failed_count,
  ROUND(
    (COUNT(*) FILTER (WHERE q.stage = 'indexed')::numeric / NULLIF(COUNT(*) FILTER (WHERE q.stage IN ('indexed', 'failed')), 0)) * 100,
    2
  ) AS success_rate,
  ROUND(
    AVG(LENGTH(COALESCE(q.extracted_data->'what'->>'description', ''))) FILTER (WHERE q.stage = 'indexed'),
    2
  ) AS avg_description_length,
  ROUND(
    (COUNT(*) FILTER (WHERE q.stage = 'indexed' AND q.geocode_status IN ('success', 'cached'))::numeric / NULLIF(COUNT(*) FILTER (WHERE q.stage = 'indexed'), 0)) * 100,
    2
  ) AS geocode_hit_rate
FROM public.sg_pipeline_queue q
JOIN public.sg_sources s ON s.id = q.source_id
WHERE q.source_id IS NOT NULL
GROUP BY 1, 2, 3, 4;

-- 2) Indexes for fast filtering
CREATE UNIQUE INDEX IF NOT EXISTS idx_sg_source_daily_stats_day_source
  ON public.sg_source_daily_stats (day, source_id);

CREATE INDEX IF NOT EXISTS idx_sg_source_daily_stats_city
  ON public.sg_source_daily_stats (city);

-- 3) Refresh helper function
CREATE OR REPLACE FUNCTION public.refresh_sg_source_daily_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.sg_source_daily_stats;
END;
$$;
