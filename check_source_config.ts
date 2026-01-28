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

const { data, error } = await supabase
  .from("scraper_sources")
  .select("*")
  .eq("enabled", true)
  .single();

if (error) {
  console.error("Error:", error);
} else {
  console.log("=== Source Details ===");
  console.log("ID:", data.id);
  console.log("Name:", data.name);
  console.log("URL:", data.url);
  console.log("Enabled:", data.enabled);
  console.log("\n=== Config Field ===");
  console.log("Type:", typeof data.config);
  console.log("Value:", data.config);
  console.log("\nJSON:", JSON.stringify(data.config, null, 2));
}
