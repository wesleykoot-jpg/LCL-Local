
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Verifying Scraper Pipeline...\n");

// 1. Check if staging table exists by querying it
console.log("1. Checking staging table...");
const { data: stagingData, error: stagingError } = await supabase
  .from("raw_event_staging")
  .select("id")
  .limit(1);

if (stagingError) {
  console.error("❌ Staging table check failed:", stagingError.message);
  console.log("\n   Hint: Make sure you ran the migration SQL.");
  Deno.exit(1);
}

console.log("✅ Staging table exists!");
console.log(`   Current pending rows: checking...`);

const { count: awaitingCount } = await supabase
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true })
  .eq("pipeline_status", "awaiting_enrichment");

console.log(`   Awaiting enrichment rows: ${awaitingCount || 0}`);

// 2. Check Edge Functions are deployed (by calling them)
console.log("\n2. Testing scrape-events...");
const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/scrape-events`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${supabaseKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ enableDeepScraping: false })
});

if (!scrapeRes.ok) {
  console.error("❌ scrape-worker call failed:", await scrapeRes.text());
} else {
  const scrapeResult = await scrapeRes.json();
  console.log("✅ scrape-events responded:", JSON.stringify(scrapeResult, null, 2));
}

// 3. Check staging again
console.log("\n3. Checking staging after scrape...");
const { count: newAwaitingCount } = await supabase
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true })
  .eq("pipeline_status", "awaiting_enrichment");

console.log(`   Awaiting enrichment rows after scrape: ${newAwaitingCount || 0}`);

console.log("\n4. Enrichment trigger check: rows should move to 'ready_to_index' automatically.");
console.log("   If awaiting_enrichment stays high, check the enrichment-worker logs.");

console.log("\n✅ Pipeline Verification Complete!");
