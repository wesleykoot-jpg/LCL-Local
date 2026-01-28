/**
 * Apply missing scraper_sources columns
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

console.log("🔧 Applying missing scraper_sources columns...\n");

// Use raw SQL to add the missing columns
const migrations = [
  `ALTER TABLE public.scraper_sources ADD COLUMN IF NOT EXISTS volatility_score numeric DEFAULT 0.5 CHECK (volatility_score >= 0 AND volatility_score <= 1)`,
  `ALTER TABLE public.scraper_sources ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz`,
  `ALTER TABLE public.scraper_sources ADD COLUMN IF NOT EXISTS consecutive_errors integer DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_scraper_sources_next_scrape_at ON public.scraper_sources (next_scrape_at)`,
];

for (const sql of migrations) {
  console.log(`Running: ${sql.substring(0, 60)}...`);
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    // Try alternative method - direct SQL via REST endpoint doesn't work, 
    // so we need to use Supabase Dashboard or CLI
    console.log(`⚠️  Cannot run SQL directly. Error: ${error.message}`);
    console.log("   This migration needs to be applied via Supabase Dashboard SQL editor.");
  } else {
    console.log("   ✅ Success");
  }
}

console.log("\n📋 SQL to run in Supabase Dashboard:");
console.log("---");
console.log(`
ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS volatility_score numeric DEFAULT 0.5 CHECK (volatility_score >= 0 AND volatility_score <= 1);

ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS next_scrape_at timestamptz;

ALTER TABLE public.scraper_sources 
ADD COLUMN IF NOT EXISTS consecutive_errors integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_scraper_sources_next_scrape_at 
ON public.scraper_sources (next_scrape_at);
`);
console.log("---");

// Check what columns exist now
const { data, error } = await supabase
  .from("scraper_sources")
  .select("*")
  .limit(1);

if (error) {
  console.log("\n❌ Error checking scraper_sources:", error.message);
} else if (data && data.length > 0) {
  console.log("\n📊 Current scraper_sources columns:");
  console.log(Object.keys(data[0]).join(", "));
}
