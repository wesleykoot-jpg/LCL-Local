import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Use .rpc to call a raw query
console.log("=== RAW DATABASE CHECK ===\n");

// Check what tables exist
const { data: tables, error: tableError } = await supabase.rpc("get_table_schemas", {});
if (tableError) {
  console.log("RPC error:", tableError.message);
}

// Try direct query to count events
const allEvents = await supabase.from("events").select("id");
console.log("Events query result:", allEvents);

// Try direct query to count sources
const allSources = await supabase.from("sg_sources").select("id");
console.log("Sources query result:", allSources);

// Check pipeline
const pipeline = await supabase.from("sg_pipeline_queue").select("id");
console.log("Pipeline queue result:", pipeline);
