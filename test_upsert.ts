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

// Get the test source ID
const { data: source } = await supabase
  .from("scraper_sources")
  .select("id")
  .eq("enabled", true)
  .single();

const testUrl = `https://test.example.com/verify-${Date.now()}`;
const { data, error } = await supabase
  .from("raw_event_staging")
  .upsert({
    source_id: source.id,
    source_url: testUrl,
    raw_html: "<html>test</html>"
  }, { onConflict: "source_url" })
  .select();

if (error) {
  console.error("❌ Upsert failed:", error);
  Deno.exit(1);
} else {
  console.log("✅ UNIQUE CONSTRAINT IS WORKING!");
  console.log("✓ Upsert successful with ON CONFLICT");
  
  // Clean up
  await supabase.from("raw_event_staging").delete().eq("source_url", testUrl);
  console.log("✓ Test row cleaned up\n");
}
