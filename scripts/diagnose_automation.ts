
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Load .env manually
try {
  const envText = await Deno.readTextFile(".env");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      Deno.env.set(key, value);
    }
  }
} catch { /* ignore */ }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("🔍 AUTOMATION DIAGNOSTICS");
  console.log("=".repeat(50));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("");

  // 1. Check events count
  const { count: eventsCount } = await supabase.from("events").select("*", { count: "exact", head: true });
  console.log(`📊 Total Events: ${eventsCount}`);

  // 2. Check scrape_jobs status
  const { data: jobs } = await supabase
    .from("scrape_jobs")
    .select("status, count:id")
    .order("status");
  
  console.log("\n📋 Scrape Jobs by Status:");
  const jobCounts: Record<string, number> = {};
  for (const job of (jobs || [])) {
    jobCounts[job.status] = (jobCounts[job.status] || 0) + 1;
  }
  // Actually we need a different query for counts
  const { data: jobStats } = await supabase.rpc("get_job_stats").maybeSingle();
  
  // Fallback: just fetch all jobs and count
  const { data: allJobs } = await supabase.from("scrape_jobs").select("status");
  const statusCounts: Record<string, number> = {};
  for (const j of (allJobs || [])) {
    statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`   ${status}: ${count}`);
  }

  // 3. Check recent jobs
  const { data: recentJobs } = await supabase
    .from("scrape_jobs")
    .select("id, source_id, status, created_at, started_at, completed_at, error_message")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\n📝 Recent Jobs (last 5):");
  for (const j of (recentJobs || [])) {
    console.log(`   [${j.status}] ${j.id.slice(0, 8)}... @ ${j.created_at || "N/A"}`);
    if (j.error_message) console.log(`      Error: ${j.error_message.slice(0, 80)}`);
  }

  // 4. Check sources
  const { data: sources } = await supabase
    .from("scraper_sources")
    .select("id, name, enabled, auto_disabled, next_scrape_at, last_scraped_at")
    .eq("enabled", true)
    .limit(10);
  console.log("\n🌐 Enabled Sources (max 10):");
  for (const s of (sources || [])) {
    const autoDisabled = s.auto_disabled ? " [AUTO-DISABLED]" : "";
    console.log(`   ${s.name}${autoDisabled}`);
    console.log(`      Last: ${s.last_scraped_at || "Never"} | Next: ${s.next_scrape_at || "TBD"}`);
  }

  // 5. Check pg_net audit (if exists)
  const { data: auditLogs, error: auditError } = await supabase
    .from("net_http_responses_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  
  if (!auditError && auditLogs && auditLogs.length > 0) {
    console.log("\n📡 Recent pg_net Audit Logs:");
    for (const log of auditLogs) {
      console.log(`   ${log.url} - Status: ${log.status} @ ${log.created_at}`);
    }
  } else {
    console.log("\n📡 pg_net Audit Logs: (none or table not yet populated)");
  }

  // 6. Try to manually trigger coordinator
  console.log("\n🚀 Attempting to trigger coordinator manually...");
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/scrape-coordinator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ triggerWorker: true }),
    });
    const text = await resp.text();
    console.log(`   Status: ${resp.status}`);
    console.log(`   Response: ${text.slice(0, 200)}`);
  } catch (e) {
    console.error("   Failed:", e);
  }

  console.log("\n" + "=".repeat(50));
  console.log("🏁 DIAGNOSTICS COMPLETE");
}

main();
