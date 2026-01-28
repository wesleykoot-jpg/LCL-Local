/**
 * Check and reset staging rows for processing
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

console.log("Checking staging table...\n");

// Check staging table status
const { data, error } = await supabase
  .from("raw_event_staging")
  .select("id, status, title")
  .limit(5);

if (error) {
  console.log("Error:", error.message);
} else {
  console.log("Sample staging rows:");
  data?.forEach((row: any) => {
    console.log(`  - ${row.title?.substring(0, 40) || "No title"}: status=${row.status}`);
  });
}

// Count by status 
const { data: allRows } = await supabase
  .from("raw_event_staging")
  .select("status");

const counts: Record<string, number> = {};
allRows?.forEach((row: any) => {
  const status = row.status || "null";
  counts[status] = (counts[status] || 0) + 1;
});

console.log("\nStatus distribution:");
Object.entries(counts).forEach(([status, count]) => {
  console.log(`  ${status}: ${count}`);
});

// Reset failed rows for retry
const resetArg = Deno.args[0];
if (resetArg === "--reset") {
  console.log("\nResetting all rows to 'awaiting_enrichment' status...");
  
  const { data: updated, error: updateErr } = await supabase
    .from("raw_event_staging")
    .update({ status: "awaiting_enrichment" })
    .neq("status", "awaiting_enrichment")
    .select("id");
  
  if (updateErr) {
    console.log("Error:", updateErr.message);
  } else {
    console.log(`Reset ${updated?.length || 0} rows`);
  }
} else {
  console.log("\nTo reset all rows for reprocessing, run:");
  console.log("  deno run --allow-all reset_staging.ts --reset");
}
