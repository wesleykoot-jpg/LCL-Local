/**
 * Full Scraper Test - Runs scraper until 300+ events are collected
 * and reports on waterfall strategy distribution
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const TARGET_EVENTS = 300;
const MAX_ITERATIONS = 50;
const POLL_INTERVAL_MS = 10000; // 10 seconds

async function getEventCount() {
  const { count, error } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function getPendingJobCount() {
  const { count, error } = await supabase
    .from('scrape_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count || 0;
}

async function getProcessingJobCount() {
  const { count, error } = await supabase
    .from('scrape_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');
  if (error) return 0;
  return count || 0;
}

async function getInsightsCount() {
  const { count, error } = await supabase
    .from('scraper_insights')
    .select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

async function triggerCoordinator() {
  const url = `${SUPABASE_URL}/functions/v1/scrape-coordinator`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ triggerWorker: true }),
    });
    
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        return { success: true, message: text };
      }
    } else {
      console.log(`Coordinator returned ${response.status}: ${text.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error('Failed to trigger coordinator:', error.message);
    return null;
  }
}

async function triggerWorker() {
  const url = `${SUPABASE_URL}/functions/v1/scrape-worker`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ enableDeepScraping: true }),
    });
    
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        return { success: true, message: text };
      }
    } else {
      console.log(`Worker returned ${response.status}: ${text.substring(0, 200)}`);
      return null;
    }
  } catch (error) {
    console.error('Failed to trigger worker:', error.message);
    return null;
  }
}

async function getInsightsSummary() {
  const { data, error } = await supabase
    .from('scraper_insights')
    .select('winning_strategy, total_events_found, status, execution_time_ms, detected_cms');
  
  if (error || !data) return null;
  
  const summary = {
    totalRuns: data.length,
    totalEventsFromInsights: 0,
    byStrategy: {},
    byCMS: {},
    byStatus: {}
  };
  
  data.forEach(row => {
    const strategy = row.winning_strategy || 'NONE';
    const cms = row.detected_cms || 'unknown';
    const status = row.status || 'unknown';
    const events = row.total_events_found || 0;
    
    summary.totalEventsFromInsights += events;
    
    if (!summary.byStrategy[strategy]) {
      summary.byStrategy[strategy] = { runs: 0, events: 0, times: [] };
    }
    summary.byStrategy[strategy].runs++;
    summary.byStrategy[strategy].events += events;
    if (row.execution_time_ms) {
      summary.byStrategy[strategy].times.push(row.execution_time_ms);
    }
    
    summary.byCMS[cms] = (summary.byCMS[cms] || 0) + 1;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
  });
  
  return summary;
}

async function getSourcesSummary() {
  const { data, error } = await supabase
    .from('scraper_sources')
    .select('id, name, total_events_scraped, preferred_method, fetcher_type, detected_cms, tier, enabled');
  
  if (error || !data) return null;
  
  return {
    total: data.length,
    enabled: data.filter(s => s.enabled).length,
    withEvents: data.filter(s => (s.total_events_scraped || 0) > 0).length,
    totalEventsScraped: data.reduce((sum, s) => sum + (s.total_events_scraped || 0), 0),
    byFetcher: data.reduce((acc, s) => {
      const f = s.fetcher_type || 'unknown';
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {}),
    byPreferredMethod: data.reduce((acc, s) => {
      const m = s.preferred_method || 'auto';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {})
  };
}

async function printProgress(iteration, startCount, currentCount, pendingJobs, processingJobs, insights) {
  const newEvents = currentCount - startCount;
  const progress = Math.min(100, Math.round((newEvents / TARGET_EVENTS) * 100));
  const bar = '█'.repeat(Math.floor(progress / 5)) + '░'.repeat(20 - Math.floor(progress / 5));
  
  console.log(`\n[Iteration ${iteration}] Progress: [${bar}] ${progress}% (${newEvents}/${TARGET_EVENTS} events)`);
  console.log(`   Events in DB: ${currentCount} | Pending Jobs: ${pendingJobs} | Processing: ${processingJobs} | Insights: ${insights}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║             LCL FULL SCRAPER TEST - TARGET: 300 NEW EVENTS              ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  
  const startTime = Date.now();
  const startEventCount = await getEventCount();
  const startInsightsCount = await getInsightsCount();
  
  console.log(`📊 Starting State:`);
  console.log(`   Events in database: ${startEventCount}`);
  console.log(`   Insights recorded: ${startInsightsCount}`);
  console.log(`   Target: +${TARGET_EVENTS} new events\n`);
  
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Step 1: Trigger coordinator to queue jobs
  console.log("🚀 Step 1: Triggering scrape coordinator...\n");
  const coordResult = await triggerCoordinator();
  
  if (coordResult) {
    console.log(`   ✅ Coordinator response: ${JSON.stringify(coordResult).substring(0, 200)}`);
  } else {
    console.log("   ⚠️  Coordinator didn't respond as expected, continuing anyway...");
  }
  
  // Step 2: Poll for progress
  console.log("\n🔄 Step 2: Monitoring scraper progress...\n");
  
  let iteration = 0;
  let newEventsCollected = 0;
  let consecutiveNoProgress = 0;
  
  while (iteration < MAX_ITERATIONS && newEventsCollected < TARGET_EVENTS) {
    iteration++;
    
    const currentEventCount = await getEventCount();
    const pendingJobs = await getPendingJobCount();
    const processingJobs = await getProcessingJobCount();
    const insightsCount = await getInsightsCount();
    
    newEventsCollected = currentEventCount - startEventCount;
    
    await printProgress(iteration, startEventCount, currentEventCount, pendingJobs, processingJobs, insightsCount);
    
    // If no progress for 3 iterations and still have work to do
    if (newEventsCollected === (currentEventCount - startEventCount)) {
      consecutiveNoProgress++;
    } else {
      consecutiveNoProgress = 0;
    }
    
    // If no pending/processing jobs and haven't hit target, trigger more
    if (pendingJobs === 0 && processingJobs === 0 && newEventsCollected < TARGET_EVENTS) {
      console.log("   📋 No pending jobs, triggering coordinator again...");
      await triggerCoordinator();
    } else if (pendingJobs > 0 && processingJobs === 0) {
      // Jobs queued but not processing, trigger worker
      console.log("   ⚡ Jobs pending but not processing, triggering worker...");
      await triggerWorker();
    }
    
    // If stuck, try to recover
    if (consecutiveNoProgress >= 5) {
      console.log("   🔧 Appears stuck, forcing worker trigger...");
      await triggerWorker();
      consecutiveNoProgress = 0;
    }
    
    // Wait before next poll
    if (newEventsCollected < TARGET_EVENTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  
  // Step 3: Final Summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📊 FINAL RESULTS\n");
  
  const finalEventCount = await getEventCount();
  const totalNewEvents = finalEventCount - startEventCount;
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`✅ Events collected: ${totalNewEvents} (target was ${TARGET_EVENTS})`);
  console.log(`⏱️  Time elapsed: ${elapsedSeconds} seconds`);
  console.log(`📈 Events in database: ${startEventCount} → ${finalEventCount}`);
  
  // Get insights summary
  console.log("\n\n📈 WATERFALL STRATEGY DISTRIBUTION");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const insights = await getInsightsSummary();
  
  if (insights && insights.totalRuns > 0) {
    console.log(`Total Scraper Runs: ${insights.totalRuns}`);
    console.log(`Total Events (from insights): ${insights.totalEventsFromInsights}\n`);
    
    console.log("Strategy Distribution:");
    console.log("─────────────────────────────────────────────────────────────────────");
    console.log("Strategy       | Runs | Events | % Runs  | % Events | Avg Time (ms)");
    console.log("─────────────────────────────────────────────────────────────────────");
    
    const sortedStrategies = Object.entries(insights.byStrategy)
      .sort((a, b) => b[1].events - a[1].events);
    
    for (const [strategy, stats] of sortedStrategies) {
      const avgTime = stats.times.length > 0 
        ? Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length)
        : 0;
      const runsPct = ((stats.runs / insights.totalRuns) * 100).toFixed(1);
      const eventsPct = insights.totalEventsFromInsights > 0 
        ? ((stats.events / insights.totalEventsFromInsights) * 100).toFixed(1)
        : '0.0';
      
      console.log(`${strategy.padEnd(14)} | ${String(stats.runs).padStart(4)} | ${String(stats.events).padStart(6)} | ${runsPct.padStart(6)}% | ${eventsPct.padStart(7)}% | ${String(avgTime).padStart(13)}`);
    }
    
    console.log("\nCMS Detection:");
    console.log("─────────────────────────────────────────");
    Object.entries(insights.byCMS).sort((a, b) => b[1] - a[1]).forEach(([cms, count]) => {
      console.log(`  ${cms.padEnd(20)} : ${count} runs`);
    });
    
    console.log("\nStatus Distribution:");
    console.log("─────────────────────────────────────────");
    Object.entries(insights.byStatus).forEach(([status, count]) => {
      console.log(`  ${status.padEnd(15)} : ${count} runs`);
    });
  } else {
    console.log("⚠️  No waterfall insights recorded yet.");
    console.log("   The scrape-worker may not have logged insights, or no runs completed.");
  }
  
  // Sources summary
  console.log("\n\n📋 SOURCES SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const sources = await getSourcesSummary();
  if (sources) {
    console.log(`Total Sources: ${sources.total}`);
    console.log(`Enabled: ${sources.enabled}`);
    console.log(`With Events: ${sources.withEvents} (${((sources.withEvents / sources.total) * 100).toFixed(1)}%)`);
    console.log(`Total Events Scraped (all time): ${sources.totalEventsScraped}`);
    
    console.log("\nBy Fetcher Type:");
    Object.entries(sources.byFetcher).sort((a, b) => b[1] - a[1]).forEach(([f, c]) => {
      console.log(`  ${f.padEnd(20)} : ${c} sources`);
    });
    
    console.log("\nBy Preferred Method:");
    Object.entries(sources.byPreferredMethod).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
      console.log(`  ${m.padEnd(15)} : ${c} sources`);
    });
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  
  if (totalNewEvents >= TARGET_EVENTS) {
    console.log(`\n🎉 SUCCESS! Collected ${totalNewEvents} new events (target: ${TARGET_EVENTS})`);
  } else {
    console.log(`\n⚠️  Collected ${totalNewEvents} events, short of ${TARGET_EVENTS} target.`);
    console.log("   This may indicate issues with sources or the scraper needs more time.");
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════\n");
}

main().catch(error => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
