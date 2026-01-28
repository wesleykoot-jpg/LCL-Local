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

console.log("Clearing last_payload_hash to force a fresh scrape...\n");

const { data, error } = await supabase
  .from("scraper_sources")
  .update({ last_payload_hash: null })
  .eq("enabled", true)
  .select();

if (error) {
  console.error("Error:", error);
} else {
  console.log("✓ Hash cleared for:", data[0]?.name);
  console.log("\nNow run: deno run --allow-all run_pipeline.ts");
}
