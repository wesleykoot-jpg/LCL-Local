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
  .order("enabled", { ascending: false });

if (error) {
  console.error("Error:", error);
} else {
  console.log("=== All Scraper Sources ===");
  data?.forEach(s => {
    console.log(`${s.enabled ? '✓' : '✗'} ${s.name}`);
    console.log(`  URL: ${s.url}`);
    console.log(`  Type: ${s.type}`);
    console.log(`  Last success: ${s.last_success || 'never'}`);
    console.log();
  });
}
