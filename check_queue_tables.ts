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

console.log("Checking for queue-related tables...\n");

// Try to query various queue table names
const queueTables = [
  "ai_job_queue",
  "AI_job_queue", 
  "embedding_queue",
  "job_queue",
  "processing_queue"
];

for (const tableName of queueTables) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .limit(1);
  
  if (!error) {
    console.log(`✓ Found table: ${tableName}`);
    if (data && data[0]) {
      console.log("  Columns:", Object.keys(data[0]));
    }
  }
}

// Also check what tables actually exist by querying information_schema
console.log("\nLooking for all tables with 'queue' in the name...");
// This won't work directly via the client, so let's list what we know exists
console.log("\nKnown tables from migrations:");
console.log("- raw_event_staging (status-based workflow)");
console.log("- scraper_sources");
console.log("- events");
