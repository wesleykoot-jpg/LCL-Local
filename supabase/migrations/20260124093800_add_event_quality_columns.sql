-- Migration: Add Event Quality Scoring and Healing tracking
-- Description: Adds columns to track event completeness and automated healing attempts.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS quality_score NUMERIC(3,2) DEFAULT 0.0 CHECK (quality_score >= 0 AND quality_score <= 1.0),
ADD COLUMN IF NOT EXISTS last_healed_at TIMESTAMPTZ;

-- Ensure staging has detail_html for enrichment
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS detail_html TEXT;

COMMENT ON COLUMN public.events.quality_score IS 'A score from 0 to 1 representing the completeness and reliability of the event data.';
COMMENT ON COLUMN public.events.last_healed_at IS 'The timestamp when the event was last automatically enriched/healed.';
COMMENT ON COLUMN public.raw_event_staging.detail_html IS 'Full HTML content from the detail URL, used for deep scraping and enrichment.';
