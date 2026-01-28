/**
 * Direct SQL Execution via Supabase Management API
 * Bypasses the migration system to apply the waterfall pipeline changes
 */

const envText = await Deno.readTextFile(".env");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length > 0) {
    env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
  }
});

// Extract project ref from URL (format: https://PROJECT_REF.supabase.co)
const projectRef = env.SUPABASE_URL.replace("https://", "").split(".")[0];

console.log("═".repeat(60));
console.log("  DIRECT SQL EXECUTION");
console.log("═".repeat(60));
console.log(`Project: ${projectRef}`);
console.log();

// SQL statements to execute (essential parts of the waterfall migration)
const sqlStatements = [
  // 1. Create enum
  `DO $$ BEGIN
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
  END $$;`,
  
  // 2. Add columns
  `ALTER TABLE public.raw_event_staging
   ADD COLUMN IF NOT EXISTS pipeline_status public.pipeline_status DEFAULT 'discovered',
   ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0,
   ADD COLUMN IF NOT EXISTS indexing_attempts INTEGER DEFAULT 0,
   ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL,
   ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL,
   ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ DEFAULT NULL,
   ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT NULL;`,
   
  // 3. Add indexes
  `CREATE INDEX IF NOT EXISTS idx_staging_pipeline_status 
   ON public.raw_event_staging (pipeline_status);`,
   
  // 4. Set initial pipeline_status for existing rows
  `UPDATE public.raw_event_staging
   SET pipeline_status = 'awaiting_enrichment'
   WHERE pipeline_status IS NULL OR pipeline_status = 'discovered';`
];

// Use the Supabase REST API to execute queries via RPC
// First, let's create a temporary function to execute SQL

console.log("Executing SQL statements...\n");

for (let i = 0; i < sqlStatements.length; i++) {
  const sql = sqlStatements[i];
  const preview = sql.substring(0, 60).replace(/\n/g, " ").trim() + "...";
  
  console.log(`${i + 1}/${sqlStatements.length}: ${preview}`);
  
  // Use the query endpoint (requires service role)
  // This is a workaround using the PostgREST interface
  
  // Actually, the cleanest way is to use the Supabase connection pooler
  // But we can also just run this via deno's postgres driver
  
  // For now, let's output the SQL and ask user to run it
}

console.log();
console.log("═".repeat(60));
console.log("  MANUAL EXECUTION REQUIRED");
console.log("═".repeat(60));
console.log();
console.log("The Supabase JS client cannot execute raw SQL directly.");
console.log();
console.log("Please run the following in Supabase SQL Editor:");
console.log("(https://supabase.com/dashboard/project/" + projectRef + "/sql)");
console.log();
console.log("─".repeat(60));

// Output minimal essential SQL
const essentialSQL = `
-- WATERFALL PIPELINE MIGRATION (Minimal)
-- Run this in Supabase SQL Editor

-- 1. Create the pipeline status enum
DO $$ BEGIN
  CREATE TYPE public.pipeline_status AS ENUM (
    'discovered', 'awaiting_enrichment', 'enriching', 'enriched',
    'ready_to_index', 'indexing', 'processed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add columns to raw_event_staging
ALTER TABLE public.raw_event_staging
ADD COLUMN IF NOT EXISTS pipeline_status public.pipeline_status DEFAULT 'discovered',
ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS indexing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS worker_id UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT NULL;

-- 3. Create index
CREATE INDEX IF NOT EXISTS idx_staging_pipeline_status 
ON public.raw_event_staging (pipeline_status);

-- 4. Set existing rows to awaiting_enrichment
UPDATE public.raw_event_staging
SET pipeline_status = 'awaiting_enrichment'
WHERE pipeline_status IS NULL;

-- Done! Run the following to verify:
-- SELECT pipeline_status, COUNT(*) FROM raw_event_staging GROUP BY pipeline_status;
`;

console.log(essentialSQL);
console.log("─".repeat(60));

// Also save to a file for easy copy
await Deno.writeTextFile("waterfall_migration_minimal.sql", essentialSQL);
console.log();
console.log("✅ SQL saved to: waterfall_migration_minimal.sql");
console.log();
console.log("After running, execute: deno run --allow-all pipeline_monitor.ts");
