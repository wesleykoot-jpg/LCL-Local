/**
 * Pipeline Diagnostic Script
 * Automatically checks the scraper pipeline status and identifies issues.
 * 
 * Run with: deno run --allow-net --allow-env scripts/diagnose_pipeline.ts
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// Use the public URL and anon key from .env (available in repo)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://mlpefjsbriqgxcaqxhic.supabase.co";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface DiagnosticResult {
  check: string;
  status: "OK" | "WARNING" | "ERROR";
  message: string;
  data?: unknown;
}

const results: DiagnosticResult[] = [];

function log(result: DiagnosticResult) {
  const emoji = result.status === "OK" ? "✅" : result.status === "WARNING" ? "⚠️" : "❌";
  console.log(`${emoji} [${result.check}] ${result.message}`);
  if (result.data) {
    console.log("   Details:", JSON.stringify(result.data, null, 2).split("\n").map(l => "   " + l).join("\n"));
  }
  results.push(result);
}

async function checkScraperSources() {
  console.log("\n📊 CHECKING SCRAPER SOURCES...\n");
  
  const { data: sources, error } = await supabase
    .from("scraper_sources")
    .select("id, name, url, enabled, auto_disabled, consecutive_errors, next_scrape_at, last_scraped_at, volatility_score")
    .order("name");

  if (error) {
    log({ check: "Sources Table", status: "ERROR", message: `Failed to query: ${error.message}` });
    return;
  }

  if (!sources || sources.length === 0) {
    log({ check: "Sources Table", status: "ERROR", message: "No scraper sources found! The scraper_sources table is empty." });
    return;
  }

  log({ check: "Sources Count", status: "OK", message: `Found ${sources.length} scraper sources in database` });

  // Check enabled sources
  const enabledSources = sources.filter(s => s.enabled && !s.auto_disabled);
  const disabledSources = sources.filter(s => !s.enabled || s.auto_disabled);

  if (enabledSources.length === 0) {
    log({ 
      check: "Enabled Sources", 
      status: "ERROR", 
      message: "No enabled sources! All sources are disabled or auto_disabled.",
      data: disabledSources.map(s => ({ id: s.id, name: s.name, enabled: s.enabled, auto_disabled: s.auto_disabled }))
    });
  } else {
    log({ check: "Enabled Sources", status: "OK", message: `${enabledSources.length} sources are enabled` });
  }

  // Check for circuit breaker issues
  const highErrors = sources.filter(s => (s.consecutive_errors || 0) >= 3);
  if (highErrors.length > 0) {
    log({
      check: "Circuit Breaker",
      status: "WARNING",
      message: `${highErrors.length} sources have >=3 consecutive errors (circuit breaker may be active)`,
      data: highErrors.map(s => ({ id: s.id, name: s.name, errors: s.consecutive_errors }))
    });
  } else {
    log({ check: "Circuit Breaker", status: "OK", message: "No sources have hit the circuit breaker threshold" });
  }

  // Check scheduling
  const now = new Date();
  const dueSources = enabledSources.filter(s => !s.next_scrape_at || new Date(s.next_scrape_at) <= now);
  const futureSources = enabledSources.filter(s => s.next_scrape_at && new Date(s.next_scrape_at) > now);

  if (dueSources.length > 0) {
    log({
      check: "Due for Scraping",
      status: "OK",
      message: `${dueSources.length} sources are due for scraping now`,
      data: dueSources.slice(0, 5).map(s => ({ id: s.id, name: s.name, next_scrape_at: s.next_scrape_at }))
    });
  } else {
    log({
      check: "Due for Scraping",
      status: "WARNING",
      message: "No sources are due for scraping yet",
      data: futureSources.slice(0, 5).map(s => ({ name: s.name, next_scrape_at: s.next_scrape_at }))
    });
  }

  return enabledSources;
}

async function checkScrapeJobs() {
  console.log("\n📋 CHECKING SCRAPE JOBS...\n");

  const { data: jobs, error } = await supabase
    .from("scrape_jobs")
    .select("id, source_id, status, created_at, completed_at, events_scraped, events_inserted, error_message")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    log({ check: "Jobs Table", status: "ERROR", message: `Failed to query: ${error.message}` });
    return;
  }

  if (!jobs || jobs.length === 0) {
    log({ check: "Jobs Table", status: "WARNING", message: "No scrape jobs found. The coordinator may not have run yet." });
    return;
  }

  const pendingJobs = jobs.filter(j => j.status === "pending");
  const runningJobs = jobs.filter(j => j.status === "running");
  const completedJobs = jobs.filter(j => j.status === "completed");
  const failedJobs = jobs.filter(j => j.status === "failed");

  log({ check: "Jobs Summary", status: "OK", message: `Last 20 jobs: ${pendingJobs.length} pending, ${runningJobs.length} running, ${completedJobs.length} completed, ${failedJobs.length} failed` });

  if (pendingJobs.length > 0) {
    log({
      check: "Pending Jobs",
      status: "OK",
      message: `${pendingJobs.length} jobs waiting to be processed`,
      data: pendingJobs.slice(0, 3).map(j => ({ id: j.id, source_id: j.source_id, created_at: j.created_at }))
    });
  }

  if (failedJobs.length > 0) {
    log({
      check: "Failed Jobs",
      status: "WARNING",
      message: `${failedJobs.length} jobs failed recently`,
      data: failedJobs.slice(0, 3).map(j => ({ id: j.id, error: j.error_message?.slice(0, 100) }))
    });
  }

  // Check recent successful insertions
  const recentSuccess = completedJobs.filter(j => j.events_inserted && j.events_inserted > 0);
  if (recentSuccess.length > 0) {
    const totalInserted = recentSuccess.reduce((sum, j) => sum + (j.events_inserted || 0), 0);
    log({
      check: "Recent Insertions",
      status: "OK",
      message: `${recentSuccess.length} recent jobs inserted ${totalInserted} events total`,
      data: recentSuccess.slice(0, 3).map(j => ({ id: j.id, events_inserted: j.events_inserted }))
    });
  } else {
    log({
      check: "Recent Insertions",
      status: "WARNING",
      message: "No recent jobs have inserted any events"
    });
  }
}

async function checkEvents() {
  console.log("\n📅 CHECKING EVENTS TABLE...\n");

  // Count total events
  const { count: totalCount, error: countError } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });

  if (countError) {
    log({ check: "Events Count", status: "ERROR", message: `Failed to count: ${countError.message}` });
    return;
  }

  log({ check: "Total Events", status: "OK", message: `${totalCount || 0} events in database` });

  // Check recent events (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentEvents, error: recentError } = await supabase
    .from("events")
    .select("id, title, event_date, source_id, created_at")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  if (recentError) {
    log({ check: "Recent Events", status: "ERROR", message: `Failed to query: ${recentError.message}` });
    return;
  }

  if (!recentEvents || recentEvents.length === 0) {
    log({ check: "Recent Events", status: "WARNING", message: "No events created in the last 7 days" });
  } else {
    log({
      check: "Recent Events",
      status: "OK",
      message: `${recentEvents.length} events created in the last 7 days`,
      data: recentEvents.slice(0, 3).map(e => ({ title: e.title?.slice(0, 40), created_at: e.created_at }))
    });
  }

  // Check events with source_id (scraped events)
  const { count: scrapedCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .not("source_id", "is", null);

  log({ check: "Scraped Events", status: "OK", message: `${scrapedCount || 0} events came from scraper (have source_id)` });
}

async function checkErrorLogs() {
  console.log("\n🚨 CHECKING ERROR LOGS...\n");

  const { data: errors, error } = await supabase
    .from("error_logs")
    .select("id, level, source, function_name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    // Table might not exist
    log({ check: "Error Logs", status: "WARNING", message: `Could not query error_logs: ${error.message}` });
    return;
  }

  if (!errors || errors.length === 0) {
    log({ check: "Error Logs", status: "OK", message: "No recent errors logged" });
  } else {
    const criticalErrors = errors.filter(e => e.level === "error" || e.level === "critical");
    if (criticalErrors.length > 0) {
      log({
        check: "Critical Errors",
        status: "ERROR",
        message: `${criticalErrors.length} critical/error level logs found`,
        data: criticalErrors.slice(0, 3).map(e => ({ source: e.source, message: e.message?.slice(0, 80), created_at: e.created_at }))
      });
    } else {
      log({ check: "Error Logs", status: "OK", message: `${errors.length} log entries, none critical` });
    }
  }
}

async function generateSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("=".repeat(60) + "\n");

  const errors = results.filter(r => r.status === "ERROR");
  const warnings = results.filter(r => r.status === "WARNING");
  const oks = results.filter(r => r.status === "OK");

  console.log(`✅ ${oks.length} checks passed`);
  console.log(`⚠️  ${warnings.length} warnings`);
  console.log(`❌ ${errors.length} errors\n`);

  if (errors.length > 0) {
    console.log("🔴 CRITICAL ISSUES:");
    errors.forEach(e => console.log(`   - ${e.check}: ${e.message}`));
  }

  if (warnings.length > 0) {
    console.log("\n🟡 WARNINGS:");
    warnings.forEach(w => console.log(`   - ${w.check}: ${w.message}`));
  }

  console.log("\n" + "=".repeat(60));
  console.log("💡 RECOMMENDATIONS");
  console.log("=".repeat(60) + "\n");

  // Provide specific recommendations based on findings
  if (errors.some(e => e.check === "Sources Table" || e.check === "Enabled Sources")) {
    console.log("1. Run the seed SQL to populate scraper sources:");
    console.log("   - Go to Supabase Dashboard → SQL Editor");
    console.log("   - Run: supabase/seed_scraper_config.sql\n");
  }

  if (warnings.some(w => w.check === "Jobs Table")) {
    console.log("2. Trigger the scrape coordinator to create jobs:");
    console.log("   - Run: deno run --allow-net scripts/trigger_coordinator.ts\n");
  }

  if (warnings.some(w => w.check === "Recent Insertions")) {
    console.log("3. Check Edge Function secrets in Supabase Dashboard:");
    console.log("   - Ensure GEMINI_API_KEY or GOOGLE_AI_API_KEY is set");
    console.log("   - Go to: Project Settings → Edge Functions → Secrets\n");
  }

  if (errors.some(e => e.check === "Critical Errors")) {
    console.log("4. Review error logs for specific failure details:");
    console.log("   - Check Supabase Dashboard → Edge Functions → Logs\n");
  }
}

async function main() {
  console.log("🔍 LCL SCRAPER PIPELINE DIAGNOSTIC");
  console.log("=".repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log("=".repeat(60));

  await checkScraperSources();
  await checkScrapeJobs();
  await checkEvents();
  await checkErrorLogs();
  await generateSummary();

  // Return exit code based on errors
  const hasErrors = results.some(r => r.status === "ERROR");
  Deno.exit(hasErrors ? 1 : 0);
}

main();
