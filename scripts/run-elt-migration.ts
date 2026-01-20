
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS scraper;

-- Create staging table for ELT pipeline
CREATE TABLE IF NOT EXISTS scraper.raw_event_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.scraper_sources(id),
    url TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    detail_html TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    fetch_metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast batch fetching
CREATE INDEX IF NOT EXISTS idx_raw_staging_status ON scraper.raw_event_staging(status);
CREATE INDEX IF NOT EXISTS idx_raw_staging_source_id ON scraper.raw_event_staging(source_id);

-- Add simple trigger for updated_at
CREATE OR REPLACE FUNCTION scraper.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_raw_event_staging_modtime ON scraper.raw_event_staging;

CREATE TRIGGER update_raw_event_staging_modtime
    BEFORE UPDATE ON scraper.raw_event_staging
    FOR EACH ROW
    EXECUTE PROCEDURE scraper.update_updated_at_column();

-- Enable RLS and policies
ALTER TABLE scraper.raw_event_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for service role" ON scraper.raw_event_staging;

CREATE POLICY "Enable read access for service role" ON scraper.raw_event_staging
    FOR ALL
    USING ( auth.role() = 'service_role' );

-- Grant usage to authenticated/service_role
GRANT USAGE ON SCHEMA scraper TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA scraper TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA scraper TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA scraper TO postgres, anon, authenticated, service_role;
`;

console.log("Executing ELT migration...");

// Execute via rpc('exec_sql') if available, otherwise try raw fetch
// Supabase JS client doesn't have raw SQL execution, so we use the REST API directly

const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": supabaseKey,
    "Authorization": `Bearer ${supabaseKey}`,
    "Prefer": "return=representation"
  },
  body: JSON.stringify({ sql_query: sql })
});

if (!response.ok) {
  // If exec_sql doesn't exist, try direct postgres connection via management API
  console.log("exec_sql RPC not available, trying alternative...");
  
  // Alternative: Use the Supabase Management API (requires access token)
  // For now, let's just print a message
  console.log("\n⚠️  Cannot execute SQL directly via API.");
  console.log("Please run the following SQL manually in the Supabase SQL Editor:");
  console.log("============================================================");
  console.log(sql);
  console.log("============================================================");
  Deno.exit(1);
}

const result = await response.json();
console.log("Migration executed successfully!", result);
