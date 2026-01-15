-- Create comprehensive error logging table
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  source TEXT NOT NULL, -- e.g., 'scrape-worker', 'source-discovery', 'api', 'coordinator'
  function_name TEXT, -- edge function name if applicable
  message TEXT NOT NULL,
  error_code TEXT, -- e.g., '409', '500', 'TIMEOUT', 'PARSE_ERROR'
  error_type TEXT, -- e.g., 'PostgrestError', 'FetchError', 'ValidationError'
  stack_trace TEXT, -- optional stack trace
  context JSONB DEFAULT '{}', -- additional context like source_id, job_id, url, etc.
  request_id TEXT, -- for correlating with Supabase request IDs
  user_agent TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_error_logs_timestamp ON public.error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_level ON public.error_logs(level);
CREATE INDEX idx_error_logs_source ON public.error_logs(source);
CREATE INDEX idx_error_logs_error_code ON public.error_logs(error_code);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved) WHERE NOT resolved;

-- Enable RLS (but allow edge functions with service role to write)
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (edge functions) to insert/select
CREATE POLICY "Service role can manage error logs"
ON public.error_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.error_logs IS 'Centralized error logging for debugging. Captures API errors, edge function failures, and system issues.';

-- Create a function to auto-cleanup old logs (keep 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.error_logs
  WHERE timestamp < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;