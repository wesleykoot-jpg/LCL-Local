/**
 * Test Runner for Enrichment Worker
 * 
 * Simulates what the Edge Function does locally for testing.
 * Processes events in DISCOVERED or AWAITING_ENRICHMENT status.
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
console.log("  ENRICHMENT WORKER TEST");
console.log("═".repeat(60));
console.log();

// First check if migration has been applied
const { data: checkColumn, error: checkError } = await supabase.rpc("check_column_exists", {
  table_name: "raw_event_staging",
  column_name: "pipeline_status"
});

// If RPC doesn't exist, try a simple query
const { data: testRow } = await supabase
  .from("raw_event_staging")
  .select("id, pipeline_status")
  .limit(1);

const hasPipelineStatus = testRow && testRow[0] && "pipeline_status" in testRow[0];

if (!hasPipelineStatus) {
  console.log("⚠️  The pipeline_status column doesn't exist yet.");
  console.log("   Please apply the migration first:");
  console.log();
  console.log("   1. Open Supabase SQL Editor");
  console.log("   2. Run the contents of:");
  console.log("      supabase/migrations/20260128001000_waterfall_pipeline_architecture.sql");
  console.log();
  Deno.exit(1);
}

// Find events to enrich
const { data: toEnrich, error } = await supabase
  .from("raw_event_staging")
  .select("id, title, source_url, raw_html, pipeline_status")
  .or("pipeline_status.eq.discovered,pipeline_status.eq.awaiting_enrichment")
  .order("created_at", { ascending: true })
  .limit(5);

if (error) {
  console.error("❌ Error fetching events:", error.message);
  Deno.exit(1);
}

if (!toEnrich || toEnrich.length === 0) {
  console.log("✅ No events awaiting enrichment.");
  console.log();
  
  // Show what we do have
  const { data: summary } = await supabase
    .from("raw_event_staging")
    .select("pipeline_status");
  
  const counts: Record<string, number> = {};
  summary?.forEach((r: any) => {
    const status = r.pipeline_status || "null";
    counts[status] = (counts[status] || 0) + 1;
  });
  
  console.log("Current pipeline status distribution:");
  Object.entries(counts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  
  Deno.exit(0);
}

console.log(`Found ${toEnrich.length} events to enrich`);
console.log();

// Process each event
for (const event of toEnrich) {
  console.log(`─────────────────────────────────────────────────`);
  console.log(`📋 Processing: ${event.title || "Untitled"}`);
  console.log(`   URL: ${event.source_url}`);
  console.log(`   Status: ${event.pipeline_status}`);
  
  // Check if we have raw_html to parse
  if (!event.raw_html) {
    console.log("   ⚠️  No raw_html - skipping enrichment");
    
    // Mark as ready to index with minimal data
    const { error: updateError } = await supabase
      .from("raw_event_staging")
      .update({
        pipeline_status: "ready_to_index",
        enriched_at: new Date().toISOString()
      })
      .eq("id", event.id);
    
    if (updateError) {
      console.log(`   ❌ Update failed: ${updateError.message}`);
    } else {
      console.log("   ✅ Marked as ready_to_index (no enrichment needed)");
    }
    continue;
  }
  
  // For now, just extract basic info from title (simplified enrichment)
  // In production, this would call OpenAI to parse the full HTML
  const structuredData = {
    title: event.title,
    extracted_at: new Date().toISOString(),
    source_url: event.source_url,
    enrichment_source: "local_test"
  };
  
  // Update to ready_to_index
  const { error: updateError } = await supabase
    .from("raw_event_staging")
    .update({
      pipeline_status: "ready_to_index",
      structured_data: structuredData,
      enriched_at: new Date().toISOString()
    })
    .eq("id", event.id);
  
  if (updateError) {
    console.log(`   ❌ Update failed: ${updateError.message}`);
  } else {
    console.log("   ✅ Enriched → ready_to_index");
  }
}

console.log();
console.log("═".repeat(60));
console.log("  ENRICHMENT COMPLETE");
console.log("═".repeat(60));
console.log();
console.log("Next step: Run indexing worker to move events to events table");
console.log("  deno run --allow-all test_indexing_worker.ts");
