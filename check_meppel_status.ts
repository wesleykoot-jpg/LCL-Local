/**
 * Check meppel source status and missing events
 */

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

console.log("🔍 Checking Meppel source status...\n");

// Check staging status breakdown
const { data: staging, error: stagingErr } = await supabase
  .from("raw_event_staging")
  .select("id, title, status, source_url, created_at");

if (stagingErr) {
  console.log("❌ Staging error:", stagingErr.message);
} else {
  const statusCounts: Record<string, number> = {};
  staging?.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  console.log("📊 Staging status breakdown:", statusCounts);
  console.log(`   Total in staging: ${staging?.length || 0}`);
  
  // Show pending items
  const pending = staging?.filter(s => s.status === 'pending' || s.status === 'awaiting_enrichment');
  if (pending && pending.length > 0) {
    console.log(`\n⏳ Pending/Awaiting items (${pending.length}):`);
    pending.slice(0, 5).forEach((p, i) => {
      console.log(`   ${i+1}. ${p.title?.substring(0, 50)}... (status: ${p.status})`);
    });
  }
  
  // Show failed items
  const failed = staging?.filter(s => s.status === 'failed');
  if (failed && failed.length > 0) {
    console.log(`\n❌ Failed items (${failed.length}):`);
    failed.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i+1}. ${f.title?.substring(0, 50)}...`);
    });
  }
}

// Check events
const { data: events, error: eventsErr } = await supabase
  .from("events")
  .select("id, title, source_url, created_at")
  .order("created_at", { ascending: false });

if (eventsErr) {
  console.log("❌ Events error:", eventsErr.message);
} else {
  console.log(`\n✅ Events in database: ${events?.length || 0}`);
  console.log("\nLatest events:");
  events?.slice(0, 10).forEach((e, i) => {
    console.log(`   ${i+1}. ${e.title?.substring(0, 50)}`);
  });
}

// Check scraper sources
const { data: sources } = await supabase
  .from("scraper_sources")
  .select("id, name, url, enabled, last_success, consecutive_errors");

console.log("\n📊 Scraper sources:");
sources?.forEach(s => {
  console.log(`   - ${s.name}: enabled=${s.enabled}, errors=${s.consecutive_errors}, last_success=${s.last_success}`);
});

// Check cron jobs / scheduled functions
console.log("\n📅 Checking for cron configuration...");
const { data: cronData, error: cronErr } = await supabase
  .rpc("pg_cron_schedule_list");

if (cronErr) {
  console.log("   Note: pg_cron not available or no RPC function (check Supabase dashboard for cron jobs)");
} else {
  console.log("   Cron jobs:", cronData);
}

console.log("\n💡 Recommendations:");
console.log("   1. Run process-worker to process pending staging items");
console.log("   2. Check if cron jobs are configured in Supabase dashboard");
console.log("   3. Consider running: deno run --allow-all run_pipeline.ts");
