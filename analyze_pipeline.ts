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

console.log("=== Analyzing Event Processing Pipeline ===\n");

// Check raw_event_staging pipeline statuses
const { data: staging } = await supabase
  .from("raw_event_staging")
  .select("pipeline_status")
  .limit(100);

const statusCounts: Record<string, number> = {};
staging?.forEach(row => {
  const status = row.pipeline_status || "null";
  statusCounts[status] = (statusCounts[status] || 0) + 1;
});

console.log("📊 raw_event_staging pipeline_status breakdown:");
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count} rows`);
});

// Check events table
const { count: eventsCount } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log(`📅 events table: ${eventsCount || 0} events\n`);

console.log("=== Pipeline Analysis ===");
console.log("\nCurrent state:");
console.log(`1. Scraper fetched: ${staging?.length || 0} events to staging`);
console.log(`2. Final events: ${eventsCount || 0} published\n`);

console.log("Expected flow:");
console.log("  raw_event_staging (discovered/awaiting_enrichment)");
console.log("    → DB trigger calls enrichment-worker");
console.log("    → Enrichment sets ready_to_index");
console.log("    → Indexing worker upserts to events");
