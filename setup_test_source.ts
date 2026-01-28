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

// Insert a simple RSS feed source for testing
const testSource = {
  name: "test-rss-eventbrite",
  url: "https://www.eventbrite.com/d/netherlands--amsterdam/all-events/",
  enabled: true,
  config: {
    fetcher_type: "html",
    selectors: ["article", ".event-card", "[data-testid='event-card']"],
    rate_limit_ms: 500
  }
};

console.log("Inserting test source:", testSource.name);

const { data, error } = await supabase
  .from("scraper_sources")
  .upsert(testSource, { onConflict: "url" })
  .select();

if (error) {
  console.error("Error inserting source:", error);
} else {
  console.log("Success! Source ID:", data[0]?.id);
  console.log("\nRun the pipeline with this command:");
  console.log(`deno run --allow-all run_pipeline.ts`);
}
