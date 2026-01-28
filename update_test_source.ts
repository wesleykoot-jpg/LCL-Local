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

// Update the existing source to use a real, simple URL
console.log("Updating test source to use a real website...");

const { data, error } = await supabase
  .from("scraper_sources")
  .update({
    name: "Meppel Events Test",
    url: "https://ontdekmeppel.nl/ontdek-meppel/agenda/",
    enabled: true
  })
  .eq("name", "local-sample")
  .select();

if (error) {
  console.error("Error updating source:", error);
  Deno.exit(1);
} else {
  console.log("✓ Source updated successfully!");
  console.log("  ID:", data[0]?.id);
  console.log("  Name:", data[0]?.name);
  console.log("  URL:", data[0]?.url);
  console.log("\nNow you can run the full pipeline:");
  console.log("  deno run --allow-all run_pipeline.ts");
}
