/**
 * Check database state - pipeline_status column and data
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

console.log("Checking database state...\n");

// Check raw_event_staging
const { data: stagingData, error: stagingError } = await supabase
  .from("raw_event_staging")
  .select("id, title, pipeline_status, status, source_url")
  .limit(5);

if (stagingError) {
  console.log("❌ Staging table error:", stagingError.message);
} else {
  console.log(`📊 raw_event_staging: ${stagingData?.length || 0} sample rows`);
  if (stagingData && stagingData.length > 0) {
    console.log("\nSample data:");
    stagingData.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.title?.substring(0, 40) || "No title"}...`);
      console.log(`     pipeline_status: ${row.pipeline_status}`);
      console.log(`     status: ${row.status}`);
    });
    
    console.log("\nColumn check:");
    console.log(`  - Has pipeline_status column: ${"pipeline_status" in stagingData[0]}`);
    console.log(`  - Has status column: ${"status" in stagingData[0]}`);
  }
}

// Count total
const { count: totalStaging } = await supabase
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true });

const { count: totalEvents } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log("\n📊 Total counts:");
console.log(`  - raw_event_staging: ${totalStaging || 0}`);
console.log(`  - events: ${totalEvents || 0}`);

// Check scraper_sources
const { data: sources } = await supabase
  .from("scraper_sources")
  .select("id, name, url, enabled")
  .eq("enabled", true)
  .limit(5);

console.log("\n📊 Enabled scraper sources:");
sources?.forEach(s => {
  console.log(`  - ${s.name}: ${s.url?.substring(0, 50)}...`);
});
