/**
 * Scraper Distribution Analysis
 * Analyzes existing scraper data to understand waterfall strategy distribution
 */

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './_shared/loadEnv.mjs';

const env = loadEnv(import.meta.url);
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║          LCL SCRAPER DISTRIBUTION & WATERFALL ANALYSIS REPORT            ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  
  // ========================================
  // 1. OVERALL SOURCES STATUS
  // ========================================
  console.log("📋 1. SCRAPER SOURCES OVERVIEW");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const { data: sources, error: sourcesError } = await supabase
    .from('scraper_sources')
    .select('*');
  
  if (sourcesError) {
    console.error("❌ Failed to load sources:", sourcesError.message);
    return;
  }
  
  const enabled = sources.filter(s => s.enabled);
  const withEvents = sources.filter(s => (s.total_events_scraped || 0) > 0);
  const zeroEvents = sources.filter(s => !s.total_events_scraped || s.total_events_scraped === 0);
  
  console.log(`Total Sources:          ${sources.length}`);
  console.log(`Enabled Sources:        ${enabled.length} (${((enabled.length/sources.length)*100).toFixed(1)}%)`);
  console.log(`Sources with Events:    ${withEvents.length} (${((withEvents.length/sources.length)*100).toFixed(1)}%)`);
  console.log(`Sources with 0 Events:  ${zeroEvents.length} (${((zeroEvents.length/sources.length)*100).toFixed(1)}%)`);
  
  const totalEventsScraped = sources.reduce((sum, s) => sum + (s.total_events_scraped || 0), 0);
  console.log(`\nTotal Events Scraped (all-time): ${totalEventsScraped.toLocaleString()}`);
  
  // ========================================
  // 2. FETCHER TYPE DISTRIBUTION
  // ========================================
  console.log("\n\n📡 2. FETCHER TYPE DISTRIBUTION");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const byFetcher = {};
  sources.forEach(s => {
    const fetcher = s.fetcher_type || 'unknown';
    if (!byFetcher[fetcher]) byFetcher[fetcher] = { sources: 0, events: 0, enabled: 0 };
    byFetcher[fetcher].sources++;
    byFetcher[fetcher].events += s.total_events_scraped || 0;
    if (s.enabled) byFetcher[fetcher].enabled++;
  });
  
  console.log("Fetcher Type       | Sources | Enabled | Events    | % Events");
  console.log("─────────────────────────────────────────────────────────────────");
  
  const sortedFetchers = Object.entries(byFetcher).sort((a, b) => b[1].events - a[1].events);
  for (const [fetcher, stats] of sortedFetchers) {
    const pct = totalEventsScraped > 0 ? ((stats.events / totalEventsScraped) * 100).toFixed(1) : '0.0';
    console.log(`${fetcher.padEnd(18)} | ${String(stats.sources).padStart(7)} | ${String(stats.enabled).padStart(7)} | ${String(stats.events).padStart(9)} | ${pct.padStart(7)}%`);
  }
  
  // ========================================
  // 3. PREFERRED METHOD DISTRIBUTION
  // ========================================
  console.log("\n\n🔄 3. PREFERRED EXTRACTION METHOD");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const byMethod = {};
  sources.forEach(s => {
    const method = s.preferred_method || 'auto';
    if (!byMethod[method]) byMethod[method] = { sources: 0, events: 0, zeroEvents: 0 };
    byMethod[method].sources++;
    byMethod[method].events += s.total_events_scraped || 0;
    if ((s.total_events_scraped || 0) === 0) byMethod[method].zeroEvents++;
  });
  
  console.log("Method         | Sources | Events    | Zero-Event Sources | % Events");
  console.log("─────────────────────────────────────────────────────────────────────────");
  
  const sortedMethods = Object.entries(byMethod).sort((a, b) => b[1].events - a[1].events);
  for (const [method, stats] of sortedMethods) {
    const pct = totalEventsScraped > 0 ? ((stats.events / totalEventsScraped) * 100).toFixed(1) : '0.0';
    console.log(`${method.padEnd(14)} | ${String(stats.sources).padStart(7)} | ${String(stats.events).padStart(9)} | ${String(stats.zeroEvents).padStart(18)} | ${pct.padStart(7)}%`);
  }
  
  console.log("\n💡 Note: All sources are currently set to 'auto' which means the waterfall");
  console.log("   tries strategies in order: hydration → json_ld → feed → dom");
  
  // ========================================
  // 4. TIER DISTRIBUTION
  // ========================================
  console.log("\n\n🏷️  4. SOURCE TIER DISTRIBUTION");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const byTier = {};
  sources.forEach(s => {
    const tier = s.tier || 'general';
    if (!byTier[tier]) byTier[tier] = { sources: 0, events: 0 };
    byTier[tier].sources++;
    byTier[tier].events += s.total_events_scraped || 0;
  });
  
  console.log("Tier           | Sources | Events    | Avg Events/Source");
  console.log("─────────────────────────────────────────────────────────────");
  
  for (const [tier, stats] of Object.entries(byTier).sort((a, b) => b[1].events - a[1].events)) {
    const avg = stats.sources > 0 ? Math.round(stats.events / stats.sources) : 0;
    console.log(`${tier.padEnd(14)} | ${String(stats.sources).padStart(7)} | ${String(stats.events).padStart(9)} | ${String(avg).padStart(17)}`);
  }
  
  // ========================================
  // 5. TOP PERFORMING SOURCES
  // ========================================
  console.log("\n\n🏆 5. TOP 20 SOURCES BY EVENTS SCRAPED");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const topSources = [...sources]
    .sort((a, b) => (b.total_events_scraped || 0) - (a.total_events_scraped || 0))
    .slice(0, 20);
  
  console.log("Source                                   | Events  | Fetcher     | Method");
  console.log("─────────────────────────────────────────────────────────────────────────────");
  
  for (const source of topSources) {
    const name = source.name.substring(0, 38).padEnd(38);
    const events = String(source.total_events_scraped || 0).padStart(7);
    const fetcher = (source.fetcher_type || 'unknown').padEnd(11);
    const method = source.preferred_method || 'auto';
    console.log(`${name} | ${events} | ${fetcher} | ${method}`);
  }
  
  // ========================================
  // 6. ZERO-EVENT SOURCES ANALYSIS
  // ========================================
  console.log("\n\n⚠️  6. ZERO-EVENT SOURCES ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const enabledZeroEvent = zeroEvents.filter(s => s.enabled);
  console.log(`Total zero-event sources: ${zeroEvents.length}`);
  console.log(`Enabled zero-event sources: ${enabledZeroEvent.length}\n`);
  
  // Group by fetcher type
  const zeroByFetcher = {};
  enabledZeroEvent.forEach(s => {
    const fetcher = s.fetcher_type || 'unknown';
    zeroByFetcher[fetcher] = (zeroByFetcher[fetcher] || 0) + 1;
  });
  
  console.log("Zero-Event Sources by Fetcher Type:");
  console.log("─────────────────────────────────────────");
  for (const [fetcher, count] of Object.entries(zeroByFetcher).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${fetcher.padEnd(15)} : ${count} sources`);
  }
  
  // Sample of enabled zero-event sources
  console.log("\nSample Enabled Sources with 0 Events:");
  console.log("─────────────────────────────────────────────────────────────────────────────");
  
  const sampleZero = enabledZeroEvent.slice(0, 10);
  for (const source of sampleZero) {
    console.log(`\n  ${source.name}`);
    console.log(`    URL: ${source.url}`);
    console.log(`    Fetcher: ${source.fetcher_type || 'unknown'} | Failures: ${source.consecutive_failures || 0}`);
    if (source.last_error) console.log(`    Last Error: ${source.last_error.substring(0, 80)}`);
  }
  
  // ========================================
  // 7. SCRAPER INSIGHTS (Waterfall Tracking)
  // ========================================
  console.log("\n\n📊 7. SCRAPER INSIGHTS (Waterfall Strategy Tracking)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const { data: insights, error: insightsError } = await supabase
    .from('scraper_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (insightsError) {
    console.log("❌ Error fetching insights:", insightsError.message);
  } else if (!insights || insights.length === 0) {
    console.log("⚠️  NO WATERFALL INSIGHTS RECORDED YET");
    console.log("\n   The scraper_insights table exists but has no data.");
    console.log("   This means the scrape-worker hasn't logged any waterfall results yet.\n");
    console.log("   Expected data after scraper runs:");
    console.log("   - winning_strategy: Which extraction method worked (hydration/json_ld/feed/dom)");
    console.log("   - total_events_found: How many events each strategy found");
    console.log("   - strategy_trace: Details of what each strategy tried");
    console.log("   - detected_cms: CMS/framework detected (WordPress, Next.js, etc.)");
  } else {
    console.log(`Found ${insights.length} insight records\n`);
    
    // Aggregate
    const strategyStats = {};
    insights.forEach(i => {
      const strategy = i.winning_strategy || 'NONE';
      if (!strategyStats[strategy]) strategyStats[strategy] = { runs: 0, events: 0 };
      strategyStats[strategy].runs++;
      strategyStats[strategy].events += i.total_events_found || 0;
    });
    
    console.log("Waterfall Strategy Distribution (from insights):");
    console.log("─────────────────────────────────────────────────────────────");
    console.log("Strategy       | Runs | Events | % Runs  | % Events");
    console.log("─────────────────────────────────────────────────────────────");
    
    const totalRuns = insights.length;
    const totalInsightEvents = insights.reduce((sum, i) => sum + (i.total_events_found || 0), 0);
    
    for (const [strategy, stats] of Object.entries(strategyStats).sort((a, b) => b[1].events - a[1].events)) {
      const runsPct = ((stats.runs / totalRuns) * 100).toFixed(1);
      const eventsPct = totalInsightEvents > 0 ? ((stats.events / totalInsightEvents) * 100).toFixed(1) : '0.0';
      console.log(`${strategy.padEnd(14)} | ${String(stats.runs).padStart(4)} | ${String(stats.events).padStart(6)} | ${runsPct.padStart(6)}% | ${eventsPct.padStart(7)}%`);
    }
  }
  
  // ========================================
  // 8. SUMMARY & RECOMMENDATIONS
  // ========================================
  console.log("\n\n📈 8. SUMMARY & RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  console.log("📊 Current State:");
  console.log(`   - ${sources.length} total sources configured`);
  console.log(`   - ${enabled.length} enabled (${((enabled.length/sources.length)*100).toFixed(1)}%)`);
  console.log(`   - ${withEvents.length} sources have scraped events (${((withEvents.length/sources.length)*100).toFixed(1)}%)`);
  console.log(`   - ${totalEventsScraped.toLocaleString()} total events scraped (all-time)`);
  
  console.log("\n🔄 Waterfall Logic Status:");
  if (!insights || insights.length === 0) {
    console.log("   ⚠️  The waterfall extraction is IMPLEMENTED but insights aren't being logged.");
    console.log("   The scrape-worker code includes:");
    console.log("     - runExtractionWaterfall() - tries hydration → json_ld → feed → dom");
    console.log("     - logScraperInsight() - should log results to scraper_insights table");
    console.log("   ");
    console.log("   To see waterfall distribution, you need to:");
    console.log("     1. Deploy/run the scrape-worker edge function");
    console.log("     2. Trigger scraping for enabled sources");
    console.log("     3. Check scraper_insights table for results");
  }
  
  console.log("\n💡 Recommendations for Sources with 0 Events:");
  console.log(`   ${enabledZeroEvent.length} enabled sources have 0 events scraped.`);
  
  const zeroStaticCount = (zeroByFetcher['static'] || 0);
  const zeroPuppeteerCount = (zeroByFetcher['puppeteer'] || 0);
  const zeroScrapingbeeCount = (zeroByFetcher['scrapingbee'] || 0);
  
  if (zeroStaticCount > 0) {
    console.log(`   - ${zeroStaticCount} use 'static' fetcher - may need JS rendering or different selectors`);
  }
  if (zeroPuppeteerCount > 0) {
    console.log(`   - ${zeroPuppeteerCount} use 'puppeteer' - check if pages are loading correctly`);
  }
  if (zeroScrapingbeeCount > 0) {
    console.log(`   - ${zeroScrapingbeeCount} use 'scrapingbee' - verify API key and rendering settings`);
  }
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("                           ANALYSIS COMPLETE                                ");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
