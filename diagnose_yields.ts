import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Check failures
const { data: failures } = await supabase
  .from("sg_failure_log")
  .select("error_type, source_id", { count: "exact" })
  .limit(500);

const errorTypes: any = {};
failures?.forEach((f: any) => {
  errorTypes[f.error_type] = (errorTypes[f.error_type] || 0) + 1;
});

console.log("=== FAILURES ===");
console.log(`Total: ${failures?.length || 0}`);
Object.entries(errorTypes).sort((a: any, b: any) => b[1] - a[1]).forEach(([type, count]: any) => {
  console.log(`  ${type}: ${count}`);
});

// Check pipeline stages
console.log("\n=== PIPELINE QUEUE ===");
const stages = ["discovered", "analyzing", "awaiting_fetch", "extracted", "ready_to_persist", "indexed"];
for (const stage of stages) {
  const { count } = await supabase
    .from("sg_pipeline_queue")
    .select("*", { count: "exact" })
    .eq("stage", stage);
  console.log(`${stage}: ${count}`);
}

// Check event counts
console.log("\n=== EVENT COUNTS ===");
const { count: totalPublished } = await supabase
  .from("events")
  .select("*", { count: "exact" })
  .eq("status", "published");
console.log(`Total published: ${totalPublished}`);

// Events by source
const { data: events } = await supabase
  .from("events")
  .select("source_id")
  .eq("status", "published");

const eventsBySource: any = {};
events?.forEach((e: any) => {
  eventsBySource[e.source_id] = (eventsBySource[e.source_id] || 0) + 1;
});

console.log("\nTop sources by event count:");
Object.entries(eventsBySource)
  .sort((a: any, b: any) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([src, count]: any) => console.log(`  ${src}: ${count}`));

// Sources never discovered
const { count: neverDiscovered } = await supabase
  .from("sg_sources")
  .select("*", { count: "exact" })
  .eq("enabled", true)
  .is("last_discovered_at", null);

console.log(`\n=== SOURCES ===`);
console.log(`Never discovered: ${neverDiscovered}`);

// Recent sources
const { data: recentSources } = await supabase
  .from("sg_sources")
  .select("name, last_discovered_at")
  .eq("enabled", true)
  .order("last_discovered_at", { ascending: false })
  .limit(10);

console.log("\nRecent sources:");
recentSources?.forEach((s: any) => {
  const date = s.last_discovered_at ? new Date(s.last_discovered_at).toLocaleDateString() : "never";
  console.log(`  ${s.name}: ${date}`);
});
