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

console.log("🔧 MIGRATION REQUIRED\n");
console.log("The raw_event_staging table is missing a UNIQUE constraint on source_url.");
console.log("This is preventing the scraper from upserting events.\n");

console.log("📋 Please run this SQL in your Supabase SQL Editor:");
console.log("   (Dashboard → SQL Editor → New Query)\n");
console.log("═".repeat(70));
console.log(`
-- Remove any duplicate source_urls (keep oldest)
DELETE FROM public.raw_event_staging a
USING public.raw_event_staging b
WHERE a.id > b.id 
  AND a.source_url = b.source_url;

-- Add UNIQUE constraint to enable upserts
ALTER TABLE public.raw_event_staging
DROP CONSTRAINT IF EXISTS raw_event_staging_source_url_unique;

ALTER TABLE public.raw_event_staging
ADD CONSTRAINT raw_event_staging_source_url_unique 
UNIQUE (source_url);
`);
console.log("═".repeat(70));

console.log("\n✅ After running the SQL, verify with:");
console.log("   deno run --allow-all check_staging_constraints.ts\n");

console.log("Then run the full pipeline:");
console.log("   deno run --allow-all run_pipeline.ts\n");
