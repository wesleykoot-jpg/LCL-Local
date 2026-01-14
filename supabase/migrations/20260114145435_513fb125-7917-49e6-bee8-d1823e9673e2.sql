-- Create a secure app_secrets table for storing the service role key
CREATE TABLE IF NOT EXISTS app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS - only service_role can access (no policies = only service_role)
ALTER TABLE app_secrets ENABLE ROW LEVEL SECURITY;

-- Update the trigger function to read from app_secrets table
CREATE OR REPLACE FUNCTION public.trigger_scrape_coordinator()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_role_key text;
BEGIN
  -- Get the service role key from our secrets table
  SELECT value INTO v_service_role_key 
  FROM app_secrets 
  WHERE key = 'service_role_key';
  
  IF v_service_role_key IS NULL THEN
    RAISE EXCEPTION 'Service role key not found in app_secrets table. Please insert it with: INSERT INTO app_secrets (key, value) VALUES (''service_role_key'', ''your-key-here'');';
  END IF;

  PERFORM net.http_post(
    url := 'https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/scrape-coordinator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := '{"triggerWorker": true}'::jsonb
  );
END;
$$;