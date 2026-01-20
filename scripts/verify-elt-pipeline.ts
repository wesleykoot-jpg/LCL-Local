
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("Verifying ELT Pipeline...\n");

// 1. Check if staging table exists by querying it
console.log("1. Checking staging table...");
const { data: stagingData, error: stagingError } = await supabase
  .schema('scraper')
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

const { count: pendingCount } = await supabase
  .schema('scraper')
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true })
  .eq("status", "pending");

console.log(`   Pending rows: ${pendingCount || 0}`);

// 2. Check Edge Functions are deployed (by calling them)
console.log("\n2. Testing scrape-worker...");
const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/scrape-worker`, {
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
  console.log("✅ scrape-worker responded:", JSON.stringify(scrapeResult, null, 2));
}

// 3. Check staging again
console.log("\n3. Checking staging after scrape...");
const { count: newPendingCount } = await supabase
  .schema('scraper')
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true })
  .eq("status", "pending");

console.log(`   Pending rows after scrape: ${newPendingCount || 0}`);

// 4. If there are pending rows, trigger process-worker
if (newPendingCount && newPendingCount > 0) {
  console.log("\n4. Testing process-worker...");
  const processRes = await fetch(`${supabaseUrl}/functions/v1/process-worker`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    }
  });

  if (!processRes.ok) {
    console.error("❌ process-worker call failed:", await processRes.text());
  } else {
    const processResult = await processRes.json();
    console.log("✅ process-worker responded:", JSON.stringify(processResult, null, 2));
  }
} else {
  console.log("\n4. Skipping process-worker test (no pending rows)");
}

console.log("\n✅ ELT Pipeline Verification Complete!");
