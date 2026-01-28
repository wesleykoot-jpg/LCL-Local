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

// Check table structure
console.log("Checking raw_event_staging table structure...\n");

// Try to get table info via a simple query
const { data, error } = await supabase
  .from("raw_event_staging")
  .select("*")
  .limit(1);

if (error) {
  console.error("Error querying table:", error);
} else {
  console.log("✓ Table exists and is accessible");
  console.log("Sample columns:", data && data[0] ? Object.keys(data[0]) : "No rows yet");
}

// Check if we can insert a test row
console.log("\nAttempting test upsert...");
const testUrl = `https://test.example.com/test-${Date.now()}`;
const { data: upsertData, error: upsertError } = await supabase
  .from("raw_event_staging")
  .upsert({
    source_url: testUrl,
    raw_html: "<html>test</html>",
    status: "pending"
  }, { onConflict: "source_url" })
  .select();

if (upsertError) {
  console.error("❌ Upsert failed:", upsertError);
  console.log("\nThis means the source_url column doesn't have a UNIQUE constraint.");
  console.log("We need to run the migration properly.");
} else {
  console.log("✓ Upsert successful!");
  console.log("Inserted row ID:", upsertData[0]?.id);
  
  // Clean up test row
  await supabase
    .from("raw_event_staging")
    .delete()
    .eq("source_url", testUrl);
  console.log("✓ Test row cleaned up");
}
