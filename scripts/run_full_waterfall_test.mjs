import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file manually
const envContent = readFileSync(join(__dirname, '../.env'), 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkMigrationApplied() {
  console.log("🔍 Step 1: Checking if scraper_insights table exists...\n");
  
  const { error } = await supabase
    .from('scraper_insights')
    .select('id')
    .limit(1);
  
  if (error && error.message.includes("scraper_insights")) {
    console.log("❌ scraper_insights table NOT found\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  MIGRATION REQUIRED");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nThe scraper_insights table must be created before running tests.");
    console.log("\n📋 Manual steps to apply migration:");
    console.log("\n1. Open Supabase Dashboard SQL Editor:");
    console.log(`   ${SUPABASE_URL.replace('/rest', '')}/project/_/sql`);
    console.log("\n2. Copy the SQL from:");
    console.log("   supabase/migrations/20260121000000_data_first_pipeline.sql");
    console.log("\n3. Paste and run the SQL in the editor");
    console.log("\n4. Run this script again");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return false;
  }
  
  console.log("✅ scraper_insights table exists!\n");
  return true;
}

async function triggerScraper() {
  console.log("🚀 Step 2: Triggering scrape coordinator...\n");
  
  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/scrape-coordinator`;
  
  try {
    const response = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ triggerWorker: true })
    });
    
    console.log(`Response Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response: ${text}\n`);
    
    if (response.status === 200) {
      console.log("✅ Scraper triggered successfully!\n");
      return true;
    } else {
      console.log("⚠️  Scraper trigger returned non-200 status\n");
      return false;
    }
  } catch (e) {
    console.error("❌ Failed to trigger scraper:", e.message, "\n");
    return false;
  }
}

async function waitForScraping() {
  console.log("⏳ Step 3: Waiting for scraper to complete (30 seconds)...\n");
  
  // Show progress bar
  for (let i = 0; i < 30; i++) {
    process.stdout.write(".");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log("\n\n✅ Wait complete!\n");
}

async function queryInsights() {
  console.log("📊 Step 4: Querying scraper insights...\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Query 1: Extraction method summary
  console.log("\n1️⃣  EXTRACTION METHOD DISTRIBUTION:\n");
  
  const { data: methodStats, error: methodError } = await supabase
    .from('scraper_insights')
    .select('winning_strategy, total_events_found, status, execution_time_ms');
  
  if (methodError) {
    console.log("❌ Error querying insights:", methodError.message);
    return;
  }
  
  if (!methodStats || methodStats.length === 0) {
    console.log("⚠️  No insights found yet. The scraper may still be running or encountered issues.\n");
    console.log("💡 Tip: Wait a bit longer and run the query script:");
    console.log("   node scripts/query_scraper_insights.mjs\n");
    return;
  }
  
  // Aggregate by method
  const methodCounts = {};
  const methodEvents = {};
  const methodSuccesses = {};
  const methodTimes = {};
  
  methodStats.forEach(row => {
    const method = row.winning_strategy || 'NONE';
    methodCounts[method] = (methodCounts[method] || 0) + 1;
    methodEvents[method] = (methodEvents[method] || 0) + (row.total_events_found || 0);
    if (row.status === 'success') {
      methodSuccesses[method] = (methodSuccesses[method] || 0) + 1;
    }
    if (row.execution_time_ms) {
      if (!methodTimes[method]) methodTimes[method] = [];
      methodTimes[method].push(row.execution_time_ms);
    }
  });
  
  // Sort by total events found
  const sortedMethods = Object.keys(methodCounts).sort((a, b) => 
    methodEvents[b] - methodEvents[a]
  );
  
  console.log("Method          | Runs | Events | Success | Avg Time (ms)");
  console.log("─────────────────────────────────────────────────────────────");
  sortedMethods.forEach(method => {
    const avgTime = methodTimes[method] 
      ? Math.round(methodTimes[method].reduce((a, b) => a + b, 0) / methodTimes[method].length)
      : 0;
    const successRate = methodSuccesses[method] || 0;
    console.log(
      `${method.padEnd(15)} | ${String(methodCounts[method]).padEnd(4)} | ${String(methodEvents[method]).padEnd(6)} | ${String(successRate).padEnd(7)} | ${avgTime}`
    );
  });
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Query 2: Recent insights with details
  console.log("\n2️⃣  RECENT SCRAPER RUNS (Last 10):\n");
  
  const { data: recentRuns, error: recentError } = await supabase
    .from('scraper_insights')
    .select(`
      created_at,
      winning_strategy,
      total_events_found,
      status,
      detected_cms,
      execution_time_ms,
      source_id
    `)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentError) {
    console.log("❌ Error querying recent runs:", recentError.message);
  } else if (recentRuns && recentRuns.length > 0) {
    console.log("Time                | Strategy    | Events | Status  | CMS          | Time (ms)");
    console.log("──────────────────────────────────────────────────────────────────────────────");
    recentRuns.forEach(run => {
      const time = new Date(run.created_at).toLocaleString();
      const strategy = (run.winning_strategy || 'NONE').padEnd(11);
      const events = String(run.total_events_found || 0).padEnd(6);
      const status = (run.status || 'unknown').padEnd(7);
      const cms = (run.detected_cms || 'unknown').padEnd(12);
      const execTime = run.execution_time_ms || 0;
      console.log(`${time} | ${strategy} | ${events} | ${status} | ${cms} | ${execTime}`);
    });
  }
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Query 3: Total summary
  console.log("\n3️⃣  OVERALL SUMMARY:\n");
  
  const totalRuns = methodStats.length;
  const totalEvents = methodStats.reduce((sum, row) => sum + (row.total_events_found || 0), 0);
  const successfulRuns = methodStats.filter(row => row.status === 'success').length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;
  
  console.log(`Total Scraper Runs: ${totalRuns}`);
  console.log(`Total Events Found: ${totalEvents}`);
  console.log(`Successful Runs: ${successfulRuns} (${successRate}%)`);
  console.log(`Failed Runs: ${totalRuns - successfulRuns}`);
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("✅ Full test complete!\n");
  console.log("📖 For more details, see: WATERFALL_INTELLIGENCE_REPORT.md\n");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║        LCL WATERFALL INTELLIGENCE FULL TEST RUNNER          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  
  // Step 1: Check migration
  const migrationApplied = await checkMigrationApplied();
  if (!migrationApplied) {
    process.exit(1);
  }
  
  // Step 2: Trigger scraper
  const scraperTriggered = await triggerScraper();
  if (!scraperTriggered) {
    console.log("⚠️  Scraper failed to trigger, but continuing to check for existing insights...\n");
  }
  
  // Step 3: Wait for scraping
  if (scraperTriggered) {
    await waitForScraping();
  }
  
  // Step 4: Query insights
  await queryInsights();
}

main().catch(error => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
