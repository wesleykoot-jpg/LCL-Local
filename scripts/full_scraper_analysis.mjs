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
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║      LCL FULL SCRAPER ANALYSIS - WATERFALL & DISTRIBUTION REPORT         ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  
  // ========================================
  // PART 1: SOURCES ANALYSIS
  // ========================================
  console.log("📋 1. SCRAPER SOURCES OVERVIEW");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const { data: sources, error: sourcesError } = await supabase
    .from('scraper_sources')
    .select('id, name, url, enabled, tier, preferred_method, detected_cms, total_events_scraped, last_success, consecutive_failures, fetcher_type, consecutive_zero_events');
  
  if (sourcesError) {
    console.log("❌ Error fetching sources:", sourcesError.message);
    return;
  }
  
  console.log(`Total Sources: ${sources.length}`);
  console.log(`Enabled Sources: ${sources.filter(s => s.enabled).length}`);
  console.log(`Disabled Sources: ${sources.filter(s => !s.enabled).length}\n`);
  
  // Group by tier
  const tierCounts = {};
  sources.forEach(s => {
    const tier = s.tier || 'general';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });
  
  console.log("Sources by Tier:");
  console.log("─────────────────────────────────────────");
  Object.entries(tierCounts).sort((a, b) => b[1] - a[1]).forEach(([tier, count]) => {
    console.log(`  ${tier.padEnd(15)} : ${count} sources`);
  });
  
  // Group by preferred_method
  const methodCounts = {};
  sources.forEach(s => {
    const method = s.preferred_method || 'auto';
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });
  
  console.log("\nSources by Preferred Method:");
  console.log("─────────────────────────────────────────");
  Object.entries(methodCounts).sort((a, b) => b[1] - a[1]).forEach(([method, count]) => {
    const pct = ((count / sources.length) * 100).toFixed(1);
    console.log(`  ${method.padEnd(15)} : ${String(count).padStart(3)} sources (${pct}%)`);
  });
  
  // Group by fetcher_type
  const fetcherCounts = {};
  sources.forEach(s => {
    const fetcher = s.fetcher_type || 'unknown';
    fetcherCounts[fetcher] = (fetcherCounts[fetcher] || 0) + 1;
  });
  
  console.log("\nSources by Fetcher Type:");
  console.log("─────────────────────────────────────────");
  Object.entries(fetcherCounts).sort((a, b) => b[1] - a[1]).forEach(([fetcher, count]) => {
    const pct = ((count / sources.length) * 100).toFixed(1);
    console.log(`  ${fetcher.padEnd(20)} : ${String(count).padStart(3)} sources (${pct}%)`);
  });
  
  // Group by CMS
  const cmsCounts = {};
  sources.forEach(s => {
    const cms = s.detected_cms || 'unknown';
    cmsCounts[cms] = (cmsCounts[cms] || 0) + 1;
  });
  
  console.log("\nSources by Detected CMS:");
  console.log("─────────────────────────────────────────");
  Object.entries(cmsCounts).sort((a, b) => b[1] - a[1]).forEach(([cms, count]) => {
    console.log(`  ${cms.padEnd(20)} : ${count} sources`);
  });
  
  // ========================================
  // PART 2: EVENT DISTRIBUTION BY SOURCE
  // ========================================
  console.log("\n\n📊 2. EVENT DISTRIBUTION BY SOURCE");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  // Get events with source_id
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, source_id, title');
  
  if (eventsError) {
    console.log("❌ Error fetching events:", eventsError.message);
  } else {
    console.log(`Total Events in Database: ${events.length}\n`);
    
    // Group by source
    const eventsBySource = {};
    events.forEach(e => {
      const sourceId = e.source_id || 'unknown';
      eventsBySource[sourceId] = (eventsBySource[sourceId] || 0) + 1;
    });
    
    // Create enriched list
    const sourcesWithEvents = sources.map(s => ({
      ...s,
      eventCount: eventsBySource[s.id] || 0,
      scraperTotal: s.total_events_scraped || 0
    })).sort((a, b) => b.eventCount - a.eventCount);
    
    console.log("Events per Source (sorted by event count):");
    console.log("─────────────────────────────────────────────────────────────────────");
    console.log("Source Name                      | Events | Scraper Total | Method      | Fetcher Type");
    console.log("─────────────────────────────────────────────────────────────────────");
    
    sourcesWithEvents.slice(0, 15).forEach(s => {
      const name = (s.name || 'Unknown').substring(0, 30).padEnd(30);
      const events = String(s.eventCount).padStart(6);
      const total = String(s.scraperTotal).padStart(13);
      const method = (s.preferred_method || 'auto').padEnd(11);
      const fetcher = (s.fetcher_type || 'unknown').padEnd(15);
      console.log(`${name} | ${events} | ${total} | ${method} | ${fetcher}`);
    });
    
    // Calculate totals
    const totalFromSources = sourcesWithEvents.reduce((sum, s) => sum + s.scraperTotal, 0);
    console.log("─────────────────────────────────────────────────────────────────────");
    console.log(`Total events scraped (from source stats): ${totalFromSources}`);
    console.log(`Total events in events table: ${events.length}`);
  }
  
  // ========================================
  // PART 3: SOURCES WITH 0 EVENTS
  // ========================================
  console.log("\n\n⚠️  3. SOURCES WITH 0 EVENTS (Waterfall Investigation)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const zeroEventSources = sources.filter(s => !s.total_events_scraped || s.total_events_scraped === 0);
  console.log(`Found ${zeroEventSources.length} sources with 0 events scraped:\n`);
  
  // Group zero-event sources by preferred_method
  const zeroByMethod = {};
  const zeroByFetcher = {};
  const zeroByCMS = {};
  
  zeroEventSources.forEach(s => {
    const method = s.preferred_method || 'auto';
    const fetcher = s.fetcher_type || 'unknown';
    const cms = s.detected_cms || 'unknown';
    
    zeroByMethod[method] = (zeroByMethod[method] || 0) + 1;
    zeroByFetcher[fetcher] = (zeroByFetcher[fetcher] || 0) + 1;
    zeroByCMS[cms] = (zeroByCMS[cms] || 0) + 1;
  });
  
  console.log("Zero-Event Sources by Preferred Method:");
  console.log("─────────────────────────────────────────");
  Object.entries(zeroByMethod).sort((a, b) => b[1] - a[1]).forEach(([method, count]) => {
    console.log(`  ${method.padEnd(15)} : ${count} sources`);
  });
  
  console.log("\nZero-Event Sources by Fetcher Type:");
  console.log("─────────────────────────────────────────");
  Object.entries(zeroByFetcher).sort((a, b) => b[1] - a[1]).forEach(([fetcher, count]) => {
    console.log(`  ${fetcher.padEnd(20)} : ${count} sources`);
  });
  
  console.log("\nZero-Event Sources by Detected CMS:");
  console.log("─────────────────────────────────────────");
  Object.entries(zeroByCMS).sort((a, b) => b[1] - a[1]).forEach(([cms, count]) => {
    console.log(`  ${cms.padEnd(20)} : ${count} sources`);
  });
  
  console.log("\nDetailed Zero-Event Sources:");
  console.log("─────────────────────────────────────────────────────────────────────");
  zeroEventSources.slice(0, 20).forEach(s => {
    const enabled = s.enabled ? '✅' : '❌';
    const failures = s.consecutive_failures || 0;
    const zeroStreak = s.consecutive_zero_events || 0;
    const lastSuccess = s.last_success ? new Date(s.last_success).toISOString().substring(0, 10) : 'never';
    console.log(`\n${enabled} ${s.name}`);
    console.log(`   URL: ${s.url}`);
    console.log(`   Method: ${s.preferred_method || 'auto'} | Fetcher: ${s.fetcher_type || 'unknown'} | CMS: ${s.detected_cms || 'unknown'}`);
    console.log(`   Failures: ${failures} | Zero Event Streak: ${zeroStreak} | Last Success: ${lastSuccess}`);
  });
  
  // ========================================
  // PART 4: WATERFALL STRATEGY INSIGHTS
  // ========================================
  console.log("\n\n🔄 4. WATERFALL STRATEGY INSIGHTS");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const { data: insights, error: insightsError } = await supabase
    .from('scraper_insights')
    .select('*');
  
  if (insightsError) {
    console.log("❌ Error fetching insights:", insightsError.message);
  } else if (!insights || insights.length === 0) {
    console.log("⚠️  No insights data available yet!");
    console.log("\n💡 The waterfall extraction logic is IMPLEMENTED in:");
    console.log("   📂 supabase/functions/_shared/dataExtractors.ts");
    console.log("\n   The waterfall tries strategies in this order:");
    console.log("   1️⃣  HYDRATION - Extract from Next.js/React __NEXT_DATA__, etc.");
    console.log("   2️⃣  JSON-LD   - Parse Schema.org structured data");
    console.log("   3️⃣  FEED      - RSS/Atom/ICS feed discovery and parsing");
    console.log("   4️⃣  DOM       - CSS selector-based fallback extraction");
    console.log("\n   However, the scrape-worker edge function may not be logging insights yet.");
    console.log("   To enable insights tracking, the scrape-worker needs to call:");
    console.log("   - runExtractionWaterfall() from dataExtractors.ts");
    console.log("   - logScraperInsight() to record results");
  } else {
    // Aggregate insights
    const strategyStats = {};
    insights.forEach(i => {
      const strategy = i.winning_strategy || 'NONE';
      if (!strategyStats[strategy]) {
        strategyStats[strategy] = { runs: 0, events: 0, times: [] };
      }
      strategyStats[strategy].runs++;
      strategyStats[strategy].events += i.total_events_found || 0;
      if (i.execution_time_ms) strategyStats[strategy].times.push(i.execution_time_ms);
    });
    
    console.log("Winning Strategy Distribution:");
    console.log("─────────────────────────────────────────────────────────────────────");
    console.log("Strategy       | Runs | Events | Avg Time (ms) | % of Runs | % of Events");
    console.log("─────────────────────────────────────────────────────────────────────");
    
    const totalRuns = insights.length;
    const totalEvents = insights.reduce((sum, i) => sum + (i.total_events_found || 0), 0);
    
    Object.entries(strategyStats).sort((a, b) => b[1].events - a[1].events).forEach(([strategy, stats]) => {
      const avgTime = stats.times.length > 0 
        ? Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length)
        : 0;
      const runsPct = ((stats.runs / totalRuns) * 100).toFixed(1);
      const eventsPct = totalEvents > 0 ? ((stats.events / totalEvents) * 100).toFixed(1) : '0.0';
      console.log(`${strategy.padEnd(14)} | ${String(stats.runs).padStart(4)} | ${String(stats.events).padStart(6)} | ${String(avgTime).padStart(13)} | ${runsPct.padStart(9)}% | ${eventsPct.padStart(10)}%`);
    });
  }
  
  // ========================================
  // PART 5: SUMMARY & RECOMMENDATIONS
  // ========================================
  console.log("\n\n📈 5. SUMMARY & RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const enabledSources = sources.filter(s => s.enabled);
  const hasEvents = sources.filter(s => s.total_events_scraped > 0);
  const noEvents = sources.filter(s => !s.total_events_scraped || s.total_events_scraped === 0);
  
  console.log("📊 Overall Statistics:");
  console.log(`   Total Sources: ${sources.length}`);
  console.log(`   Enabled: ${enabledSources.length} (${((enabledSources.length/sources.length)*100).toFixed(1)}%)`);
  console.log(`   With Events: ${hasEvents.length} (${((hasEvents.length/sources.length)*100).toFixed(1)}%)`);
  console.log(`   With Zero Events: ${noEvents.length} (${((noEvents.length/sources.length)*100).toFixed(1)}%)`);
  
  console.log("\n🔍 Waterfall Status:");
  if (!insights || insights.length === 0) {
    console.log("   ⚠️  NO WATERFALL INSIGHTS BEING LOGGED");
    console.log("   The waterfall logic exists in dataExtractors.ts but insights aren't being recorded.");
    console.log("   This means we can't currently see which strategies are being used.");
  } else {
    console.log("   ✅ Waterfall insights are being logged");
  }
  
  console.log("\n💡 Recommendations:");
  console.log("   1. Enable waterfall insights logging in scrape-worker");
  console.log("   2. Review sources with 0 events for proper configuration");
  console.log("   3. Test waterfall locally using the dataExtractors.ts functions");
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("✅ Full scraper analysis complete!");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
