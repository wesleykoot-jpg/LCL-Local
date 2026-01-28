/**
 * Apply Waterfall v2 Schema via Supabase RPC
 * 
 * Run with: deno run -A scripts/apply_waterfall_v2_deno.ts
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import "jsr:@std/dotenv/load";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  console.error("Set them in .env file or environment");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("🔧 Applying Waterfall v2 schema...\n");

// Check if columns exist on scraper_sources
const { data: scraperCols } = await supabase.rpc("get_table_columns", { table_name: "scraper_sources" }).single();

console.log("Checking scraper_sources columns...");

// Try to select nl_tier to see if it exists
const { data: testNlTier, error: nlTierError } = await supabase
  .from("scraper_sources")
  .select("nl_tier")
  .limit(1);

if (nlTierError && nlTierError.code === "42703") {
  console.log("  ❌ nl_tier column missing - needs migration");
} else {
  console.log("  ✅ nl_tier column exists");
}

const { data: testHealth, error: healthError } = await supabase
  .from("scraper_sources")
  .select("health_score")
  .limit(1);

if (healthError && healthError.code === "42703") {
  console.log("  ❌ health_score column missing - needs migration");
} else {
  console.log("  ✅ health_score column exists");
}

// Check events table
console.log("\nChecking events columns...");

const socialFiveColumns = [
  "doors_open_time",
  "language_profile", 
  "interaction_mode",
  "structured_address",
  "social_five_score"
];

for (const col of socialFiveColumns) {
  const { error } = await supabase
    .from("events")
    .select(col)
    .limit(1);
  
  if (error && error.code === "42703") {
    console.log(`  ❌ ${col} column missing - needs migration`);
  } else {
    console.log(`  ✅ ${col} column exists`);
  }
}

console.log("\n📋 Summary:");
console.log("If any columns are missing, run this SQL in Supabase Dashboard:");
console.log("https://supabase.com/dashboard/project/mlpefjsbriqgxcaqxhic/sql/new");
console.log("\nSQL file: scripts/apply_waterfall_v2.sql");
