import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

console.log("=== COMPREHENSIVE YIELD ANALYSIS ===\n");

// 1. Get all events with source info
const eventsResp = await supabase
  .from("events")
  .select("source_id, status");

const eventData = eventsResp.data || [];

const eventsByStatus: any = {};
const eventsBySource: any = {};

eventData.forEach((e: any) => {
  eventsByStatus[e.status] = (eventsByStatus[e.status] || 0) + 1;
  eventsBySource[e.source_id] = (eventsBySource[e.source_id] || 0) + 1;
});

console.log("TOTAL EVENTS: " + eventData.length);
console.log("By status:");
Object.entries(eventsByStatus).forEach(([status, count]: any) => {
  console.log(`  ${status}: ${count}`);
});

console.log(`\nEvents per source (published only):`);
const publishedBySource: any = {};
eventData.forEach((e: any) => {
  if (e.status === "published") {
    publishedBySource[e.source_id] = (publishedBySource[e.source_id] || 0) + 1;
  }
});

Object.entries(publishedBySource)
  .sort((a: any, b: any) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([src, count]: any) => {
    console.log(`  ${src}: ${count} events`);
  });

// 2. Get source info
console.log("\n=== SOURCES ANALYSIS ===");
const sourcesResp = await supabase
  .from("sg_sources")
  .select("id, name, last_discovered_at, enabled");

const sources = sourcesResp.data || [];

console.log("Total sources: " + sources.length);

let discovered = 0;
let neverDiscovered = 0;

sources.forEach((s: any) => {
  if (s.last_discovered_at) {
    discovered++;
  } else {
    neverDiscovered++;
  }
});

console.log(`Sources discovered: ${discovered}`);
console.log(`Sources NEVER discovered: ${neverDiscovered}`);
console.log(`Enabled: ${sources.filter((s: any) => s.enabled).length}`);

// Show recent discoveries
console.log("\nMost recently discovered sources:");
sources
  .filter((s: any) => s.last_discovered_at)
  .sort((a: any, b: any) => {
    return new Date(b.last_discovered_at).getTime() - new Date(a.last_discovered_at).getTime();
  })
  .slice(0, 10)
  .forEach((s: any) => {
    const date = new Date(s.last_discovered_at).toLocaleString();
    const events = publishedBySource[s.id] || 0;
    console.log(`  ${s.name}: ${date} (${events} events)`);
  });

// 3. Pipeline queue
console.log("\n=== PIPELINE QUEUE ===");
const queueResp = await supabase
  .from("sg_pipeline_queue")
  .select("stage");

const queue = queueResp.data || [];

const stageCount: any = {};
queue.forEach((q: any) => {
  stageCount[q.stage] = (stageCount[q.stage] || 0) + 1;
});

console.log("Items by pipeline stage:");
["discovered", "analyzing", "awaiting_fetch", "extracted", "ready_to_persist", "indexed"]
  .forEach((stage: string) => {
    const count = stageCount[stage] || 0;
    console.log(`  ${stage}: ${count}`);
  });

// 4. Failure analysis
console.log("\n=== FAILURES ===");
const failureResp = await supabase
  .from("sg_failure_log")
  .select("error_type, error_message");

const failures = failureResp.data || [];

const failureTypes: any = {};
failures.forEach((f: any) => {
  failureTypes[f.error_type || "unknown"] = (failureTypes[f.error_type || "unknown"] || 0) + 1;
});

console.log("Failure count: " + failures.length);
console.log("By type:");
Object.entries(failureTypes)
  .sort((a: any, b: any) => b[1] - a[1])
  .forEach(([type, count]: any) => {
    console.log(`  ${type}: ${count}`);
  });

if (failures.length > 0) {
  console.log("\nMost recent failures:");
  failures
    .slice(-5)
    .reverse()
    .forEach((f: any) => {
      console.log(`  [${f.error_type || "unknown"}] ${f.error_message?.substring(0, 70)}`);
    });
}

// 5. Calculate yield
console.log("\n=== YIELD CALCULATION ===");
const publishedCount = eventsByStatus["published"] || 0;
const sourcesCount = sources.length || 0;
const eventsPerSource = sourcesCount > 0 ? (publishedCount / sourcesCount).toFixed(2) : 0;

console.log(`Published events: ${publishedCount}`);
console.log(`Total sources: ${sourcesCount}`);
console.log(`Average yield per source: ${eventsPerSource}`);
console.log(`Expected at 100 events/source: ${sourcesCount * 100}`);
