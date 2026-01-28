import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log("=== YIELD ANALYSIS ===\n");

// 1. Overall stats
const { count: totalSources } = await supabase
  .from("sg_sources")
  .select("*", { count: "exact" })
  .eq("enabled", true);

const { count: discoveredSources } = await supabase
  .from("sg_sources")
  .select("*", { count: "exact" })
  .eq("enabled", true)
  .not("last_discovered_at", "is", null);

console.log(`Sources: ${discoveredSources} of ${totalSources} discovered`);

// 2. Pipeline distribution
const stages = ["discovered", "analyzing", "awaiting_fetch", "extracted", "ready_to_persist", "indexed"];
console.log("\nPipeline queue:");
for (const stage of stages) {
  const { count } = await supabase
    .from("sg_pipeline_queue")
    .select("*", { count: "exact" })
    .eq("stage", stage);
  console.log(`  ${stage}: ${count}`);
}

// 3. Final output
const { count: published } = await supabase
  .from("events")
  .select("*", { count: "exact" })
  .eq("status", "published");

console.log(`\nPublished events: ${published}`);

// 4. Top sources
const { data: events } = await supabase
  .from("events")
  .select("source_id")
  .eq("status", "published");

const bySource: any = {};
events?.forEach((e: any) => {
  bySource[e.source_id] = (bySource[e.source_id] || 0) + 1;
});

const sorted = Object.entries(bySource)
  .sort((a: any, b: any) => b[1] - a[1])
  .slice(0, 10);

console.log("\nTop sources:");
sorted.forEach(([id, count]: any) => {
  console.log(`  ${id}: ${count} events`);
});

// 5. Failure summary
const { count: failureCount } = await supabase
  .from("sg_failure_log")
  .select("*", { count: "exact" });

console.log(`\nTotal failures logged: ${failureCount}`);
