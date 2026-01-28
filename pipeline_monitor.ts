/**
 * Waterfall Pipeline Test Runner
 * 
 * Tests the new 3-stage decoupled architecture:
 * 1. Scraper → DISCOVERED/AWAITING_ENRICHMENT
 * 2. Enrichment Worker → READY_TO_INDEX
 * 3. Indexing Worker → PROCESSED (events table)
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

console.log("═".repeat(60));
console.log("  WATERFALL PIPELINE STATUS MONITOR");
console.log("═".repeat(60));
console.log();

// Get pipeline status summary
const { data: stagingData } = await supabase
  .from("raw_event_staging")
  .select("pipeline_status");

// Count by pipeline_status
const pipelineCounts: Record<string, number> = {};

stagingData?.forEach((row: any) => {
  if (row.pipeline_status) {
    pipelineCounts[row.pipeline_status] = (pipelineCounts[row.pipeline_status] || 0) + 1;
  }
});

console.log("📊 PIPELINE STATUS (New Waterfall)");
console.log("─".repeat(40));
const pipelineStages = [
  "discovered",
  "awaiting_enrichment", 
  "enriching",
  "enriched",
  "ready_to_index",
  "indexing",
  "processed",
  "failed"
];

pipelineStages.forEach(status => {
  const count = pipelineCounts[status] || 0;
  const bar = "█".repeat(Math.min(count, 30));
  const emoji = status === "processed" ? "✅" : 
                status === "failed" ? "❌" : 
                status.includes("ing") ? "⏳" : "📋";
  console.log(`${emoji} ${status.padEnd(20)} ${String(count).padStart(4)} ${bar}`);
});

console.log();
// Get events count
const { count: eventsCount } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log();
console.log("📊 OUTPUT TABLES");
console.log("─".repeat(40));
console.log(`📅 events table:     ${eventsCount || 0} published events`);

console.log();
console.log("═".repeat(60));
console.log("  ARCHITECTURE OVERVIEW");
console.log("═".repeat(60));
console.log(`
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   SCRAPER       │────▶│ ENRICHMENT      │────▶│ INDEXING        │
│   (Harvester)   │     │ (Deep Dive)     │     │ (Finalize)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
  ┌───────────┐           ┌───────────┐           ┌───────────┐
  │ DISCOVERED│           │READY_TO_  │           │ PROCESSED │
  │    or     │    ───▶   │  INDEX    │    ───▶   │  (events) │
  │ AWAITING  │           │           │           │           │
  └───────────┘           └───────────┘           └───────────┘
`);

console.log("📝 NEXT STEPS:");
console.log("─".repeat(40));
if ((pipelineCounts["awaiting_enrichment"] || 0) > 0) {
  console.log("Enrichment is pending. Check the enrichment-worker logs or trigger status.");
} else if ((pipelineCounts["ready_to_index"] || 0) > 0) {
  console.log("Events ready! Run indexing worker to move them to events table.");
} else if ((eventsCount || 0) > 0) {
  console.log("✅ Pipeline complete! Events are published.");
} else {
  console.log("Run the scraper first: deno run --allow-all run_pipeline.ts");
}
