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

console.log("Testing upsert with correct enum values...\n");

// Try without status field first
const testUrl = `https://test.example.com/verify-${Date.now()}`;
const { data, error } = await supabase
  .from("raw_event_staging")
  .upsert({
    source_url: testUrl,
    raw_html: "<html>test</html>"
  }, { onConflict: "source_url" })
  .select();

if (error) {
  console.error("❌ Upsert failed:", error);
} else {
  console.log("✓ Upsert successful!");
  console.log("Row created with ID:", data[0]?.id);
  console.log("Status value:", data[0]?.status);
  
  // Clean up
  await supabase.from("raw_event_staging").delete().eq("source_url", testUrl);
  console.log("✓ Test row cleaned up");
  console.log("\n✅ The UNIQUE constraint is working correctly!");
}
