import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const envText = await Deno.readTextFile(".env");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length > 0) {
    env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
  }
});

// Parse the Supabase URL to get the database connection string
const supabaseUrl = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Applying migration via direct PostgreSQL connection...\n");

// For Supabase, the connection string format is usually:
// postgresql://postgres:[password]@[host]:5432/postgres
// But we'll try to use the Supabase client with raw SQL

const supabase = createClient(supabaseUrl, serviceKey);

console.log("Step 1: Removing duplicates (if any)...");
try {
  // Use a direct SQL query via Supabase's database connection
  const { data: deleteResult, error: deleteError } = await supabase
    .from("raw_event_staging")
    .delete()
    .in("id", 
      // This is a workaround - we'll need to fetch duplicates first
      []
    );
  
  console.log("Duplicates check skipped (need direct SQL access)");
} catch (e) {
  console.log("Duplicate removal skipped:", e.message);
}

console.log("\nStep 2: Adding UNIQUE constraint via ALTER TABLE...");
console.log("Note: This requires database admin access.");
console.log("\nPlease run this SQL in your Supabase SQL Editor:\n");
console.log("---");
console.log(`
-- Remove duplicates first
DELETE FROM public.raw_event_staging a
USING public.raw_event_staging b
WHERE a.id > b.id 
  AND a.source_url = b.source_url;

-- Add UNIQUE constraint
ALTER TABLE public.raw_event_staging
ADD CONSTRAINT raw_event_staging_source_url_unique 
UNIQUE (source_url);
`);
console.log("---\n");

console.log("After running the SQL, test with:");
console.log("  deno run --allow-all check_staging_constraints.ts");
