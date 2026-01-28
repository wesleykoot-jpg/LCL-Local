/**
 * Check events table columns
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

console.log("Checking events table columns...\n");

// Query information_schema
const { data, error } = await supabase.rpc("get_table_columns", {
  table_name: "events"
});

if (error) {
  // Fall back to a simple test
  console.log("RPC not available, testing columns directly...\n");
  
  const testColumns = [
    "title", "description", "category", "event_type", "event_date", "event_time",
    "venue_name", "venue_address", "location", "source_url", "source_id", "content_hash",
    "image_url", "tags", "price", "price_currency", "price_min", "price_max", 
    "tickets_url", "end_time", "end_date", "organizer", "organizer_url", "performer",
    "event_status", "data_source", "quality_score", "is_displayable", "event_fingerprint"
  ];
  
  for (const col of testColumns) {
    const { data: testData, error: testErr } = await supabase
      .from("events")
      .select(col)
      .limit(0);
    
    if (testErr) {
      console.log(`❌ ${col}: ${testErr.message.substring(0, 50)}...`);
    } else {
      console.log(`✅ ${col}`);
    }
  }
} else {
  console.log("Columns:", data);
}
