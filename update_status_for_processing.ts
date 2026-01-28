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

console.log("Updating status from awaiting_fetch to awaiting_enrichment...\n");

const { data, error } = await supabase
  .from("raw_event_staging")
  .update({ status: "awaiting_enrichment" })
  .eq("status", "awaiting_fetch")
  .select("id");

if (error) {
  console.error("Error:", error);
} else {
  console.log(`✓ Updated ${data?.length || 0} rows to awaiting_enrichment`);
  console.log("\nNow the processor can claim and process them!");
  console.log("Run: deno run --allow-all run_pipeline.ts");
}
