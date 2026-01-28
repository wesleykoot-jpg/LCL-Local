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

console.log("Updating pipeline_status from discovered to awaiting_enrichment...\n");

const { data, error } = await supabase
  .from("raw_event_staging")
  .update({ pipeline_status: "awaiting_enrichment" })
  .eq("pipeline_status", "discovered")
  .select("id");

if (error) {
  console.error("Error:", error);
} else {
  console.log(`✓ Updated ${data?.length || 0} rows to awaiting_enrichment`);
  console.log("\nThe enrichment-worker trigger will process them automatically.");
  console.log("Run: deno run --allow-all run_pipeline.ts");
}
