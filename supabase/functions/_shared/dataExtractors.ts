/**
 * Smart Extraction Engine - Data-First Event Pipeline
 * 
 * Implements the "Waterfall" extraction logic with four priority levels:
 * 
 * Priority 1: Hydration (Codebase/Hydration) - The "Gold Standard"
 *   - Targets: Next.js, Nuxt, React, Wix frameworks
 *   - Logic: Extract from window.__NEXT_DATA__, __INITIAL_STATE__, etc.
 *   - Why: 100% accurate, contains IDs/Coordinates, bypasses visual changes
 * 
 * Priority 2: Structured Semantic Data (JSON-LD) - High Fidelity
 *   - Targets: WordPress, Squarespace venues
 *   - Logic: Parse script[type="application/ld+json"], filter for Event types
 *   - Includes: Soft repair for malformed JSON
 * 
 * Priority 3: Standard Feeds (RSS/Atom/ICS) - Medium Fidelity
 *   - Targets: Local calendars, municipalities, libraries
 *   - Logic: Discover and parse RSS, Atom, ICS feeds
 *   - Includes: Auto-discovery of common feed URLs
 * 
 * Priority 4: Visual/DOM Fallback - Lowest Fidelity
 *   - Targets: Custom HTML sites with no structured data
 *   - Logic: Use existing Cheerio/Puppeteer selectors
 *   - Condition: Only runs if Priorities 1-3 yield 0 events
 * 
 * @module _shared/dataExtractors
 */

import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import type { RawEventCard } from "./types.ts";

// ============================================================================
// TYPES
// ============================================================================

export type ExtractionStrategy = 'hydration' | 'json_ld' | 'feed' | 'dom';

export interface ExtractionResult {
  /** Strategy that was used */
  strategy: ExtractionStrategy;
  /** Whether extraction was attempted */
  tried: boolean;
  /** Number of events found */
  found: number;
  /** Error message if any */
  error: string | null;
  /** Extracted events */
  events: RawEventCard[];
  /** Time taken in ms */
  timeMs: number;
}

export interface WaterfallResult {
  /** The winning strategy that produced events */
  winningStrategy: ExtractionStrategy | null;
  /** Total events found */
  totalEvents: number;
  /** All extracted events */
  events: RawEventCard[];
  /** Trace of all strategies tried */
  strategyTrace: Record<ExtractionStrategy, Omit<ExtractionResult, 'events'>>;
  /** Total time for all extractions */
  totalTimeMs: number;
}

export interface ExtractionContext {
  /** Base URL for resolving relative URLs */
  baseUrl: string;
  /** Source name for debugging */
  sourceName?: string;
  /** Preferred strategy (if set, skip lower priority strategies on success) */
  preferredMethod?: ExtractionStrategy | 'auto';
  /** Whether to attempt feed auto-discovery */
  feedDiscovery?: boolean;
  /** Custom selectors for DOM fallback */
  domSelectors?: string[];
}

// ============================================================================
// PRIORITY 1: HYDRATION EXTRACTION
// ============================================================================

/**
 * Patterns to find hydration data in HTML
 */
const HYDRATION_PATTERNS = [
  { name: '__NEXT_DATA__', regex: /<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i },
  { name: '__NUXT__', regex: /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: '__INITIAL_STATE__', regex: /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: '__PRELOADED_STATE__', regex: /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
  { name: '__APP_DATA__', regex: /window\.__APP_DATA__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i },
];

/**
 * Event types to look for in hydration data
 */
const EVENT_KEYWORDS = ['event', 'agenda', 'concert', 'show', 'performance', 'match', 'game'];

/**
 * Extracts events from hydration/state data embedded in HTML.
 */
export function extractFromHydration(html: string, ctx: ExtractionContext): ExtractionResult {
  const startTime = Date.now();
  const events: RawEventCard[] = [];
  
  try {
    for (const pattern of HYDRATION_PATTERNS) {
      const match = html.match(pattern.regex);
      if (!match || !match[1]) continue;
      
      let data: unknown;
      try {
        // For __NEXT_DATA__, the content is already JSON
        if (pattern.name === '__NEXT_DATA__') {
          data = JSON.parse(match[1]);
        } else {
          // For window.* assignments, we need to be more careful
          data = JSON.parse(match[1]);
        }
      } catch {
        // Try to repair the JSON
        const repaired = softRepairJson(match[1]);
        if (repaired) {
          try {
            data = JSON.parse(repaired);
          } catch {
            continue;
          }
        } else {
          continue;
        }
      }
      
      // Recursively search for event data
      const extractedEvents = findEventsInObject(data, ctx.baseUrl);
      events.push(...extractedEvents);
      
      if (events.length > 0) {
        break; // Found events, stop searching
      }
    }
    
    return {
      strategy: 'hydration',
      tried: true,
      found: events.length,
      error: null,
      events,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      strategy: 'hydration',
      tried: true,
      found: 0,
      error: error instanceof Error ? error.message : String(error),
      events: [],
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * Recursively searches an object for event-like data.
 */
function findEventsInObject(obj: unknown, baseUrl: string, depth = 0): RawEventCard[] {
  if (depth > 10) return []; // Prevent infinite recursion
  if (!obj || typeof obj !== 'object') return [];
  
  const events: RawEventCard[] = [];
  
  // Check if this object looks like an event
  if (isEventLike(obj)) {
    const event = objectToRawEventCard(obj as Record<string, unknown>, baseUrl);
    if (event) events.push(event);
  }
  
  // Check if this is an array of events
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (isEventLike(item)) {
        const event = objectToRawEventCard(item as Record<string, unknown>, baseUrl);
        if (event) events.push(event);
      } else {
        events.push(...findEventsInObject(item, baseUrl, depth + 1));
      }
    }
  } else {
    // Search nested objects
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      
      // Prioritize keys that look like event containers
      if (EVENT_KEYWORDS.some(k => keyLower.includes(k)) || keyLower === 'data' || keyLower === 'items') {
        events.push(...findEventsInObject(value, baseUrl, depth + 1));
      }
    }
    
    // If we found nothing, search all keys
    if (events.length === 0) {
      for (const value of Object.values(obj)) {
        events.push(...findEventsInObject(value, baseUrl, depth + 1));
      }
    }
  }
  
  return events;
}

/**
 * Checks if an object looks like an event (has title + date or similar).
 */
function isEventLike(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  
  // Must have a title-like field
  const hasTitle = 'title' in o || 'name' in o || 'eventName' in o || 'headline' in o;
  
  // Should have a date-like field
  const hasDate = 'date' in o || 'startDate' in o || 'start_date' in o || 
                  'eventDate' in o || 'datetime' in o || 'start' in o;
  
  // Or a venue/location
  const hasLocation = 'venue' in o || 'location' in o || 'place' in o || 'address' in o;
  
  return hasTitle && (hasDate || hasLocation);
}

/**
 * Converts a generic object to a RawEventCard.
 */
function objectToRawEventCard(obj: Record<string, unknown>, baseUrl: string): RawEventCard | null {
  const getString = (keys: string[]): string => {
    for (const key of keys) {
      if (key in obj && typeof obj[key] === 'string') return obj[key] as string;
      // Handle nested objects
      if (key in obj && typeof obj[key] === 'object') {
        const nested = obj[key] as Record<string, unknown>;
        if ('name' in nested) return String(nested.name);
        if ('text' in nested) return String(nested.text);
      }
    }
    return '';
  };
  
  const getUrl = (keys: string[]): string => {
    const value = getString(keys);
    if (!value) return '';
    if (value.startsWith('http')) return value;
    if (value.startsWith('/')) {
      try {
        const base = new URL(baseUrl);
        return `${base.origin}${value}`;
      } catch {
        return value;
      }
    }
    return value;
  };
  
  const title = getString(['title', 'name', 'eventName', 'headline']);
  const date = getString(['date', 'startDate', 'start_date', 'eventDate', 'datetime', 'start']);
  const location = getString(['venue', 'location', 'place', 'address']);
  const description = getString(['description', 'excerpt', 'summary', 'content']);
  const detailUrl = getUrl(['url', 'link', 'href', 'detailUrl', 'eventUrl']);
  const imageUrl = getUrl(['image', 'imageUrl', 'thumbnail', 'picture', 'photo']);
  
  if (!title) return null;
  
  return {
    title,
    date: date || '',
    location: location || '',
    description: description || '',
    detailUrl,
    imageUrl: imageUrl || null,
    rawHtml: JSON.stringify(obj).slice(0, 5000), // Store original for debugging
  };
}

// ============================================================================
// PRIORITY 2: JSON-LD EXTRACTION
// ============================================================================

/**
 * Schema.org Event types we're interested in
 */
const VALID_EVENT_TYPES = [
  'Event', 'SportsEvent', 'MusicEvent', 'Festival', 'TheaterEvent',
  'DanceEvent', 'ComedyEvent', 'ExhibitionEvent', 'SocialEvent',
  'BusinessEvent', 'EducationEvent', 'FoodEvent', 'ScreeningEvent',
];

/**
 * Extracts events from JSON-LD structured data.
 */
export function extractFromJsonLd(html: string, ctx: ExtractionContext): ExtractionResult {
  const startTime = Date.now();
  const events: RawEventCard[] = [];
  
  try {
    const $ = cheerio.load(html);
    const jsonLdScripts = $('script[type="application/ld+json"]');
    
    jsonLdScripts.each((_, script) => {
      const content = $(script).html();
      if (!content) return;
      
      let data: unknown;
      try {
        data = JSON.parse(content);
      } catch {
        // Try soft repair
        const repaired = softRepairJson(content);
        if (repaired) {
          try {
            data = JSON.parse(repaired);
          } catch {
            return; // Skip this script
          }
        } else {
          return;
        }
      }
      
      // Handle both single objects and arrays
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        // Handle @graph structure
        if (item && typeof item === 'object' && '@graph' in item) {
          const graphItems = (item as { '@graph': unknown[] })['@graph'];
          if (Array.isArray(graphItems)) {
            items.push(...graphItems);
          }
          continue;
        }
        
        if (!isValidEventSchema(item)) continue;
        
        const event = schemaToRawEventCard(item as Record<string, unknown>, ctx.baseUrl);
        if (event) events.push(event);
      }
    });
    
    return {
      strategy: 'json_ld',
      tried: true,
      found: events.length,
      error: null,
      events,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      strategy: 'json_ld',
      tried: true,
      found: 0,
      error: error instanceof Error ? error.message : String(error),
      events: [],
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * Checks if an object is a valid Schema.org Event type.
 */
function isValidEventSchema(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const item = obj as Record<string, unknown>;
  
  const type = item['@type'];
  if (!type) return false;
  
  // Handle array types (e.g., ["Event", "MusicEvent"])
  const types = Array.isArray(type) ? type : [type];
  
  return types.some(t => VALID_EVENT_TYPES.includes(String(t)));
}

/**
 * Converts Schema.org Event to RawEventCard.
 */
function schemaToRawEventCard(schema: Record<string, unknown>, baseUrl: string): RawEventCard | null {
  const getStringValue = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      return String(obj['@value'] || obj['name'] || obj['text'] || '');
    }
    return '';
  };
  
  const title = getStringValue(schema['name']) || getStringValue(schema['headline']);
  if (!title) return null;
  
  // Extract date from startDate
  let date = '';
  if (schema['startDate']) {
    date = getStringValue(schema['startDate']);
  } else if (schema['eventSchedule']) {
    // Handle eventSchedule structure
    const schedule = schema['eventSchedule'];
    if (typeof schedule === 'object' && schedule !== null) {
      date = getStringValue((schedule as Record<string, unknown>)['startDate']);
    }
  }
  
  // Extract location
  let location = '';
  if (schema['location']) {
    const loc = schema['location'];
    if (typeof loc === 'string') {
      location = loc;
    } else if (typeof loc === 'object' && loc !== null) {
      const locObj = loc as Record<string, unknown>;
      location = getStringValue(locObj['name']) || 
                 getStringValue(locObj['address']) ||
                 '';
      // Handle PostalAddress
      if (locObj['address'] && typeof locObj['address'] === 'object') {
        const addr = locObj['address'] as Record<string, unknown>;
        const parts = [
          getStringValue(addr['streetAddress']),
          getStringValue(addr['addressLocality']),
          getStringValue(addr['addressRegion']),
        ].filter(Boolean);
        if (parts.length > 0) {
          location = location ? `${location}, ${parts.join(', ')}` : parts.join(', ');
        }
      }
    }
  }
  
  // Extract image
  let imageUrl: string | null = null;
  if (schema['image']) {
    const img = schema['image'];
    if (typeof img === 'string') {
      imageUrl = img;
    } else if (Array.isArray(img) && img.length > 0) {
      imageUrl = typeof img[0] === 'string' ? img[0] : getStringValue(img[0]);
    } else if (typeof img === 'object' && img !== null) {
      imageUrl = getStringValue((img as Record<string, unknown>)['url']);
    }
  }
  
  // Extract URL
  const detailUrl = getStringValue(schema['url']) || '';
  
  return {
    title,
    date,
    location,
    description: getStringValue(schema['description']) || '',
    detailUrl: resolveUrl(detailUrl, baseUrl),
    imageUrl: imageUrl ? resolveUrl(imageUrl, baseUrl) : null,
    rawHtml: JSON.stringify(schema).slice(0, 5000),
    categoryHint: inferCategoryFromSchema(schema),
  };
}

/**
 * Infers event category from Schema.org type.
 */
function inferCategoryFromSchema(schema: Record<string, unknown>): string | undefined {
  const type = schema['@type'];
  const types = Array.isArray(type) ? type : [type];
  
  for (const t of types) {
    switch (String(t)) {
      case 'MusicEvent': return 'music';
      case 'SportsEvent': return 'active';
      case 'TheaterEvent': return 'entertainment';
      case 'DanceEvent': return 'entertainment';
      case 'ComedyEvent': return 'entertainment';
      case 'FoodEvent': return 'foodie';
      case 'Festival': return 'community';
      case 'ExhibitionEvent': return 'entertainment';
      case 'SocialEvent': return 'social';
      case 'EducationEvent': return 'workshops';
      case 'ScreeningEvent': return 'entertainment';
    }
  }
  
  return undefined;
}

// ============================================================================
// PRIORITY 3: FEED EXTRACTION (RSS/Atom/ICS)
// ============================================================================

/**
 * Common feed paths to try for auto-discovery
 */
const FEED_PATHS = [
  '/feed',
  '/rss',
  '/rss.xml',
  '/atom.xml',
  '/events/feed',
  '/agenda/feed',
  '/calendar.ics',
  '/events.ics',
  '/agenda.ics',
  '/feed/events',
];

export interface FeedExtractionContext extends ExtractionContext {
  /** Function to fetch external URLs */
  fetcher?: { fetch: (url: string) => Promise<{ html: string, status: number }> };
}

/**
 * Extracts events from RSS/Atom/ICS feeds discovered in HTML or via auto-discovery.
 */
export async function extractFromFeeds(html: string, ctx: FeedExtractionContext): Promise<ExtractionResult> {
  const startTime = Date.now();
  const events: RawEventCard[] = [];
  
  try {
    const $ = cheerio.load(html);
    let feedUrls: string[] = [];
    
    // Find RSS/Atom links in head
    $('link[type="application/rss+xml"], link[type="application/atom+xml"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) feedUrls.push(resolveUrl(href, ctx.baseUrl));
    });
    
    // Find ICS/webcal links in the page
    $('a[href*=".ics"], a[href*=".ical"], a[href^="webcal://"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) feedUrls.push(resolveUrl(href.replace('webcal://', 'https://'), ctx.baseUrl));
    });
    
    // If no feeds found and discovery is enabled, try common paths
    if (feedUrls.length === 0 && (ctx.feedDiscovery || ctx.preferredMethod === 'feed')) {
      try {
        const base = new URL(ctx.baseUrl);
        for (const path of FEED_PATHS) {
          feedUrls.push(`${base.origin}${path}`);
        }
      } catch {
        // Invalid baseUrl, skip discovery
      }
    }

    // Deduplicate URLs
    feedUrls = [...new Set(feedUrls)];
    
    // ACTIVE FETCHING: Pick the best looking feed and fetch it
    // We limit to 3 attempts to save time
    let fetchCount = 0;
    for (const url of feedUrls.slice(0, 3)) {
      if (!ctx.fetcher) break; // Cannot fetch without fetcher
      
      try {
        const { html: content, status } = await ctx.fetcher.fetch(url);
        if (status !== 200 || !content) continue;
        fetchCount++;

        let parsedEvents: RawEventCard[] = [];
        
        if (content.includes('<rss') || content.includes('<feed')) {
           parsedEvents = parseRssFeed(content, url);
        } else if (content.includes('BEGIN:VEVENT')) {
           parsedEvents = parseIcsFeed(content, url);
        }

        if (parsedEvents.length > 0) {
            events.push(...parsedEvents);
            break; // Stop after finding a working feed
        }
      } catch (err) {
        console.warn(`Failed to fetch feed ${url}:`, err);
      }
    }
    
    return {
      strategy: 'feed',
      tried: true,
      found: events.length,
      error: events.length === 0 && feedUrls.length > 0
        ? `Discovered ${feedUrls.length} feeds, fetched ${fetchCount}, found 0 events.`
        : null,
      events,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      strategy: 'feed',
      tried: true,
      found: 0,
      error: error instanceof Error ? error.message : String(error),
      events: [],
      timeMs: Date.now() - startTime,
    };
  }
}

/**
 * Parses RSS/Atom feed content into RawEventCards.
 */
export function parseRssFeed(feedContent: string, baseUrl: string): RawEventCard[] {
  const events: RawEventCard[] = [];
  const $ = cheerio.load(feedContent, { xml: true });
  
  // Try RSS format
  $('item').each((_, item) => {
    const $item = $(item);
    const title = $item.find('title').text().trim();
    if (!title) return;
    
    events.push({
      title,
      date: $item.find('pubDate').text().trim() || '',
      location: '',
      description: $item.find('description').text().trim() || $item.find('content\\:encoded').text().trim() || '',
      detailUrl: $item.find('link').text().trim() || $item.find('guid').text().trim() || '',
      imageUrl: $item.find('enclosure[type^="image"]').attr('url') || null,
      rawHtml: $.html(item),
    });
  });
  
  // Try Atom format
  if (events.length === 0) {
    $('entry').each((_, entry) => {
      const $entry = $(entry);
      const title = $entry.find('title').text().trim();
      if (!title) return;
      
      events.push({
        title,
        date: $entry.find('updated, published').first().text().trim() || '',
        location: '',
        description: $entry.find('summary, content').first().text().trim() || '',
        detailUrl: $entry.find('link[rel="alternate"]').attr('href') || $entry.find('link').attr('href') || '',
        imageUrl: null,
        rawHtml: $.html(entry),
      });
    });
  }
  
  return events;
}

/**
 * Parses ICS/iCalendar content into RawEventCards.
 */
export function parseIcsFeed(icsContent: string, _baseUrl: string): RawEventCard[] {
  const events: RawEventCard[] = [];
  
  // Simple ICS parsing - extract VEVENT blocks
  const eventBlocks = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi) || [];
  
  for (const block of eventBlocks) {
    const getValue = (field: string): string => {
      const regex = new RegExp(`^${field}[^:]*:(.*)$`, 'mi');
      const match = block.match(regex);
      return match ? match[1].replace(/\\[nN]/g, '\n').replace(/\\,/g, ',').trim() : '';
    };
    
    const title = getValue('SUMMARY');
    if (!title) continue;
    
    // Parse DTSTART (can be date or datetime)
    let date = getValue('DTSTART');
    // Handle DTSTART with TZID: DTSTART;TZID=Europe/Amsterdam:20260115T200000
    const dtstartMatch = block.match(/DTSTART[^:]*:(\d{8}T?\d{0,6}Z?)/i);
    if (dtstartMatch) {
      date = dtstartMatch[1];
    }
    
    events.push({
      title,
      date,
      location: getValue('LOCATION'),
      description: getValue('DESCRIPTION'),
      detailUrl: getValue('URL'),
      imageUrl: null,
      rawHtml: block,
    });
  }
  
  return events;
}

// ============================================================================
// PRIORITY 4: DOM FALLBACK
// ============================================================================

/**
 * Default selectors for DOM-based extraction
 */
const DEFAULT_SELECTORS = [
  "article.event",
  ".event-item",
  ".event-card",
  "[itemtype*='Event']",
  ".agenda-item",
  ".calendar-event",
  "[class*='event']",
  "[class*='agenda']",
  "li.event",
  ".post-item",
  ".datum-item",
  ".activity-card",
  ".card--event",
  ".event-list-item",
];

/**
 * Extracts events using DOM selectors (lowest fidelity fallback).
 */
export function extractFromDom(html: string, ctx: ExtractionContext): ExtractionResult {
  const startTime = Date.now();
  const events: RawEventCard[] = [];
  const selectors = ctx.domSelectors || DEFAULT_SELECTORS;
  
  try {
    const $ = cheerio.load(html);
    
    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;
      
      elements.each((_, el) => {
        const $el = $(el);
        const rawHtml = $.html(el);
        
        // Extract title
        const title = $el.find("h1, h2, h3, h4, .title, [class*='title']").first().text().trim() ||
          $el.find("a").first().text().trim();
        
        if (!title || title.length < 3) return;
        
        // Extract date
        let dateText = $el.find("time, .date, [class*='date'], [class*='datum'], [class*='tijd'], [datetime]").first().text().trim() ||
          $el.attr("datetime") || "";
        
        // Fallback: look for date pattern in text (supports English, Dutch, German month names)
        if (!dateText) {
          const allText = $el.text().trim();
          // Multi-locale date patterns:
          // - English: jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec
          // - Dutch: jan, feb, mrt, apr, mei, jun, jul, aug, sep, okt, nov, dec
          // - German: jan, feb, mär, apr, mai, jun, jul, aug, sep, okt, nov, dez
          const datePattern = /(?:\d{1,2}\s+(?:jan|feb|mar|mrt|apr|may|mei|mai|mär|jun|jul|aug|sep|oct|okt|nov|dec|dez)[a-z]*|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i;
          const match = allText.match(datePattern);
          if (match) dateText = match[0];
        }
        
        // Extract location
        const location = $el.find(".location, .venue, [class*='location'], [class*='venue']").first().text().trim();
        
        // Extract description
        const description = $el.find("p, .description, .excerpt, [class*='description']").first().text().trim();
        
        // Extract detail URL
        const detailUrl = $el.find("a").first().attr("href") || $el.attr("href") || "";
        const fullDetailUrl = resolveUrl(detailUrl, ctx.baseUrl);
        
        // Extract image
        const imageUrl = $el.find("img").first().attr("src") ||
          $el.find("[style*='background']").first().attr("style")?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] ||
          null;
        
        events.push({
          title,
          date: dateText,
          location,
          description,
          detailUrl: fullDetailUrl,
          imageUrl: imageUrl ? resolveUrl(imageUrl, ctx.baseUrl) : null,
          rawHtml,
        });
      });
      
      if (events.length > 0) break; // Found events with this selector
    }
    
    return {
      strategy: 'dom',
      tried: true,
      found: events.length,
      error: null,
      events,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      strategy: 'dom',
      tried: true,
      found: 0,
      error: error instanceof Error ? error.message : String(error),
      events: [],
      timeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// WATERFALL ORCHESTRATOR
// ============================================================================

/**
 * Runs the extraction waterfall: tries each strategy in priority order
 * and stops when events are found.
 */
export async function runExtractionWaterfall(html: string, ctx: FeedExtractionContext): Promise<WaterfallResult> {
  const startTime = Date.now();
  const trace: Record<ExtractionStrategy, Omit<ExtractionResult, 'events'>> = {} as Record<ExtractionStrategy, Omit<ExtractionResult, 'events'>>;
  
  // Define strategy order based on preferred method
  const strategies: ExtractionStrategy[] = 
    ctx.preferredMethod && ctx.preferredMethod !== 'auto'
      ? [ctx.preferredMethod, ...(['hydration', 'json_ld', 'feed', 'dom'] as ExtractionStrategy[]).filter(s => s !== ctx.preferredMethod)]
      : ['hydration', 'json_ld', 'feed', 'dom'];
  
  let winningStrategy: ExtractionStrategy | null = null;
  let allEvents: RawEventCard[] = [];
  
  for (const strategy of strategies) {
    let result: ExtractionResult;
    
    switch (strategy) {
      case 'hydration':
        result = extractFromHydration(html, ctx);
        break;
      case 'json_ld':
        result = extractFromJsonLd(html, ctx);
        break;
      case 'feed':
        result = await extractFromFeeds(html, ctx);
        break;
      case 'dom':
        result = extractFromDom(html, ctx);
        break;
      default:
        // Should not happen, but safe fallback
        continue;
    }
    
    // Store trace without events (to save memory)
    trace[strategy] = {
      strategy: result.strategy,
      tried: result.tried,
      found: result.found,
      error: result.error,
      timeMs: result.timeMs,
    };
    
    // If events found, this is the winner
    if (result.found > 0) {
      winningStrategy = strategy;
      allEvents = result.events;
      break; // Stop waterfall
    }
  }
  
  return {
    winningStrategy,
    totalEvents: allEvents.length,
    events: allEvents,
    strategyTrace: trace,
    totalTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Resolves a potentially relative URL against a base URL.
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  
  try {
    const base = new URL(baseUrl);
    if (url.startsWith('//')) {
      return `${base.protocol}${url}`;
    }
    if (url.startsWith('/')) {
      return `${base.origin}${url}`;
    }
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

/**
 * Attempts to repair common JSON syntax errors.
 * Useful for malformed JSON-LD from amateur sites.
 */
function softRepairJson(json: string): string | null {
  try {
    // Already valid
    JSON.parse(json);
    return json;
  } catch {
    // Try repairs
    let repaired = json;
    
    // Fix trailing commas
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');
    
    // Fix single quotes to double quotes (risky but common)
    repaired = repaired.replace(/'/g, '"');
    
    // Fix unquoted keys
    repaired = repaired.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    
    // Remove control characters
    repaired = repaired.replace(/[\x00-\x1F\x7F]/g, '');
    
    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return null;
    }
  }
}
