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
  };
}

// Default selectors for event scraping
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

// Default headers for scraping
const DEFAULT_HEADERS = {
  "User-Agent": "LCL-Meppel-Scraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
};

// Known Meppel venues with coordinates
const MEPPEL_VENUES = [
  { name: "Schouwburg Ogterop", lat: 52.6956, lng: 6.1938 },
  { name: "Ogterop", lat: 52.6956, lng: 6.1938 },
  { name: "Herberg 't Plein", lat: 52.6964, lng: 6.1925 },
  { name: "'t Plein", lat: 52.6964, lng: 6.1925 },
  { name: "De Plataan", lat: 52.6961, lng: 6.1944 },
  { name: "Café de Plataan", lat: 52.6961, lng: 6.1944 },
  { name: "Sportpark Ezinge", lat: 52.6898, lng: 6.2012 },
  { name: "Alcides", lat: 52.6898, lng: 6.2012 },
  { name: "De Beurs", lat: 52.6959, lng: 6.1931 },
  { name: "Luxor Cinema", lat: 52.6968, lng: 6.192 },
  { name: "Bibliotheek Meppel", lat: 52.695, lng: 6.1905 },
  { name: "Meppel Centrum", lat: 52.696, lng: 6.192 },
  { name: "Reestkerk", lat: 52.705, lng: 6.195 },
  { name: "Markt Meppel", lat: 52.6958, lng: 6.1935 },
];

const DEFAULT_MEPPEL_LOCATION = { lat: 52.696, lng: 6.192 };

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
  [key: string]: unknown; // Index signature for Supabase compatibility
}

// Utility functions
function getVenueCoordinates(venueName: string): { lat: number; lng: number } {
  const normalizedName = venueName.toLowerCase().trim();

  for (const venue of MEPPEL_VENUES) {
    const normalizedVenueName = venue.name.toLowerCase();
    if (normalizedName.includes(normalizedVenueName) || normalizedVenueName.includes(normalizedName)) {
      return { lat: venue.lat, lng: venue.lng };
    }
  }

  console.log(`📍 Unknown venue "${venueName}", using default Meppel center`);
  return DEFAULT_MEPPEL_LOCATION;
}

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

function getAISystemPrompt(): string {
  const today = getTodayISO();
  return `You are a data cleaner for a social event app in the Netherlands.
Your task is to extract event information from raw HTML text.

IMPORTANT: Keep all text in Dutch. Do not translate titles, descriptions, or venue names to English.
This is a local app for Meppel, Netherlands - all content should remain in Dutch.

Extract the following fields:
- title: The event name in Dutch (clean, without extra formatting)
- description: A nice, readable Dutch description (max 200 chars). If vague, create a brief summary in Dutch.
- category: Map to one of these EXACT values: cinema, crafts, sports, gaming, market
  - cinema: movies, films, theater, performances, shows, concerts, music
  - crafts: workshops, art, creative activities, exhibitions
  - sports: sports events, fitness, outdoor activities, walking, cycling
  - gaming: gaming events, esports, board games
  - market: markets, fairs, festivals, food events, community events
- venue_name: The venue/location name (keep in Dutch)
- venue_address: Full street address if mentioned (e.g., "Hoofdstraat 10, Meppel")
- event_date: Date in YYYY-MM-DD format. If only relative (e.g., "morgen"), calculate from today.
- event_time: IMPORTANT - Extract the START TIME in HH:MM 24-hour format (e.g., "19:30", "14:00", "21:00").
  Look for time patterns like "19.30 uur", "vanaf 20:00", "aanvang 19.30", "doors open 18:00", etc.
  Common Dutch time indicators: "uur", "aanvang", "start", "vanaf", "deuren open".
  If time shows a range like "19:00 - 22:00", use the START time (19:00).
  If time shows "14.00" (with dot), convert to "14:00" (with colon).
  ONLY use fallback values if absolutely no time is found:
  - "Hele dag" for all-day events explicitly marked as such
  - "Avond" (evening) if context suggests evening but no specific time
  - "Middag" (afternoon) if context suggests afternoon but no specific time
  - "TBD" only as absolute last resort
- image_url: Full image URL if found, or null
- coordinates: If you can determine the exact location, provide { "lat": number, "lng": number }. 
  For known Meppel venues, use these approximate coordinates:
  - Schouwburg Ogterop: 52.6956, 6.1938
  - De Plataan / Café de Plataan: 52.6961, 6.1944
  - Markt Meppel / Centrum: 52.6958, 6.1935
  - Luxor Cinema: 52.6968, 6.1920
  - Sportpark Ezinge / Alcides: 52.6898, 6.2012
  - If unknown, use Meppel center: 52.6960, 6.1920

Today's date is: ${today}

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.
Keep all text in the original Dutch language.
If you cannot extract meaningful data, return null for that field.`;
}

/**
 * Determines if a given date is in Daylight Saving Time (DST) in the Netherlands.
 * DST in Netherlands: Last Sunday of March (02:00 CET -> 03:00 CEST) to Last Sunday of October (03:00 CEST -> 02:00 CET)
 */
function isDutchDST(year: number, month: number, day: number): boolean {
  // Month is 1-indexed here (1 = January, 12 = December)
  
  // If before March or after October, definitely not DST
  if (month < 3 || month > 10) return false;
  if (month > 3 && month < 10) return true;
  
  // For March and October, need to check if we're past the last Sunday
  const lastSunday = getLastSundayOfMonth(year, month);
  
  if (month === 3) {
    // DST starts on last Sunday of March
    return day >= lastSunday;
  } else {
    // month === 10, DST ends on last Sunday of October
    return day < lastSunday;
  }
}

/**
 * Gets the day of the month for the last Sunday of a given month.
 */
function getLastSundayOfMonth(year: number, month: number): number {
  // month is 1-indexed (1 = January)
  // Find the last day of the month
  const lastDay = new Date(year, month, 0).getDate();
  
  // Find what day of the week the last day is
  const lastDayOfWeek = new Date(year, month - 1, lastDay).getDay();
  
  // Calculate how many days to subtract to get to Sunday (0)
  const daysToSubtract = lastDayOfWeek === 0 ? 0 : lastDayOfWeek;
  
  return lastDay - daysToSubtract;
}

function constructEventDateTime(eventDate: string, eventTime: string): string {
  const timeMatch = eventTime.match(/^(\d{2}):(\d{2})$/);

  const hours = timeMatch ? timeMatch[1] : "12";
  const minutes = timeMatch ? timeMatch[2] : "00";
  
  // Parse the date components
  const [year, month, day] = eventDate.split("-").map(Number);
  
  // Determine DST and calculate the UTC offset
  const isDST = isDutchDST(year, month, day);
  const utcOffset = isDST ? 2 : 1; // CEST = UTC+2, CET = UTC+1
  
  // Convert to UTC by subtracting the offset
  const localHours = parseInt(hours, 10);
  const localMinutes = parseInt(minutes, 10);
  // Date.UTC automatically handles negative hours and day rollover
  const utcHours = localHours - utcOffset;
  
  // Create a Date object in UTC (Date.UTC handles day rollover automatically)
  const utcDate = new Date(Date.UTC(year, month - 1, day, utcHours, localMinutes, 0));
  
  return utcDate.toISOString();
}

/**
 * Fetch event detail page and extract time from it
 * This is a deep scraping feature to get precise times
 */
async function fetchEventDetailTime(detailUrl: string, baseUrl: string): Promise<string | null> {
  try {
    // Make absolute URL if relative
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
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`      ⚠️ Detail page fetch failed: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Get all text from the page
    const pageText = $('body').text();
    
    // Dutch time patterns to look for (ordered by specificity)
    const timePatterns = [
      // "Aanvang: 20:00" or "aanvang 19.30 uur"
      /aanvang[:\s]*(\d{1,2})[.:h](\d{2})/i,
      // "Start: 19:30" or "start om 20.00"
      /start[:\s]*(?:om\s*)?(\d{1,2})[.:h](\d{2})/i,
      // "Tijd: 14:00" or "tijd 15.30"
      /tijd[:\s]*(\d{1,2})[.:h](\d{2})/i,
      // "Deuren open: 18:00" or "deuren 19.00"
      /deuren[:\s]*(?:open\s*)?(\d{1,2})[.:h](\d{2})/i,
      // "Vanaf 20:00" or "vanaf 19.30 uur"
      /vanaf\s+(\d{1,2})[.:h](\d{2})/i,
      // "Om 20:00 uur" or "om 19.30"
      /om\s+(\d{1,2})[.:h](\d{2})/i,
      // "20:00 uur" or "19.30 uur" (standalone)
      /(\d{1,2})[.:h](\d{2})\s*uur/i,
      // "20:00 - 22:00" (time range, take first)
      /(\d{1,2})[.:](\d{2})\s*[-–—]\s*\d{1,2}[.:]\d{2}/,
      // Look for time in specific elements
    ];
    
    // First check specific time-related elements
    const timeElements = [
      '.event-time', '.time', '[class*="time"]', '[class*="tijd"]',
      '.event-details', '.details', 'meta[property="event:start_time"]',
      '.aanvang', '[class*="aanvang"]',
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
    
    // Fall back to searching full page text
    for (const pattern of timePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const hours = match[1].padStart(2, '0');
        const minutes = match[2];
        // Validate reasonable hours (0-23)
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

// Scraping function - now accepts source configuration
async function scrapeEventCards(source: ScraperSource, enableDeepScraping: boolean = true): Promise<RawEventCard[]> {
  console.log(`🌐 Fetching agenda from ${source.name} (${source.url})...`);

  const headers = source.config.headers || DEFAULT_HEADERS;
  
  const response = await fetch(source.url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const events: RawEventCard[] = [];

  // Use source-specific selectors or fall back to defaults
  const selectors = source.config.selectors || DEFAULT_SELECTORS;

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
    const delayMs = source.config.rate_limit_ms || 300; // Slightly higher delay for detail pages
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.detailUrl) {
        console.log(`   [${i + 1}/${events.length}] ${event.title || 'Unknown'}...`);
        const time = await fetchEventDetailTime(event.detailUrl, source.url);
        if (time) {
          event.detailPageTime = time;
        }
        // Rate limiting between detail page fetches
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
async function parseEventWithAI(apiKey: string, rawEvent: RawEventCard): Promise<ParsedEvent | null> {
  try {
    // If we have a time from deep scraping, include it as a strong hint
    const timeHint = rawEvent.detailPageTime 
      ? `Time (from detail page): ${rawEvent.detailPageTime}` 
      : "Time hint: not found on detail page";

    const userPrompt = `Parse this event data and return ONLY valid JSON:

Title hint: ${rawEvent.title || "unknown"}
Date hint: ${rawEvent.date || "unknown"}
Location hint: ${rawEvent.location || "unknown"}
Description hint: ${rawEvent.description || "unknown"}
Image URL hint: ${rawEvent.imageUrl || "none"}
${timeHint}

Raw HTML:
${rawEvent.rawHtml}

Return JSON with these fields:
{
  "title": "event name",
  "description": "brief description (max 200 chars)",
  "category": "one of: cinema, crafts, sports, gaming, market",
  "venue_name": "location name",
  "venue_address": "full street address if available, or null",
  "event_date": "YYYY-MM-DD",
  "event_time": "HH:MM or TBD",
  "image_url": "url or null",
  "coordinates": { "lat": 52.696, "lng": 6.192 }
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: getAISystemPrompt() + "\n\n" + userPrompt }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Gemini API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.log("⚠️ Empty Gemini response");
      return null;
    }

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.title || !parsed.venue_name) {
      console.log("⚠️ Missing required fields from AI response");
      return null;
    }

    if (!VALID_CATEGORIES.includes(parsed.category)) {
      console.log(`⚠️ Invalid category "${parsed.category}", defaulting to "market"`);
      parsed.category = "market";
    }

    const parsedDate = parseToISODate(parsed.event_date);
    if (parsedDate) {
      parsed.event_date = parsedDate;
    } else if (parsed.event_date) {
      console.log(`⚠️ Could not parse date "${parsed.event_date}", using today`);
      parsed.event_date = getTodayISO();
    } else {
      parsed.event_date = getTodayISO();
    }

    // Priority for event_time:
    // 1. Deep-scraped time from detail page (most reliable)
    // 2. AI-parsed time from HTML
    // 3. Fallback to TBD
    let finalTime = parsed.event_time || "TBD";
    
    // If we have a deep-scraped time, use it (it's from the actual detail page)
    if (rawEvent.detailPageTime) {
      finalTime = rawEvent.detailPageTime;
      console.log(`   ⏱️ Using deep-scraped time: ${finalTime}`);
    } else if (parsed.event_time && /^\d{1,2}:\d{2}$/.test(parsed.event_time)) {
      const [hours, mins] = parsed.event_time.split(":");
      finalTime = `${hours.padStart(2, "0")}:${mins}`;
    }

    // Validate coordinates if provided by AI
    let coordinates: { lat: number; lng: number } | undefined;
    if (parsed.coordinates && 
        typeof parsed.coordinates.lat === 'number' && 
        typeof parsed.coordinates.lng === 'number') {
      // Validate coordinates are within reasonable bounds for Netherlands
      if (parsed.coordinates.lat >= 50 && parsed.coordinates.lat <= 54 &&
          parsed.coordinates.lng >= 3 && parsed.coordinates.lng <= 8) {
        coordinates = parsed.coordinates;
      }
    }

    return {
      title: parsed.title,
      description: parsed.description || "",
      category: parsed.category,
      venue_name: parsed.venue_name,
      venue_address: parsed.venue_address || undefined,
      event_date: parsed.event_date,
      event_time: finalTime,
      image_url: parsed.image_url || rawEvent.imageUrl || null,
      coordinates,
    };
  } catch (error) {
    console.error("❌ AI parsing error:", error);
    return null;
  }
}

// Database operations
// deno-lint-ignore no-explicit-any
async function eventExists(
  supabase: any,
  title: string,
  eventDate: string
): Promise<boolean> {
  const startOfDay = `${eventDate}T00:00:00.000Z`;
  const endOfDay = `${eventDate}T23:59:59.999Z`;

  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("title", title)
    .gte("event_date", startOfDay)
    .lte("event_date", endOfDay)
    .limit(1);

  if (error) {
    console.error("❌ Error checking for duplicates:", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

// deno-lint-ignore no-explicit-any
async function insertEvent(
  supabase: any,
  event: EventInsert
): Promise<boolean> {
  const { error } = await supabase.from("events").insert(event);

  if (error) {
    console.error(`❌ Failed to insert "${event.title}":`, error.message);
    return false;
  }

  return true;
}

// Fetch enabled scraper sources from database
// deno-lint-ignore no-explicit-any
async function getEnabledSources(supabase: any): Promise<ScraperSource[]> {
  const { data, error } = await supabase
    .from("scraper_sources")
    .select("id, name, url, enabled, config")
    .eq("enabled", true);

  if (error) {
    console.error("❌ Error fetching scraper sources:", error.message);
    return [];
  }

  return data || [];
}

// Update source stats after scraping
// deno-lint-ignore no-explicit-any
async function updateSourceStats(
  supabase: any,
  sourceId: string,
  eventsScraped: number,
  success: boolean
): Promise<void> {
  const { error } = await supabase.rpc("update_scraper_source_stats", {
    p_source_id: sourceId,
    p_events_scraped: eventsScraped,
    p_success: success,
  });

  if (error) {
    console.error("⚠️ Failed to update source stats:", error.message);
  }
}

// Process a single source and return results
// deno-lint-ignore no-explicit-any
async function processSource(
  supabase: any,
  source: ScraperSource,
  apiKey: string
): Promise<{
  sourceId: string;
  sourceName: string;
  totalScraped: number;
  parsedByAI: number;
  inserted: number;
  skipped: number;
  failed: number;
  error?: string;
}> {
  const result = {
    sourceId: source.id,
    sourceName: source.name,
    totalScraped: 0,
    parsedByAI: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    error: undefined as string | undefined,
  };

  try {
    // Step 1: Scrape events from this source
    console.log(`\n📥 Scraping from: ${source.name}`);
    const rawEvents = await scrapeEventCards(source);
    result.totalScraped = rawEvents.length;

    if (rawEvents.length === 0) {
      console.log(`   ⚠️ No events found on ${source.name}`);
      await updateSourceStats(supabase, source.id, 0, true);
      return result;
    }

    // Step 2: Parse with AI
    console.log(`   🤖 Parsing ${rawEvents.length} events with AI...`);
    const parsedEvents: ParsedEvent[] = [];
    const rateLimitMs = source.config.rate_limit_ms || 200;

    for (let i = 0; i < rawEvents.length; i++) {
      const rawEvent = rawEvents[i];
      console.log(`   [${i + 1}/${rawEvents.length}] Processing: ${rawEvent.title || "Unknown event"}...`);

      const parsed = await parseEventWithAI(apiKey, rawEvent);
      if (parsed) {
        parsedEvents.push(parsed);
        console.log(`   ✅ Parsed: "${parsed.title}" (${parsed.category})`);
      } else {
        console.log("   ⚠️ Skipped: Could not parse event");
      }

      // Rate limiting
      if (i < rawEvents.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
      }
    }

    result.parsedByAI = parsedEvents.length;
    console.log(`   ✅ Successfully parsed ${parsedEvents.length} of ${rawEvents.length} events`);

    // Step 3: Insert into database
    console.log(`   💾 Inserting events into database...`);

    for (const event of parsedEvents) {
      const exists = await eventExists(supabase, event.title, event.event_date);
      if (exists) {
        console.log(`   ⏭️ Skipping duplicate: "${event.title}" on ${event.event_date}`);
        result.skipped++;
        continue;
      }

      // Use AI-provided coordinates if available, otherwise fall back to known venues
      const coords = event.coordinates || getVenueCoordinates(event.venue_name);

      if (event.coordinates) {
        console.log(`   📍 Using AI-provided coordinates for "${event.venue_name}": ${coords.lat}, ${coords.lng}`);
      }

      const insertData: EventInsert = {
        title: event.title,
        description: event.description,
        category: event.category,
        event_type: DEFAULT_EVENT_TYPE,
        venue_name: event.venue_name,
        location: `POINT(${coords.lng} ${coords.lat})`,
        event_date: constructEventDateTime(event.event_date, event.event_time),
        event_time: event.event_time,
        image_url: event.image_url,
        created_by: null,
        status: "Upcoming",
      };

      const success = await insertEvent(supabase, insertData);
      if (success) {
        console.log(`   ✅ Inserted: "${event.title}"`);
        result.inserted++;
      } else {
        result.failed++;
      }
    }

    // Update source stats
    await updateSourceStats(supabase, source.id, result.inserted, true);

  } catch (error) {
    console.error(`❌ Error processing source ${source.name}:`, error);
    result.error = error instanceof Error ? error.message : "Unknown error";
    await updateSourceStats(supabase, source.id, 0, false);
  }

  return result;
}

// Main handler
serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get secrets
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("🚀 Starting Multi-Source Event Scraper (using Google Gemini)...");

    // Step 1: Fetch enabled sources from database
    console.log("\n📋 Fetching enabled scraper sources...");
    const sources = await getEnabledSources(supabase);

    if (sources.length === 0) {
      console.log("⚠️ No enabled scraper sources found.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No enabled scraper sources found. Add sources to the scraper_sources table.",
          sources: [],
          totals: { totalScraped: 0, parsedByAI: 0, inserted: 0, skipped: 0, failed: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📍 Found ${sources.length} enabled source(s): ${sources.map(s => s.name).join(", ")}`);

    // Step 2: Process each source
    const sourceResults = [];
    const totals = {
      totalScraped: 0,
      parsedByAI: 0,
      inserted: 0,
      skipped: 0,
      failed: 0,
    };

    for (const source of sources) {
      const result = await processSource(supabase, source, GOOGLE_AI_API_KEY);
      sourceResults.push(result);

      // Aggregate totals
      totals.totalScraped += result.totalScraped;
      totals.parsedByAI += result.parsedByAI;
      totals.inserted += result.inserted;
      totals.skipped += result.skipped;
      totals.failed += result.failed;
    }

    // Summary
    const summary = {
      success: true,
      sources: sourceResults,
      totals,
    };

    console.log("\n📊 Final Summary:");
    console.log(`   Sources processed: ${sources.length}`);
    console.log(`   Total scraped: ${totals.totalScraped}`);
    console.log(`   Parsed by AI: ${totals.parsedByAI}`);
    console.log(`   Inserted: ${totals.inserted}`);
    console.log(`   Skipped (duplicates): ${totals.skipped}`);
    console.log(`   Failed: ${totals.failed}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Scraper error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
