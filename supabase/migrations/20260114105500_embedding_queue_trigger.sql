-- Migration: Database Trigger for Auto-Generating Event Embeddings
-- Purpose: Automatically queue embedding generation when new events are created

-- Create a table to queue embedding generation jobs
CREATE TABLE IF NOT EXISTS public.embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_embedding_queue_pending 
  ON embedding_queue(created_at ASC) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_embedding_queue_event 
  ON embedding_queue(event_id);

-- Enable RLS
ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on embedding_queue" 
  ON embedding_queue FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Function to queue embedding generation
CREATE OR REPLACE FUNCTION queue_embedding_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if event doesn't already have an embedding
  IF NEW.embedding IS NULL THEN
    INSERT INTO public.embedding_queue (event_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on event insert
DROP TRIGGER IF EXISTS trigger_queue_embedding_on_insert ON public.events;
CREATE TRIGGER trigger_queue_embedding_on_insert
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION queue_embedding_generation();

-- Trigger on event update (if embedding is cleared)
DROP TRIGGER IF EXISTS trigger_queue_embedding_on_update ON public.events;
CREATE TRIGGER trigger_queue_embedding_on_update
  AFTER UPDATE ON public.events
  FOR EACH ROW
  WHEN (NEW.embedding IS NULL AND OLD.embedding IS NOT NULL)
  EXECUTE FUNCTION queue_embedding_generation();

-- Function to get pending embedding jobs
CREATE OR REPLACE FUNCTION get_pending_embedding_jobs(batch_size INT DEFAULT 10)
RETURNS TABLE (
  job_id UUID,
  event_id UUID,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE embedding_queue
  SET 
    status = 'processing',
    processed_at = now()
  WHERE id IN (
    SELECT id
    FROM embedding_queue
    WHERE status = 'pending'
      AND attempts < max_attempts
    ORDER BY created_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING 
    embedding_queue.id AS job_id,
    embedding_queue.event_id,
    embedding_queue.attempts;
END;
$$ LANGUAGE plpgsql;

-- Function to mark embedding job as completed
CREATE OR REPLACE FUNCTION complete_embedding_job(job_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE embedding_queue
  SET 
    status = 'completed',
    processed_at = now()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark embedding job as failed
CREATE OR REPLACE FUNCTION fail_embedding_job(
  job_id UUID,
  error_msg TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE embedding_queue
  SET 
    status = CASE 
      WHEN attempts + 1 >= max_attempts THEN 'failed'
      ELSE 'pending'
    END,
    attempts = attempts + 1,
    error_message = error_msg,
    processed_at = now()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE embedding_queue IS 
  'Queue for generating embeddings for events. Jobs are automatically created when events are inserted.';

COMMENT ON FUNCTION queue_embedding_generation() IS 
  'Trigger function that queues embedding generation for new events without embeddings.';

COMMENT ON FUNCTION get_pending_embedding_jobs(INT) IS 
  'Gets and locks pending embedding jobs for processing. Uses SKIP LOCKED for concurrency.';
