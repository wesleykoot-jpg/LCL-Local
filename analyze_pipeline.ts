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

// Check raw_event_staging statuses
const { data: staging } = await supabase
  .from("raw_event_staging")
  .select("status")
  .limit(100);

const statusCounts: Record<string, number> = {};
staging?.forEach(row => {
  statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
});

console.log("📊 raw_event_staging status breakdown:");
Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count} rows`);
});

// Check ai_job_queue
const { count: queueCount } = await supabase
  .from("ai_job_queue")
  .select("*", { count: "exact", head: true });

console.log(`\n🤖 ai_job_queue: ${queueCount || 0} jobs`);

// Check events table
const { count: eventsCount } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log(`📅 events table: ${eventsCount || 0} events\n`);

console.log("=== Pipeline Analysis ===");
console.log("\nCurrent state:");
console.log(`1. Scraper fetched: ${staging?.length || 0} events to staging`);
console.log(`2. AI queue has: ${queueCount || 0} jobs waiting`);
console.log(`3. Final events: ${eventsCount || 0} published\n`);

console.log("Expected flow:");
console.log("  raw_event_staging (awaiting_fetch)");
console.log("    → Fetch detail pages");
console.log("    → Update to 'awaiting_enrichment'");
console.log("    → claim_staging_rows() picks them up");
console.log("    → Process with AI");
console.log("    → Insert into events table");
console.log("    → Trigger creates ai_job_queue for embeddings");
