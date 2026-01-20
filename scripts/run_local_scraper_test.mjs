/**
 * Local Scraper Test - Runs scraping locally without edge functions
 * Tests the waterfall extraction logic and reports on distribution
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
const envContent = readFileSync(join(__dirname, '../.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const SUPABASE_URL = env['VITE_SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// WATERFALL EXTRACTION LOGIC (Portable Node.js Version)
// ============================================================================

const HYDRATION_PATTERNS = [
  { name: '__NEXT_DATA__', regex: /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i },
  { name: '__NUXT__', regex: /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: '__INITIAL_STATE__', regex: /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
];

const VALID_EVENT_TYPES = [
  'Event', 'SportsEvent', 'MusicEvent', 'Festival', 'TheaterEvent',
  'DanceEvent', 'ComedyEvent', 'ExhibitionEvent', 'SocialEvent',
];

const DEFAULT_SELECTORS = [
  "article.event", ".event-item", ".event-card", "[itemtype*='Event']",
  ".agenda-item", ".calendar-event", "[class*='event']", "[class*='agenda']",
  "li.event", ".post-item", ".datum-item", ".activity-card",
];

function extractFromHydration(html) {
  const events = [];
  for (const pattern of HYDRATION_PATTERNS) {
    const match = html.match(pattern.regex);
    if (!match || !match[1]) continue;
    try {
      const data = JSON.parse(match[1]);
      const found = findEventsInObject(data, 0);
      events.push(...found);
      if (events.length > 0) break;
    } catch { continue; }
  }
  return { strategy: 'hydration', found: events.length, events };
}

function findEventsInObject(obj, depth = 0) {
  if (depth > 8 || !obj || typeof obj !== 'object') return [];
  const events = [];
  
  if (isEventLike(obj)) {
    events.push({ title: obj.title || obj.name, date: obj.date || obj.startDate });
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (isEventLike(item)) events.push({ title: item.title || item.name, date: item.date || item.startDate });
      else events.push(...findEventsInObject(item, depth + 1));
    }
  } else {
    for (const value of Object.values(obj)) {
      events.push(...findEventsInObject(value, depth + 1));
    }
  }
  return events;
}

function isEventLike(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const hasTitle = 'title' in obj || 'name' in obj || 'eventName' in obj;
  const hasDate = 'date' in obj || 'startDate' in obj || 'start_date' in obj;
  return hasTitle && hasDate;
}

function extractFromJsonLd(html) {
  const events = [];
  const $ = cheerio.load(html);
  
  $('script[type="application/ld+json"]').each((_, script) => {
    const content = $(script).html();
    if (!content) return;
    try {
      let data = JSON.parse(content);
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        if (item && item['@graph']) items.push(...item['@graph']);
        if (!isValidEventSchema(item)) continue;
        events.push({
          title: item.name || item.headline,
          date: item.startDate,
          location: item.location?.name || '',
        });
      }
    } catch { return; }
  });
  
  return { strategy: 'json_ld', found: events.length, events };
}

function isValidEventSchema(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const type = obj['@type'];
  if (!type) return false;
  const types = Array.isArray(type) ? type : [type];
  return types.some(t => VALID_EVENT_TYPES.includes(String(t)));
}

function extractFromFeeds(html, baseUrl) {
  const $ = cheerio.load(html);
  const feedUrls = [];
  
  $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) feedUrls.push(href);
  });
  
  $('a[href*=".ics"], a[href*=".ical"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) feedUrls.push(href);
  });
  
  return { 
    strategy: 'feed', 
    found: 0, 
    feedsDiscovered: feedUrls.length,
    events: [] 
  };
}

function extractFromDom(html, baseUrl) {
  const events = [];
  const $ = cheerio.load(html);
  
  for (const selector of DEFAULT_SELECTORS) {
    const elements = $(selector);
    if (elements.length === 0) continue;
    
    elements.each((_, el) => {
      const $el = $(el);
      const title = $el.find("h1, h2, h3, h4, .title").first().text().trim() ||
                    $el.find("a").first().text().trim();
      if (!title || title.length < 3) return;
      
      const dateText = $el.find("time, .date, [class*='date']").first().text().trim() ||
                       $el.attr("datetime") || "";
      
      events.push({ title, date: dateText, selector });
    });
    
    if (events.length > 0) break;
  }
  
  return { strategy: 'dom', found: events.length, events };
}

function runExtractionWaterfall(html, baseUrl) {
  const trace = {};
  
  // Priority 1: Hydration
  const hydration = extractFromHydration(html);
  trace.hydration = { tried: true, found: hydration.found };
  if (hydration.found > 0) {
    return { winningStrategy: 'hydration', totalEvents: hydration.found, events: hydration.events, trace };
  }
  
  // Priority 2: JSON-LD
  const jsonLd = extractFromJsonLd(html);
  trace.json_ld = { tried: true, found: jsonLd.found };
  if (jsonLd.found > 0) {
    return { winningStrategy: 'json_ld', totalEvents: jsonLd.found, events: jsonLd.events, trace };
  }
  
  // Priority 3: Feed Discovery
  const feed = extractFromFeeds(html, baseUrl);
  trace.feed = { tried: true, found: feed.found, feedsDiscovered: feed.feedsDiscovered };
  
  // Priority 4: DOM
  const dom = extractFromDom(html, baseUrl);
  trace.dom = { tried: true, found: dom.found };
  if (dom.found > 0) {
    return { winningStrategy: 'dom', totalEvents: dom.found, events: dom.events, trace };
  }
  
  return { winningStrategy: null, totalEvents: 0, events: [], trace };
}

// ============================================================================
// MAIN TEST LOGIC
// ============================================================================

const TARGET_EVENTS = 300;
const MAX_SOURCES = 50;
const FETCH_TIMEOUT = 15000;

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { html: null, status: response.status, error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();
    return { html, status: response.status, error: null };
  } catch (error) {
    clearTimeout(timeout);
    return { html: null, status: 0, error: error.message };
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║          LCL LOCAL SCRAPER TEST - WATERFALL DISTRIBUTION ANALYSIS        ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  
  const startTime = Date.now();
  
  // Get enabled sources with static fetcher (we can't use puppeteer/scrapingbee locally)
  console.log("📋 Loading sources from database...\n");
  
  const { data: sources, error: sourcesError } = await supabase
    .from('scraper_sources')
    .select('id, name, url, fetcher_type, tier, preferred_method, total_events_scraped')
    .eq('enabled', true)
    .eq('fetcher_type', 'static')
    .limit(MAX_SOURCES);
  
  if (sourcesError) {
    console.error("❌ Failed to load sources:", sourcesError.message);
    process.exit(1);
  }
  
  console.log(`Found ${sources.length} enabled static sources to test\n`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Results tracking
  const results = {
    totalSources: sources.length,
    successfulFetches: 0,
    failedFetches: 0,
    totalEventsFound: 0,
    byStrategy: {
      hydration: { sources: 0, events: 0 },
      json_ld: { sources: 0, events: 0 },
      feed: { sources: 0, events: 0, feedsDiscovered: 0 },
      dom: { sources: 0, events: 0 },
      none: { sources: 0, events: 0 }
    },
    sourceResults: []
  };
  
  // Process each source
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const progress = Math.round(((i + 1) / sources.length) * 100);
    
    process.stdout.write(`\r[${progress}%] Processing: ${source.name.substring(0, 40).padEnd(40)}...`);
    
    const fetchResult = await fetchHtml(source.url);
    
    if (!fetchResult.html) {
      results.failedFetches++;
      results.byStrategy.none.sources++;
      results.sourceResults.push({
        name: source.name,
        url: source.url,
        status: 'fetch_failed',
        error: fetchResult.error,
        strategy: null,
        eventsFound: 0
      });
      continue;
    }
    
    results.successfulFetches++;
    
    // Run waterfall extraction
    const waterfallResult = runExtractionWaterfall(fetchResult.html, source.url);
    
    const strategy = waterfallResult.winningStrategy || 'none';
    results.byStrategy[strategy].sources++;
    results.byStrategy[strategy].events += waterfallResult.totalEvents;
    results.totalEventsFound += waterfallResult.totalEvents;
    
    if (waterfallResult.trace.feed?.feedsDiscovered) {
      results.byStrategy.feed.feedsDiscovered += waterfallResult.trace.feed.feedsDiscovered;
    }
    
    results.sourceResults.push({
      name: source.name,
      url: source.url,
      status: 'success',
      strategy: waterfallResult.winningStrategy,
      eventsFound: waterfallResult.totalEvents,
      trace: waterfallResult.trace
    });
    
    // Early exit if we hit target
    if (results.totalEventsFound >= TARGET_EVENTS) {
      console.log(`\n\n🎯 Reached target of ${TARGET_EVENTS} events! Stopping early.`);
      break;
    }
  }
  
  console.log("\n\n");
  
  // ========================================
  // REPORT
  // ========================================
  
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
  
  console.log("═══════════════════════════════════════════════════════════════════════════");
  console.log("                           SCRAPER TEST RESULTS                            ");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  console.log(`⏱️  Time elapsed: ${elapsedSeconds} seconds`);
  console.log(`📊 Sources tested: ${results.sourceResults.length}/${sources.length}`);
  console.log(`✅ Successful fetches: ${results.successfulFetches}`);
  console.log(`❌ Failed fetches: ${results.failedFetches}`);
  console.log(`🎯 Total events found: ${results.totalEventsFound}`);
  
  console.log("\n\n📈 WATERFALL STRATEGY DISTRIBUTION");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const totalSuccessful = results.successfulFetches;
  
  console.log("Strategy       | Sources | Events | % Sources | % Events");
  console.log("─────────────────────────────────────────────────────────");
  
  const strategies = ['hydration', 'json_ld', 'dom', 'none'];
  for (const strategy of strategies) {
    const stats = results.byStrategy[strategy];
    const srcPct = totalSuccessful > 0 ? ((stats.sources / totalSuccessful) * 100).toFixed(1) : '0.0';
    const evtPct = results.totalEventsFound > 0 ? ((stats.events / results.totalEventsFound) * 100).toFixed(1) : '0.0';
    
    console.log(`${strategy.padEnd(14)} | ${String(stats.sources).padStart(7)} | ${String(stats.events).padStart(6)} | ${srcPct.padStart(8)}% | ${evtPct.padStart(7)}%`);
  }
  
  // Feed discovery stats
  console.log(`\n📡 Feed Discovery: ${results.byStrategy.feed.feedsDiscovered} RSS/ICS feeds discovered across ${results.byStrategy.feed.sources} sources`);
  
  console.log("\n\n📋 TOP PERFORMING SOURCES (by events found)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const topSources = results.sourceResults
    .filter(r => r.eventsFound > 0)
    .sort((a, b) => b.eventsFound - a.eventsFound)
    .slice(0, 15);
  
  console.log("Source                                   | Strategy   | Events");
  console.log("─────────────────────────────────────────────────────────────────");
  
  for (const source of topSources) {
    const name = source.name.substring(0, 38).padEnd(38);
    const strategy = (source.strategy || 'none').padEnd(10);
    console.log(`${name} | ${strategy} | ${source.eventsFound}`);
  }
  
  console.log("\n\n⚠️  SOURCES WITH 0 EVENTS");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const zeroEventSources = results.sourceResults.filter(r => r.eventsFound === 0 && r.status === 'success');
  console.log(`Found ${zeroEventSources.length} sources that fetched successfully but extracted 0 events:\n`);
  
  // Group by trace patterns
  const tracePatterns = {};
  zeroEventSources.forEach(src => {
    const trace = src.trace || {};
    const pattern = JSON.stringify({
      hydration: trace.hydration?.found || 0,
      json_ld: trace.json_ld?.found || 0,
      feed: trace.feed?.feedsDiscovered || 0,
      dom: trace.dom?.found || 0
    });
    if (!tracePatterns[pattern]) tracePatterns[pattern] = [];
    tracePatterns[pattern].push(src.name);
  });
  
  console.log("Trace Pattern Analysis:");
  for (const [pattern, sources] of Object.entries(tracePatterns)) {
    console.log(`\n  Pattern: ${pattern}`);
    console.log(`  Sources (${sources.length}):`);
    sources.slice(0, 5).forEach(name => console.log(`    - ${name}`));
    if (sources.length > 5) console.log(`    ... and ${sources.length - 5} more`);
  }
  
  console.log("\n\n📊 SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const successRate = totalSuccessful > 0 
    ? ((results.sourceResults.filter(r => r.eventsFound > 0).length / totalSuccessful) * 100).toFixed(1)
    : '0.0';
  
  console.log(`✅ Sources with events: ${results.sourceResults.filter(r => r.eventsFound > 0).length}/${totalSuccessful} (${successRate}%)`);
  console.log(`📊 Total events found: ${results.totalEventsFound}`);
  console.log(`�� Target: ${TARGET_EVENTS} events`);
  console.log(`📈 Status: ${results.totalEventsFound >= TARGET_EVENTS ? '✅ TARGET MET!' : `⚠️ ${TARGET_EVENTS - results.totalEventsFound} more needed`}`);
  
  console.log("\n\n💡 WATERFALL INSIGHTS");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
  
  const hydrationPct = totalSuccessful > 0 ? (results.byStrategy.hydration.sources / totalSuccessful * 100).toFixed(1) : 0;
  const jsonLdPct = totalSuccessful > 0 ? (results.byStrategy.json_ld.sources / totalSuccessful * 100).toFixed(1) : 0;
  const domPct = totalSuccessful > 0 ? (results.byStrategy.dom.sources / totalSuccessful * 100).toFixed(1) : 0;
  const nonePct = totalSuccessful > 0 ? (results.byStrategy.none.sources / totalSuccessful * 100).toFixed(1) : 0;
  
  console.log("The waterfall extraction tries strategies in priority order:");
  console.log(`  1️⃣  HYDRATION (Next.js/__NEXT_DATA__, etc.): ${hydrationPct}% of sources`);
  console.log(`  2️⃣  JSON-LD (Schema.org structured data):     ${jsonLdPct}% of sources`);
  console.log(`  3️⃣  FEED (RSS/Atom/ICS discovery):            Feed discovery found ${results.byStrategy.feed.feedsDiscovered} feeds`);
  console.log(`  4️⃣  DOM (CSS selector-based extraction):      ${domPct}% of sources`);
  console.log(`  ❌  NONE (no events extracted):               ${nonePct}% of sources`);
  
  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("                              TEST COMPLETE                                 ");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");
}

main().catch(error => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
