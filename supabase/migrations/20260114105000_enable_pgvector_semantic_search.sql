-- Migration: Enable pgvector for Semantic Event Discovery
-- Purpose: Enable "vibe search" and "find similar events" functionality
-- Uses OpenAI/Gemini embeddings (1536 dimensions) for semantic similarity

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Add embedding column to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for vector similarity search (HNSW for fast approximate search)
-- Using cosine distance as similarity metric (standard for embeddings)
CREATE INDEX IF NOT EXISTS idx_events_embedding 
  ON public.events 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add metadata columns for embedding management
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS embedding_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_version INTEGER DEFAULT 1;

-- Create index for finding events without embeddings (for batch processing)
CREATE INDEX IF NOT EXISTS idx_events_no_embedding
  ON public.events(created_at DESC)
  WHERE embedding IS NULL;

-- RPC function to find similar events using vector similarity
CREATE OR REPLACE FUNCTION match_events(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_category text DEFAULT NULL
) RETURNS TABLE (
  event_id uuid,
  title text,
  description text,
  category text,
  event_type text,
  venue_name text,
  event_date timestamptz,
  event_time text,
  image_url text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS event_id,
    e.title,
    e.description,
    e.category,
    e.event_type,
    e.venue_name,
    e.event_date,
    e.event_time,
    e.image_url,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.events e
  WHERE 
    e.embedding IS NOT NULL
    AND (filter_category IS NULL OR e.category = filter_category)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC function to find events similar to a given event
CREATE OR REPLACE FUNCTION find_similar_events(
  event_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
) RETURNS TABLE (
  similar_event_id uuid,
  title text,
  description text,
  category text,
  event_type text,
  venue_name text,
  event_date timestamptz,
  event_time text,
  image_url text,
  similarity float
) AS $$
DECLARE
  source_embedding vector(1536);
BEGIN
  -- Get the embedding of the source event
  SELECT embedding INTO source_embedding
  FROM public.events
  WHERE id = event_id;

  IF source_embedding IS NULL THEN
    RAISE EXCEPTION 'Event % has no embedding', event_id;
  END IF;

  -- Find similar events
  RETURN QUERY
  SELECT
    e.id AS similar_event_id,
    e.title,
    e.description,
    e.category,
    e.event_type,
    e.venue_name,
    e.event_date,
    e.event_time,
    e.image_url,
    1 - (e.embedding <=> source_embedding) AS similarity
  FROM public.events e
  WHERE 
    e.id != event_id
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> source_embedding) > match_threshold
  ORDER BY e.embedding <=> source_embedding ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC function for "vibe search" - natural language query to events
-- This will be used by the frontend to search by description/vibe
-- The embedding is generated client-side or via Edge Function and passed here
CREATE OR REPLACE FUNCTION search_events_by_vibe(
  vibe_embedding vector(1536),
  user_lat double precision DEFAULT NULL,
  user_long double precision DEFAULT NULL,
  radius_km double precision DEFAULT 25,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 20
) RETURNS TABLE (
  event_id uuid,
  title text,
  description text,
  category text,
  event_type text,
  venue_name text,
  event_date timestamptz,
  event_time text,
  image_url text,
  similarity float,
  distance_km numeric
) AS $$
DECLARE
  user_point geography;
BEGIN
  -- Create geography point from user coordinates if provided
  IF user_lat IS NOT NULL AND user_long IS NOT NULL THEN
    user_point := ST_SetSRID(ST_MakePoint(user_long, user_lat), 4326)::geography;
  END IF;

  RETURN QUERY
  SELECT
    e.id AS event_id,
    e.title,
    e.description,
    e.category,
    e.event_type,
    e.venue_name,
    e.event_date,
    e.event_time,
    e.image_url,
    1 - (e.embedding <=> vibe_embedding) AS similarity,
    CASE
      WHEN user_point IS NULL THEN NULL
      ELSE ST_Distance(e.location, user_point) / 1000.0
    END AS distance_km
  FROM public.events e
  WHERE 
    e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> vibe_embedding) > match_threshold
    AND (user_point IS NULL OR ST_DWithin(e.location, user_point, radius_km * 1000))
  ORDER BY e.embedding <=> vibe_embedding ASC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION match_events(vector(1536), float, int, text) IS 
  'Find events similar to a given embedding vector. Returns events sorted by cosine similarity.';

COMMENT ON FUNCTION find_similar_events(uuid, float, int) IS 
  'Find events similar to a specific event. Returns events sorted by cosine similarity.';

COMMENT ON FUNCTION search_events_by_vibe(vector(1536), double precision, double precision, double precision, float, int) IS 
  'Search events by natural language "vibe" using embedding similarity. Supports location filtering.';
