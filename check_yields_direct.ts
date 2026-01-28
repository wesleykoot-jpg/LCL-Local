import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Check failures
console.log("=== FAILURES ===");
const { data: failureData } = await supabase
  .from("sg_failure_log")
  .select("*")
  .limit(20);

console.log("Total failures:", failureData?.length || 0);
failureData?.forEach((f: any) => {
  console.log(`  [${f.error_type}] ${f.error_message?.substring(0, 60)}`);
});

// Check discovered sources
console.log("\n=== SOURCE DISCOVERY ===");
const { data: allSources } = await supabase
  .from("sg_sources")
  .select("id, name, last_discovered_at")
  .eq("enabled", true)
  .order("last_discovered_at", { ascending: false })
  .limit(15);

console.log("Queried sources:", allSources?.length || 0);
let discoveredCount = 0;
allSources?.forEach((s: any) => {
  if (s.last_discovered_at) discoveredCount++;
  const date = s.last_discovered_at ? new Date(s.last_discovered_at).toLocaleDateString() : "NEVER";
  console.log(`  ${s.name}: ${date}`);
});
console.log("Discovered count:", discoveredCount);

// Events breakdown
console.log("\n=== EVENTS ===");
const { data: events } = await supabase
  .from("events")
  .select("id, source_id, status");

const byStatus: any = {};
const bySrc: any = {};
events?.forEach((e: any) => {
  byStatus[e.status] = (byStatus[e.status] || 0) + 1;
  bySrc[e.source_id] = (bySrc[e.source_id] || 0) + 1;
});

console.log("By status:");
Object.entries(byStatus).forEach(([status, count]: any) => {
  console.log(`  ${status}: ${count}`);
});

console.log("\nTop 10 sources by event count:");
Object.entries(bySrc)
  .sort((a: any, b: any) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([src, count]: any) => {
    console.log(`  ${src}: ${count}`);
  });
