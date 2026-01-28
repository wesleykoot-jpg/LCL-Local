/**
 * Test Runner for Indexing Worker
 * 
 * Simulates what the Edge Function does locally for testing.
 * Moves events from READY_TO_INDEX → PROCESSED, inserting into events table.
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
console.log("  INDEXING WORKER TEST");
console.log("═".repeat(60));
console.log();

// Count events before
const { count: eventsBefore } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log(`📊 Events table before: ${eventsBefore || 0} events`);
console.log();

// Find events ready to index
const { data: toIndex, error } = await supabase
  .from("raw_event_staging")
  .select("*")
  .eq("pipeline_status", "ready_to_index")
  .order("created_at", { ascending: true })
  .limit(20);

if (error) {
  console.error("❌ Error fetching events:", error.message);
  Deno.exit(1);
}

if (!toIndex || toIndex.length === 0) {
  console.log("✅ No events ready to index.");
  console.log();
  
  // Show current distribution
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

console.log(`Found ${toIndex.length} events ready to index`);
console.log();

let successCount = 0;
let failCount = 0;

for (const staging of toIndex) {
  console.log(`─────────────────────────────────────────────────`);
  console.log(`📋 Indexing: ${staging.title || "Untitled"}`);
  
  // Extract event data from staging record
  // In production, this would use structured_data from enrichment
  const structuredData = staging.structured_data || {};
  
  // Build the event record
  const eventRecord = {
    title: staging.title || structuredData.title || "Untitled Event",
    description: staging.description || structuredData.description || "",
    source_url: staging.source_url,
    category: staging.category || structuredData.category || "other",
    event_type: "anchor" as const, // Scraped events are anchors
    start_time: staging.start_time || structuredData.start_time || new Date().toISOString(),
    end_time: staging.end_time || structuredData.end_time,
    location: staging.location, // PostGIS point if available
    venue_name: staging.venue_name || structuredData.venue_name || "",
    venue_address: staging.venue_address || structuredData.venue_address || "",
    image_url: staging.image_url || structuredData.image_url,
    is_recurring: false,
    is_featured: false,
    is_public: true,
    max_attendees: structuredData.max_attendees || null,
    price_info: structuredData.price_info || null,
    // External ID for deduplication
    external_id: staging.external_id || staging.id.toString(),
  };
  
  // Insert into events table
  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .upsert(eventRecord, { 
      onConflict: "source_url",
      ignoreDuplicates: false 
    })
    .select("id")
    .single();
  
  if (insertError) {
    console.log(`   ❌ Insert failed: ${insertError.message}`);
    failCount++;
    
    // Mark as failed in staging
    await supabase
      .from("raw_event_staging")
      .update({
        pipeline_status: "failed",
        error_message: insertError.message
      })
      .eq("id", staging.id);
    continue;
  }
  
  console.log(`   ✅ Inserted as event ID: ${inserted?.id}`);
  successCount++;
  
  // Mark as processed in staging
  const { error: updateError } = await supabase
    .from("raw_event_staging")
    .update({
      pipeline_status: "processed",
      indexed_at: new Date().toISOString()
    })
    .eq("id", staging.id);
  
  if (updateError) {
    console.log(`   ⚠️  Failed to update staging status: ${updateError.message}`);
  }
}

// Count events after
const { count: eventsAfter } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log();
console.log("═".repeat(60));
console.log("  INDEXING COMPLETE");
console.log("═".repeat(60));
console.log();
console.log(`📊 Results:`);
console.log(`   ✅ Success: ${successCount}`);
console.log(`   ❌ Failed:  ${failCount}`);
console.log();
console.log(`📊 Events table: ${eventsBefore} → ${eventsAfter} (+${(eventsAfter || 0) - (eventsBefore || 0)})`);
console.log();
console.log("🎉 Events should now be visible in your app!");
