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

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           LCL SCRAPER INSIGHTS QUERY TOOL                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  
  console.log("📊 Querying scraper insights...\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Query 1: Extraction method summary
  console.log("\n1️⃣  EXTRACTION METHOD DISTRIBUTION:\n");
  
  const { data: methodStats, error: methodError } = await supabase
    .from('scraper_insights')
    .select('winning_strategy, total_events_found, status, execution_time_ms');
  
  if (methodError) {
    console.log("❌ Error querying insights:", methodError.message);
    console.log("\n💡 Make sure the migration has been applied:");
    console.log("   supabase/migrations/20260121000000_data_first_pipeline.sql\n");
    process.exit(1);
  }
  
  if (!methodStats || methodStats.length === 0) {
    console.log("⚠️  No insights found yet.\n");
    console.log("💡 Run the scraper first:");
    console.log("   node scripts/run_full_waterfall_test.mjs\n");
    process.exit(0);
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
  console.log("\n2️⃣  RECENT SCRAPER RUNS (Last 20):\n");
  
  const { data: recentRuns, error: recentError } = await supabase
    .from('scraper_insights')
    .select(`
      created_at,
      winning_strategy,
      total_events_found,
      status,
      detected_cms,
      execution_time_ms
    `)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (recentError) {
    console.log("❌ Error querying recent runs:", recentError.message);
  } else if (recentRuns && recentRuns.length > 0) {
    console.log("Time                | Strategy    | Events | Status  | CMS          | Time (ms)");
    console.log("──────────────────────────────────────────────────────────────────────────────");
    recentRuns.forEach(run => {
      const time = new Date(run.created_at).toISOString().replace('T', ' ').substring(0, 19);
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
  
  // Query 4: CMS Detection Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n4️⃣  CMS/FRAMEWORK DETECTION:\n");
  
  const cmsCounts = {};
  methodStats.forEach(row => {
    const cms = row.detected_cms || 'unknown';
    cmsCounts[cms] = (cmsCounts[cms] || 0) + 1;
  });
  
  const sortedCMS = Object.keys(cmsCounts).sort((a, b) => cmsCounts[b] - cmsCounts[a]);
  
  console.log("CMS/Framework    | Count");
  console.log("─────────────────────────");
  sortedCMS.forEach(cms => {
    console.log(`${cms.padEnd(16)} | ${cmsCounts[cms]}`);
  });
  
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  console.log("✅ Query complete!\n");
  console.log("📖 For more analysis queries, see: WATERFALL_INTELLIGENCE_REPORT.md\n");
}

main().catch(error => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
