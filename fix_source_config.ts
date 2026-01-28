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

// Get current source
const { data: source } = await supabase
  .from("scraper_sources")
  .select("*")
  .eq("enabled", true)
  .single();

console.log("Updating source with default config...");

// Update with proper config - use RPC to update JSONB
const { data, error } = await supabase
  .rpc("exec_sql", {
    query: `
      UPDATE scraper_sources 
      SET fetcher_type = 'static'
      WHERE id = '${source.id}'
      RETURNING *
    `
  });

if (error) {
  // Try direct update instead
  const { data: updateData, error: updateError } = await supabase
    .from("scraper_sources")
    .update({
      fetcher_type: "static"
    })
    .eq("id", source.id)
    .select();

  if (updateError) {
    console.error("Error:", updateError);
  } else {
    console.log("✓ Source updated successfully!");
    console.log("Fetcher type:", updateData[0]?.fetcher_type);
  }
} else {
  console.log("✓ Source updated via RPC!");
}
