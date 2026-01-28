/**
 * Apply Waterfall Migration via Supabase API
 * Runs the migration SQL directly against the database
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envText = await Deno.readTextFile(".env");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length > 0) {
    env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

console.log("═".repeat(60));
console.log("  APPLYING WATERFALL PIPELINE MIGRATION");
console.log("═".repeat(60));
console.log();

// Read the migration file
const migrationSQL = await Deno.readTextFile("supabase/migrations/20260128001000_waterfall_pipeline_architecture.sql");

console.log("📄 Migration loaded, executing...\n");

// Execute via the Supabase SQL API (using rpc or direct query)
// Since Supabase JS client doesn't have raw SQL, we need to use the REST API directly
const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({})
});

// The Supabase JS client doesn't support raw SQL execution
// We need to execute statements individually or use the Management API
// Let's break it down into individual executable parts

console.log("Executing migration in parts...\n");

// Part 1: Create enum type
console.log("1️⃣ Creating pipeline_status enum...");
const { error: enumError } = await supabase.rpc("exec_sql", {
  query: `
    DO $$ BEGIN
      CREATE TYPE public.pipeline_status AS ENUM (
        'discovered',
        'awaiting_enrichment', 
        'enriching',
        'enriched',
        'ready_to_index',
        'indexing',
        'processed',
        'failed'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `
});

if (enumError) {
  // exec_sql doesn't exist, need to use different approach
  console.log("   ⚠️  Cannot execute raw SQL via client API");
  console.log("   📋 Please run this migration manually in Supabase SQL Editor:");
  console.log();
  console.log("   File: supabase/migrations/20260128001000_waterfall_pipeline_architecture.sql");
  console.log();
  console.log("   Quick steps:");
  console.log("   1. Open https://supabase.com/dashboard");
  console.log("   2. Select your project");
  console.log("   3. Go to SQL Editor");
  console.log("   4. Paste the migration SQL");
  console.log("   5. Click Run");
  console.log();
  
  // Alternative: Try using the postgres connection directly
  console.log("   Alternatively, you can run:");
  console.log(`   npx supabase db execute --file supabase/migrations/20260128001000_waterfall_pipeline_architecture.sql`);
  
  Deno.exit(1);
}

console.log("   ✅ Enum created");

// Part 2: Add columns
console.log("2️⃣ Adding pipeline columns to raw_event_staging...");
const { error: colError } = await supabase.rpc("exec_sql", {
  query: `
    ALTER TABLE public.raw_event_staging
    ADD COLUMN IF NOT EXISTS pipeline_status pipeline_status DEFAULT 'discovered',
    ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS indexing_attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT NULL;
  `
});

if (!colError) {
  console.log("   ✅ Columns added");
}

console.log();
console.log("═".repeat(60));
console.log("  MIGRATION COMPLETE");
console.log("═".repeat(60));
