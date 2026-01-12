import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scraper-key",
};

// Valid categories for the events table
const VALID_CATEGORIES = ["cinema", "crafts", "sports", "gaming", "market"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

// Default event type for scraped events
const DEFAULT_EVENT_TYPE = "anchor";

// Interface for scraper source from database
interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  config: {
    selectors?: string[];
    headers?: Record<string, string>;
    rate_limit_ms?: number;
    /** Default coordinates for events from this source (fallback when venue can't be geocoded) */
    default_coordinates?: { lat: number; lng: number };
    /** Language for AI parsing (e.g., 'nl', 'de', 'en') */
    language?: string;
    /** Country code for this source (e.g., 'NL', 'AT', 'DE') */
    country?: string;
    /** Enable dynamic year replacement in URLs */
    dynamic_year?: boolean;
  };
}

/**
 * Platform detection patterns.
 * Many municipalities use common CMS platforms - detecting these allows for optimized scraping.
 */
interface PlatformConfig {
  name: string;
  /** URL patterns that identify this platform */
  urlPatterns: RegExp[];
  /** Optimized CSS selectors for this platform */
  selectors: string[];
  /** Specific date/time extraction logic */
  dateSelector?: string;
  timeSelector?: string;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  // "Ontdek" platform - used by many Dutch municipalities
  ontdek: {
    name: "Ontdek Platform",
    urlPatterns: [/ontdek[\w]+\.nl/i, /beleef[\w]+\.nl/i, /bezoek[\w]+\.nl/i],
    selectors: [
      ".agenda-item",
      ".event-card",
      "article.agenda-item",
      '[class*="agenda-item"]',
      ".card--event",
    ],
    dateSelector: ".event-date, .date, time",
    timeSelector: ".event-time, .time",
  },
  // "Visit" platform - tourism boards
  visit: {
    name: "Visit/VVV Platform",
    urlPatterns: [/visit[\w]+\.(nl|com)/i, /vvv[\w]+\.nl/i, /touristinfo[\w]+\.nl/i],
    selectors: [
      "article.event",
      ".event-item",
      ".agenda-event",
      '[class*="event-card"]',
      ".card.event",
    ],
  },
  // "Uit" platform - cultural agendas
  uit: {
    name: "Uit Agenda Platform",
    urlPatterns: [/uit\.[\w]+\.nl/i, /uitin[\w]+\.nl/i, /uiteratuur[\w]+\.nl/i],
    selectors: [
      ".event",
      ".agenda-item",
      "article",
      '[class*="event"]',
    ],
  },
  // Generic Dutch municipality sites
  gemeente: {
    name: "Municipality Website",
    urlPatterns: [/\.nl\/agenda/i, /\.nl\/evenementen/i],
    selectors: [
      "article.event-card",
      ".agenda-item",
      ".event-item",
      '[class*="agenda"]',
    ],
  },
};

/**
 * Detect which platform a URL belongs to and return optimized config.
 */
function detectPlatform(url: string): PlatformConfig | null {
  for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
    for (const pattern of config.urlPatterns) {
      if (pattern.test(url)) {
        console.log(`🔍 Detected platform: ${config.name} (${key})`);
        return config;
      }
    }
  }
  return null;
}

/**
 * Get optimized selectors for a source, using platform detection if no custom selectors provided.
 */
function getOptimizedSelectors(source: ScraperSource): string[] {
  // Use custom selectors if provided
  if (source.config.selectors && source.config.selectors.length > 0) {
    return source.config.selectors;
  }
  
  // Try to detect platform and use its optimized selectors
  const platform = detectPlatform(source.url);
  if (platform) {
    return platform.selectors;
  }
  
  // Fall back to default selectors
  return DEFAULT_SELECTORS;
}

// Default selectors for event scraping (fallback)
const DEFAULT_SELECTORS = [
  "article.event-card",
  "article.agenda-item",
  "div.event-card",
  "div.agenda-item",
  ".event-item",
  ".card.event",
  "article",
  ".agenda-event",
  '[class*="event"]',
  '[class*="agenda"]',
];

// Default headers for scraping (language-neutral)
const DEFAULT_HEADERS = {
  "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

// Interfaces
interface RawEventCard {
  rawHtml: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string | null;
  description: string;
  detailUrl: string | null;
  detailPageTime?: string; // Time extracted from detail page
}

interface ParsedEvent {
  title: string;
  description: string;
  category: Category;
  venue_name: string;
  venue_address?: string;
  event_date: string;
  event_time: string;
  image_url: string | null;
  coordinates?: { lat: number; lng: number };
}

interface EventInsert {
  title: string;
  description: string;
  category: Category;
  event_type: string;
  venue_name: string;
  location: string;
  event_date: string;
  event_time: string;
  image_url: string | null;
  created_by: string | null;
  status: string;
  [key: string]: unknown;
}

/**
 * Replaces year patterns in URLs with the current year.
 * Handles formats like:
 * - evenementenkalender-2026 -> evenementenkalender-2027 (when current year is 2027)
 * - agenda/2026 -> agenda/2027
 */
function applyDynamicYear(url: string, useDynamicYear: boolean): string {
  if (!useDynamicYear) return url;
  
  const currentYear = new Date().getFullYear();
  
  // Pattern 1: Year in path like "kalender-2026" or "calendar-2026"
  const dashYearPattern = /-(\d{4})(?=[^\d]|$)/g;
  
  // Pattern 2: Year as path segment like "/2026/" or "/2026"
  const segmentYearPattern = /\/(\d{4})(?=\/|$)/g;
  
  let updatedUrl = url.replace(dashYearPattern, (match, year) => {
    const yearNum = parseInt(year);
    // Only replace years 2020-2030 to avoid false positives
    if (yearNum >= 2020 && yearNum <= 2030) {
      console.log(`🔄 Dynamic year: replacing ${yearNum} with ${currentYear}`);
      return `-${currentYear}`;
    }
    return match;
  });
  
  updatedUrl = updatedUrl.replace(segmentYearPattern, (match, year) => {
    const yearNum = parseInt(year);
    if (yearNum >= 2020 && yearNum <= 2030) {
      console.log(`🔄 Dynamic year: replacing ${yearNum} with ${currentYear}`);
      return `/${currentYear}`;
    }
    return match;
  });
  
  return updatedUrl;
}

// Utility functions
function parseToISODate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== "string") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (year >= 2020 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return dateStr;
    }
    return null;
  }

  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const europeanMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (europeanMatch) {
    const [, day, month, year] = europeanMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function getTodayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get language-specific instructions for AI parsing
 */
function getLanguageInstructions(language: string): string {
  const instructions: Record<string, string> = {
    nl: "Keep all text in Dutch. Do not translate to English.",
    de: "Keep all text in German. Do not translate to English.",
    en: "Keep all text in English.",
    fr: "Keep all text in French. Do not translate to English.",
    es: "Keep all text in Spanish. Do not translate to English.",
    it: "Keep all text in Italian. Do not translate to English.",
  };
  return instructions[language] || instructions.en;
}

/**
 * Get AI system prompt for parsing events.
 * Language-aware for global use.
 */
function getAISystemPrompt(language: string = 'en', defaultCoords?: { lat: number; lng: number }): string {
  const today = getTodayISO();
  const langInstructions = getLanguageInstructions(language);
  
  const coordsHint = defaultCoords 
    ? `If venue location is unknown, use these fallback coordinates: ${defaultCoords.lat}, ${defaultCoords.lng}`
    : "If venue location is unknown, omit the coordinates field.";
  
  return `You are a data cleaner for a global social event app.
Your task is to extract event information from raw HTML text.

IMPORTANT: ${langInstructions}

Extract the following fields:
- title: The event name (clean, without extra formatting)
- description: A nice, readable description (max 200 chars). If vague, create a brief summary.
- category: Map to one of these EXACT values: cinema, crafts, sports, gaming, market
  - cinema: movies, films, theater, performances, shows, concerts, music
  - crafts: workshops, art, creative activities, exhibitions
  - sports: sports events, fitness, outdoor activities, walking, cycling
  - gaming: gaming events, esports, board games
  - market: markets, fairs, festivals, food events, community events
- venue_name: The venue/location name
- venue_address: Full street address if mentioned
- event_date: Date in YYYY-MM-DD format. If only relative (e.g., "tomorrow"), calculate from today.
- event_time: IMPORTANT - Extract the START TIME in HH:MM 24-hour format (e.g., "19:30", "14:00", "21:00").
  Look for time patterns like "19.30", "8:00 PM", "starts at 20:00", etc.
  If time shows a range like "19:00 - 22:00", use the START time (19:00).
  ONLY use fallback values if absolutely no time is found:
  - "Hele dag" or "All day" for all-day events explicitly marked as such
  - "TBD" only as absolute last resort
- image_url: Full image URL if found, or null
- coordinates: If you can determine the exact location, provide { "lat": number, "lng": number }.
  ${coordsHint}

Today's date is: ${today}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.
Keep all text in the original language.
If you cannot extract meaningful data, return null for that field.`;
}

/**
 * Determines if a given date is in Daylight Saving Time (DST) in Central Europe.
 * DST: Last Sunday of March (02:00 CET -> 03:00 CEST) to Last Sunday of October (03:00 CEST -> 02:00 CET)
 */
function isCentralEuropeDST(year: number, month: number, day: number): boolean {
  if (month < 3 || month > 10) return false;
  if (month > 3 && month < 10) return true;
  
  const lastSunday = getLastSundayOfMonth(year, month);
  
  if (month === 3) {
    return day >= lastSunday;
  } else {
    return day < lastSunday;
  }
}

function getLastSundayOfMonth(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayOfWeek = new Date(year, month - 1, lastDay).getDay();
  const daysToSubtract = lastDayOfWeek === 0 ? 0 : lastDayOfWeek;
  return lastDay - daysToSubtract;
}

/**
 * Construct event datetime in UTC.
 * Assumes Central European timezone for now (can be extended with timezone config per source).
 */
function constructEventDateTime(eventDate: string, eventTime: string): string {
  const timeMatch = eventTime.match(/^(\d{2}):(\d{2})$/);
  const hours = timeMatch ? timeMatch[1] : "12";
  const minutes = timeMatch ? timeMatch[2] : "00";
  
  const [year, month, day] = eventDate.split("-").map(Number);
  const isDST = isCentralEuropeDST(year, month, day);
  const utcOffset = isDST ? 2 : 1;
  
  const localHours = parseInt(hours, 10);
  const localMinutes = parseInt(minutes, 10);
  const utcHours = localHours - utcOffset;
  
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHours, localMinutes, 0));
  return utcDate.toISOString();
}

/**
 * Fetch event detail page and extract time from it
 */
async function fetchEventDetailTime(detailUrl: string, baseUrl: string): Promise<string | null> {
  try {
    let fullUrl = detailUrl;
    if (detailUrl.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      fullUrl = `${urlObj.protocol}//${urlObj.host}${detailUrl}`;
    } else if (!detailUrl.startsWith('http')) {
      fullUrl = `${baseUrl.replace(/\/$/, '')}/${detailUrl}`;
    }

    console.log(`      🔍 Fetching detail page: ${fullUrl}`);
    
    const response = await fetch(fullUrl, { 
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.log(`      ⚠️ Detail page fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const pageText = $('body').text();
    
    // Multi-language time patterns
    const timePatterns = [
      // Dutch patterns
      /aanvang[:\s]*(\d{1,2})[.:h](\d{2})/i,
      /vanaf\s+(\d{1,2})[.:h](\d{2})/i,
      /(\d{1,2})[.:h](\d{2})\s*uur/i,
      // German patterns
      /beginn[:\s]*(\d{1,2})[.:h](\d{2})/i,
      /ab\s+(\d{1,2})[.:h](\d{2})/i,
      /(\d{1,2})[.:h](\d{2})\s*uhr/i,
      // English patterns
      /starts?\s*(?:at\s*)?(\d{1,2})[.:h](\d{2})/i,
      /from\s+(\d{1,2})[.:h](\d{2})/i,
      /doors?\s*(?:open\s*)?(?:at\s*)?(\d{1,2})[.:h](\d{2})/i,
      // Generic patterns
      /start[:\s]*(?:om\s*)?(\d{1,2})[.:h](\d{2})/i,
      /time[:\s]*(\d{1,2})[.:h](\d{2})/i,
      /om\s+(\d{1,2})[.:h](\d{2})/i,
      /(\d{1,2})[.:](\d{2})\s*[-–—]\s*\d{1,2}[.:]\d{2}/,
    ];
    
    const timeElements = [
      '.event-time', '.time', '[class*="time"]', '[class*="tijd"]',
      '.event-details', '.details', 'meta[property="event:start_time"]',
      '.aanvang', '[class*="aanvang"]', '.beginn', '[class*="beginn"]',
    ];
    
    for (const selector of timeElements) {
      const el = $(selector);
      if (el.length > 0) {
        const elText = el.text() || el.attr('content') || '';
        for (const pattern of timePatterns) {
          const match = elText.match(pattern);
          if (match) {
            const hours = match[1].padStart(2, '0');
            const minutes = match[2];
            const time = `${hours}:${minutes}`;
            console.log(`      ✅ Found time in element: ${time}`);
            return time;
          }
        }
      }
    }
    
    for (const pattern of timePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const hours = match[1].padStart(2, '0');
        const minutes = match[2];
        if (parseInt(hours) <= 23) {
          const time = `${hours}:${minutes}`;
          console.log(`      ✅ Found time in page text: ${time}`);
          return time;
        }
      }
    }
    
    console.log(`      ⚠️ No time found on detail page`);
    return null;
  } catch (error) {
    console.log(`      ⚠️ Error fetching detail page: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

// Scraping function
async function scrapeEventCards(source: ScraperSource, enableDeepScraping: boolean = true): Promise<RawEventCard[]> {
  // Apply dynamic year replacement if configured
  const actualUrl = applyDynamicYear(source.url, source.config.dynamic_year === true);
  
  // Detect platform for optimization
  const platform = detectPlatform(actualUrl);
  if (platform) {
    console.log(`🔧 Using optimized config for: ${platform.name}`);
  }
  
  console.log(`🌐 Fetching agenda from ${source.name} (${actualUrl})...`);

  const headers = source.config.headers || DEFAULT_HEADERS;
  const response = await fetch(actualUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const events: RawEventCard[] = [];

  // Use optimized selectors based on platform detection
  const selectors = getOptimizedSelectors(source);

  // deno-lint-ignore no-explicit-any
  let foundElements: any = $([]);

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`Found ${elements.length} elements with selector: ${selector}`);
      foundElements = elements;
      break;
    }
  }

  if (foundElements.length === 0) {
    console.log("⚠️ No event elements found with common selectors. Trying generic approach...");
    foundElements = $("article, .card, [class*=\"item\"]").filter((_: number, el: cheerio.Element) => {
      const text = $(el).text();
      return text.length > 50 && text.length < 5000;
    });
  }

  console.log(`Processing ${foundElements.length} potential event cards...`);

  // deno-lint-ignore no-explicit-any
  foundElements.each((_: number, element: any) => {
    const $el = $(element);
    const rawHtml = $el.html() || "";

    const title =
      $el.find("h1, h2, h3, h4, .title, [class*=\"title\"]").first().text().trim() ||
      $el.find("a").first().text().trim();

    const date =
      $el.find("time, .date, [class*=\"date\"], .event-date").first().text().trim() ||
      $el.find("[datetime]").first().attr("datetime") ||
      "";

    const location =
      $el.find(".location, .venue, [class*=\"location\"], [class*=\"venue\"]").first().text().trim() ||
      $el.find("address").first().text().trim();

    const imageUrl =
      $el.find("img").first().attr("src") ||
      $el
        .find('[style*="background-image"]')
        .first()
        .attr("style")
        ?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] ||
      null;

    const description = $el.find(".description, .excerpt, .summary, p").first().text().trim();
    const detailUrl = $el.find("a").first().attr("href") || null;

    if (title || rawHtml.length > 100) {
      events.push({
        rawHtml: rawHtml.substring(0, 3000),
        title,
        date,
        location,
        imageUrl,
        description,
        detailUrl,
      });
    }
  });

  console.log(`✅ Extracted ${events.length} event cards`);

  // Deep scraping: fetch detail pages to extract times
  if (enableDeepScraping && events.length > 0) {
    console.log(`\n⏱️ Deep scraping: fetching ${events.length} detail pages for times...`);
    const delayMs = source.config.rate_limit_ms || 300;
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.detailUrl) {
        console.log(`   [${i + 1}/${events.length}] ${event.title || 'Unknown'}...`);
        const time = await fetchEventDetailTime(event.detailUrl, actualUrl);
        if (time) {
          event.detailPageTime = time;
        }
        if (i < events.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    const timesFound = events.filter(e => e.detailPageTime).length;
    console.log(`⏱️ Deep scraping complete: found times for ${timesFound}/${events.length} events`);
  }

  return events;
}

// AI Parsing function using Google Gemini
async function parseEventWithAI(
  apiKey: string, 
  rawEvent: RawEventCard, 
  language: string = 'en',
  defaultCoords?: { lat: number; lng: number }
): Promise<ParsedEvent | null> {
  try {
    const timeHint = rawEvent.detailPageTime 
      ? `Time (from detail page): ${rawEvent.detailPageTime}` 
      : "Time hint: not found on detail page";

    const userPrompt = `Parse this event data and return ONLY valid JSON:

Title hint: ${rawEvent.title || "unknown"}
Date hint: ${rawEvent.date || "unknown"}
Location hint: ${rawEvent.location || "unknown"}
${timeHint}
Image URL: ${rawEvent.imageUrl || "none"}

Raw HTML content:
${rawEvent.rawHtml}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: getAISystemPrompt(language, defaultCoords) }] },
            { role: "model", parts: [{ text: "I understand. I will parse event data and return clean JSON." }] },
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error("No text in Gemini response");
      return null;
    }

    // Clean and parse JSON
    let jsonStr = text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith("```")) {
      jsonStr = jsonStr.slice(0, -3);
    }
    jsonStr = jsonStr.trim();

    const parsed = JSON.parse(jsonStr) as ParsedEvent;

    // Validate and normalize
    if (!parsed.title || !parsed.category) {
      console.log("❌ Missing required fields (title or category)");
      return null;
    }

    if (!VALID_CATEGORIES.includes(parsed.category as Category)) {
      console.log(`⚠️ Invalid category "${parsed.category}", defaulting to "market"`);
      parsed.category = "market";
    }

    // Prioritize time from deep scraping if available
    if (rawEvent.detailPageTime) {
      parsed.event_time = rawEvent.detailPageTime;
    }

    // Validate date
    const isoDate = parseToISODate(parsed.event_date);
    if (!isoDate) {
      console.log(`⚠️ Invalid date format: ${parsed.event_date}`);
      return null;
    }
    parsed.event_date = isoDate;

    // Use default coordinates if none provided
    if (!parsed.coordinates && defaultCoords) {
      parsed.coordinates = defaultCoords;
    }

    return parsed;
  } catch (error) {
    console.error("AI parsing error:", error instanceof Error ? error.message : error);
    return null;
  }
}

// Check for duplicate events
// deno-lint-ignore no-explicit-any
async function eventExists(
  supabase: any,
  title: string,
  eventDate: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("title", title)
    .eq("event_date", eventDate)
    .limit(1);

  if (error) {
    console.error("Error checking for duplicate:", error);
    return false;
  }

  return data && data.length > 0;
}

// Insert event into database
// deno-lint-ignore no-explicit-any
async function insertEvent(
  supabase: any,
  event: EventInsert
): Promise<boolean> {
  const { error } = await supabase.from("events").insert(event);

  if (error) {
    console.error(`Failed to insert "${event.title}":`, error.message);
    return false;
  }

  return true;
}

// Update scraper source stats
// deno-lint-ignore no-explicit-any
async function updateSourceStats(
  supabase: any,
  sourceId: string,
  eventsScraped: number,
  success: boolean
): Promise<void> {
  try {
    await supabase.rpc("update_scraper_source_stats", {
      p_source_id: sourceId,
      p_events_scraped: eventsScraped,
      p_success: success,
    });
  } catch (error) {
    console.warn("Failed to update source stats:", error);
  }
}

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API keys - support both GEMINI_API_KEY and GOOGLE_AI_API_KEY
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY or GOOGLE_AI_API_KEY environment variable");
    }
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body for options
    let options: { 
      sourceId?: string; 
      dryRun?: boolean; 
      enableDeepScraping?: boolean;
      limit?: number;
    } = {};
    
    try {
      if (req.method === "POST") {
        const body = await req.text();
        if (body) {
          options = JSON.parse(body);
        }
      }
    } catch {
      // Ignore parsing errors, use defaults
    }

    const { sourceId, dryRun = false, enableDeepScraping = true, limit } = options;

    // Get enabled scraper sources
    let query = supabase.from("scraper_sources").select("*").eq("enabled", true);
    
    if (sourceId) {
      query = query.eq("id", sourceId);
    }
    
    if (limit) {
      query = query.limit(limit);
    }

    const { data: sources, error: sourcesError } = await query;

    if (sourcesError) {
      throw new Error(`Failed to fetch scraper sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No enabled scraper sources found", stats: {} }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`\n🚀 Starting scrape for ${sources.length} source(s)...`);

    const stats = {
      totalSources: sources.length,
      totalEventsScraped: 0,
      totalEventsInserted: 0,
      totalEventsDuplicate: 0,
      totalEventsFailed: 0,
      sourceResults: [] as Array<{
        name: string;
        scraped: number;
        inserted: number;
        duplicates: number;
        failed: number;
      }>,
    };

    // Process each source
    for (const source of sources as ScraperSource[]) {
      console.log(`\n📰 Processing source: ${source.name}`);
      
      const sourceStats = {
        name: source.name,
        scraped: 0,
        inserted: 0,
        duplicates: 0,
        failed: 0,
      };

      try {
        // Scrape events from source
        const rawEvents = await scrapeEventCards(source, enableDeepScraping);
        sourceStats.scraped = rawEvents.length;
        stats.totalEventsScraped += rawEvents.length;

        // Parse and insert each event
        const language = source.config.language || 'en';
        const defaultCoords = source.config.default_coordinates;
        
        for (const rawEvent of rawEvents) {
          console.log(`\n  Processing: ${rawEvent.title || "Unknown title"}`);

          // Parse with AI
          const parsed = await parseEventWithAI(geminiApiKey, rawEvent, language, defaultCoords);

          if (!parsed) {
            console.log("  ❌ Failed to parse event");
            sourceStats.failed++;
            continue;
          }

          console.log(`  ✅ Parsed: ${parsed.title} | ${parsed.event_date} | ${parsed.event_time}`);

          // Check for duplicate
          const eventDateTime = constructEventDateTime(parsed.event_date, parsed.event_time);
          const exists = await eventExists(supabase, parsed.title, eventDateTime);

          if (exists) {
            console.log("  ⏭️ Duplicate, skipping");
            sourceStats.duplicates++;
            continue;
          }

          if (dryRun) {
            console.log("  🧪 Dry run, would insert");
            sourceStats.inserted++;
            continue;
          }

          // Get coordinates - use parsed or default
          const coords = parsed.coordinates || defaultCoords || { lat: 0, lng: 0 };

          // Insert event
          const eventInsert: EventInsert = {
            title: parsed.title,
            description: parsed.description || "",
            category: parsed.category,
            event_type: DEFAULT_EVENT_TYPE,
            venue_name: parsed.venue_name || source.name,
            location: `POINT(${coords.lng} ${coords.lat})`,
            event_date: eventDateTime,
            event_time: parsed.event_time || "TBD",
            image_url: parsed.image_url,
            created_by: null,
            status: "published",
          };

          const inserted = await insertEvent(supabase, eventInsert);
          
          if (inserted) {
            console.log("  💾 Inserted successfully");
            sourceStats.inserted++;
          } else {
            sourceStats.failed++;
          }

          // Rate limiting between events
          await new Promise(resolve => setTimeout(resolve, source.config.rate_limit_ms || 200));
        }

        // Update source stats
        await updateSourceStats(supabase, source.id, sourceStats.scraped, true);

      } catch (error) {
        console.error(`Error processing source ${source.name}:`, error);
        await updateSourceStats(supabase, source.id, 0, false);
      }

      stats.sourceResults.push(sourceStats);
      stats.totalEventsInserted += sourceStats.inserted;
      stats.totalEventsDuplicate += sourceStats.duplicates;
      stats.totalEventsFailed += sourceStats.failed;
    }

    console.log("\n✅ Scraping complete!");
    console.log(`   Total scraped: ${stats.totalEventsScraped}`);
    console.log(`   Total inserted: ${stats.totalEventsInserted}`);
    console.log(`   Total duplicates: ${stats.totalEventsDuplicate}`);
    console.log(`   Total failed: ${stats.totalEventsFailed}`);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Scraper error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
