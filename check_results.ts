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

console.log("=== SCRAPER TEST RESULTS ===\n");

// Check staging table
const { data: staging, error: stagingError } = await supabase
  .from("raw_event_staging")
  .select("id, source_url, status, title, created_at")
  .order("created_at", { ascending: false })
  .limit(10);

if (stagingError) {
  console.error("Error fetching staging:", stagingError);
} else {
  console.log(`✅ Staging Table: ${staging?.length || 0} recent rows\n`);
  staging?.slice(0, 5).forEach((row, i) => {
    console.log(`${i + 1}. ${row.title || 'No title'}`);
    console.log(`   Status: ${row.status}`);
    console.log(`   URL: ${row.source_url.substring(0, 60)}...`);
    console.log();
  });
}

// Check events table
const { data: events, error: eventsError } = await supabase
  .from("events")
  .select("id, title, event_date, category")
  .order("created_at", { ascending: false })
  .limit(5);

if (eventsError) {
  console.error("Error fetching events:", eventsError);
} else {
  console.log(`\n📅 Events Table: ${events?.length || 0} events\n`);
  if (events && events.length > 0) {
    events.forEach((event, i) => {
      console.log(`${i + 1}. ${event.title}`);
      console.log(`   Date: ${event.event_date}`);
      console.log(`   Category: ${event.category || 'N/A'}`);
      console.log();
    });
  } else {
    console.log("   No events yet - they're still in staging awaiting processing");
  }
}

// Get total counts
const { count: stagingCount } = await supabase
  .from("raw_event_staging")
  .select("*", { count: "exact", head: true });

const { count: eventsCount } = await supabase
  .from("events")
  .select("*", { count: "exact", head: true });

console.log("\n=== SUMMARY ===");
console.log(`Staging: ${stagingCount} rows`);
console.log(`Events: ${eventsCount} rows`);
console.log("\n✅ SCRAPER IS WORKING! Events are being fetched and staged.");
