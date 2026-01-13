import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scraper-key",
};

// Valid categories for the events table
export const VALID_CATEGORIES = ["cinema", "crafts", "sports", "gaming", "market"] as const;
export type Category = (typeof VALID_CATEGORIES)[number];

// Default event type for scraped events
const DEFAULT_EVENT_TYPE = "anchor";

// Interface for scraper source from database
export interface ScraperSource {
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
    urlPatterns: [/ontdek[\w]+\.nl/i, /bezoek[\w]+\.nl/i],
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
  // "Beleef" platform - WordPress-based event sites (Paviljoen/venue style)
  beleef: {
    name: "Beleef WordPress Platform",
    urlPatterns: [/beleef[\w]+\.nl/i, /paviljoen[\w]+\.nl/i],
    selectors: [
      ".archive-item-wrapper",
      ".archive-item",
      ".block-item",
      'a.block-item',
      '[class*="archive-item"]',
    ],
    dateSelector: ".date p, .date",
    timeSelector: ".time",
  },
  // "Visit" platform - tourism boards (Plaece/ODP CMS)
  visit: {
    name: "Visit/VVV Platform",
    urlPatterns: [/visit[\w]+\.(nl|com)/i, /vvv[\w]+\.nl/i, /touristinfo[\w]+\.nl/i],
    selectors: [
      'li.tiles__tile[itemtype="http://schema.org/Event"]',
      "li.tiles__tile",
      ".tiles__tile",
      '[itemtype="http://schema.org/Event"]',
      ".odp-list-container li",
    ],
    dateSelector: ".description__date",
    timeSelector: ".description__time",
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
export function getOptimizedSelectors(source: ScraperSource): string[] {
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
  ".agenda-event",
  // More specific selectors - avoid generic ones that catch nav items
  'main article[class*="event"]',
  'main [class*="agenda-item"]',
  '.content article',
];

// Containers to exclude from scraping (navigation, footers, etc.)
const EXCLUDED_CONTAINERS = [
  'nav', 'header', 'footer', '.menu', '.navigation', '.nav',
  '.footer', '.header', '.sidebar', '[role="navigation"]',
  '.language-selector', '.cookie-notice', '.disclaimer',
  '.breadcrumb', '.pagination', '.social-links', '.share-buttons',
  '.newsletter', '.signup', '.login', '.search', '.filter',
];

// Common navigation/UI text that should never be event titles (exact matches only)
const TITLE_BLOCKLIST = [
  // Navigation (exact matches)
  'kies je taal', 'choose language', 'sprache wählen', 'selecteer taal',
  'disclaimer', 'privacy', 'cookie', 'contact', 'over ons', 'about us',
  'info', 'tips', 'ontdek', 'discover', 'entdecken', 'about',
  'home', 'menu', 'search', 'zoeken', 'suchen', 'login', 'inloggen',
  'register', 'registreren', 'newsletter', 'nieuwsbrief',
  'follow us', 'volg ons', 'share', 'delen', 'teilen',
  'read more', 'lees meer', 'mehr lesen', 'bekijk alle', 'view all',
  // Generic UI (exact matches)
  'filters', 'sorteer', 'sort by', 'categorie', 'category',
  'agenda', 'evenementen', 'events', 'kalender', 'calendar',
  'meer informatie', 'more info', 'details', 'tickets',
  'accepteren', 'accept', 'weigeren', 'decline',
  'sluiten', 'close', 'open', 'terug', 'back', 'next', 'previous',
  'volgende', 'vorige', 'laden', 'loading',
];

// Default headers for scraping (language-neutral)
const DEFAULT_HEADERS = {
  "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

// Interfaces
export interface RawEventCard {
  rawHtml: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string | null;
  description: string;
  detailUrl: string | null;
  detailPageTime?: string; // Time extracted from detail page
}

export interface ParsedEvent {
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
 * Create a unique key for geocode caching
 */
function createVenueKey(venueName: string, country: string = "NL"): string {
  return `${venueName.toLowerCase().trim()}|${country.toUpperCase()}`;
}

/**
 * Check geocode cache for existing coordinates
 */
// deno-lint-ignore no-explicit-any
async function getCachedGeocode(
  supabase: any,
  venueName: string,
  country: string = "NL"
): Promise<{ lat: number; lng: number } | null> {
  const venueKey = createVenueKey(venueName, country);
  
  const { data, error } = await supabase
    .from("geocode_cache")
    .select("lat, lng")
    .eq("venue_key", venueKey)
    .limit(1);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  console.log(`    📍 Cache hit for "${venueName}"`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lng) };
}

/**
 * Store geocoded coordinates in cache
 */
// deno-lint-ignore no-explicit-any
async function cacheGeocode(
  supabase: any,
  venueName: string,
  country: string,
  coords: { lat: number; lng: number },
  displayName?: string
): Promise<void> {
  const venueKey = createVenueKey(venueName, country);
  
  try {
    await supabase.from("geocode_cache").upsert({
      venue_key: venueKey,
      lat: coords.lat,
      lng: coords.lng,
      display_name: displayName,
    }, { onConflict: "venue_key" });
  } catch (error) {
    console.warn(`    ⚠️ Failed to cache geocode: ${error}`);
  }
}

/**
 * Geocode a venue using Nominatim (OpenStreetMap) API
 * Rate limited to 1 request per second as per Nominatim usage policy
 */
async function geocodeVenue(
  venueName: string,
  country: string = "NL",
  municipality?: string
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  try {
    // Build search query - include municipality if available for better accuracy
    const searchParts = [venueName];
    if (municipality) {
      searchParts.push(municipality);
    }
    searchParts.push(country);
    
    const query = encodeURIComponent(searchParts.join(", "));
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`;
    
    console.log(`    🌍 Geocoding: "${venueName}"...`);
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LCL-EventScraper/1.0 (https://github.com/lcl-app; Event aggregator)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.log(`    ⚠️ Nominatim error: ${response.status}`);
      return null;
    }
    
    const results = await response.json();
    
    if (results && results.length > 0) {
      const result = results[0];
      const coords = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
      };
      console.log(`    ✅ Geocoded to: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      return coords;
    }
    
    // If first query fails and we had municipality, try without it
    if (municipality) {
      const simpleQuery = encodeURIComponent(`${venueName}, ${country}`);
      const simpleUrl = `https://nominatim.openstreetmap.org/search?q=${simpleQuery}&format=json&limit=1`;
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const simpleResponse = await fetch(simpleUrl, {
        headers: {
          "User-Agent": "LCL-EventScraper/1.0 (https://github.com/lcl-app; Event aggregator)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (simpleResponse.ok) {
        const simpleResults = await simpleResponse.json();
        if (simpleResults && simpleResults.length > 0) {
          const result = simpleResults[0];
          const coords = {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            displayName: result.display_name,
          };
          console.log(`    ✅ Geocoded (simple) to: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          return coords;
        }
      }
    }
    
    console.log(`    ⚠️ No geocode results for "${venueName}"`);
    return null;
  } catch (error) {
    console.log(`    ⚠️ Geocoding error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Get coordinates for a venue, using cache first, then geocoding, then fallback
 */
// deno-lint-ignore no-explicit-any
async function getVenueCoordinates(
  supabase: any,
  venueName: string,
  country: string = "NL",
  municipality?: string,
  defaultCoords?: { lat: number; lng: number }
): Promise<{ lat: number; lng: number }> {
  // Skip geocoding for generic/empty venue names
  if (!venueName || venueName.length < 3 || venueName.toLowerCase() === "unknown") {
    console.log(`    ⏭️ Skipping geocode for generic venue: "${venueName}"`);
    return defaultCoords || { lat: 0, lng: 0 };
  }
  
  // 1. Check cache first
  const cached = await getCachedGeocode(supabase, venueName, country);
  if (cached) {
    return cached;
  }
  
  // 2. Rate limit before geocoding (1 req/sec for Nominatim)
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 3. Try geocoding
  const geocoded = await geocodeVenue(venueName, country, municipality);
  
  if (geocoded) {
    // Cache the result
    await cacheGeocode(supabase, venueName, country, geocoded, geocoded.displayName);
    return { lat: geocoded.lat, lng: geocoded.lng };
  }
  
  // 4. Fall back to default coordinates
  console.log(`    📍 Using default coordinates for "${venueName}"`);
  return defaultCoords || { lat: 0, lng: 0 };
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
export function parseToISODate(dateStr: string, today?: Date): string | null {
  if (!dateStr || typeof dateStr !== "string") {
    return null;
  }

  const todayDate = today ? new Date(today) : new Date();
  const safeYear = (year: number) => year >= 2020 && year <= 2030;
  const cleaned = dateStr.trim().toLowerCase();
  if (!cleaned) return null;

  const relativeMap: Record<string, number> = {
    vandaag: 0,
    today: 0,
    morgen: 1,
    tomorrow: 1,
    overmorgen: 2,
    "day after tomorrow": 2,
  };

  if (relativeMap[cleaned] !== undefined) {
    const target = new Date(todayDate);
    target.setDate(target.getDate() + relativeMap[cleaned]);
    return target.toISOString().split("T")[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("-").map(Number);
    if (safeYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return cleaned;
    }
    return null;
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    if (!safeYear(year)) return null;
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const MONTHS: Record<string, number> = {
    januari: 1, jan: 1, january: 1,
    februari: 2, feb: 2, february: 2, februar: 2,
    maart: 3, mrt: 3, march: 3, märz: 3, maerz: 3,
    april: 4, apr: 4,
    mei: 5, may: 5, mai: 5,
    juni: 6, jun: 6, june: 6,
    juli: 7, jul: 7, july: 7,
    augustus: 8, aug: 8, august: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, october: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };

  const textual = cleaned
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dayNamePattern = "(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?";
  // Allow optional localized day name + day + month name (+ optional year) with Unicode characters.
  const textualMatch = textual.match(new RegExp(`^${dayNamePattern}\\s*(\\d{1,2})\\s*([\\p{L}.]+)\\s*(\\d{2,4})?$`, "iu"));
  if (textualMatch) {
    const day = parseInt(textualMatch[2], 10);
    const monthNameRaw = textualMatch[3].replace(/\./g, "");
    const yearMatch = textualMatch[4] ? parseInt(textualMatch[4], 10) : todayDate.getFullYear();
    const month = MONTHS[monthNameRaw] || MONTHS[monthNameRaw.slice(0, 3)];
    if (month && day >= 1 && day <= 31 && safeYear(yearMatch)) {
      return `${yearMatch}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const europeanMatch = textual.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (europeanMatch) {
    const [, dayRaw, monthRaw, yearRaw] = europeanMatch;
    const centuryPrefix = String(todayDate.getFullYear()).slice(0, 2);
    const yearNum = parseInt(yearRaw.length === 2 ? `${centuryPrefix}${yearRaw}` : yearRaw, 10);
    if (!safeYear(yearNum)) return null;
    return `${yearNum}-${monthRaw.padStart(2, "0")}-${dayRaw.padStart(2, "0")}`;
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
export function constructEventDateTime(eventDate: string, eventTime: string): string {
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

export function normalizeEventDateForStorage(
  eventDate: string,
  eventTime: string
): { timestamp: string; dateOnly: string | null } {
  const isoDate = parseToISODate(eventDate);
  const dateForStorage = isoDate || eventDate;
  return {
    timestamp: constructEventDateTime(dateForStorage, eventTime),
    dateOnly: isoDate,
  };
}

function normalizeMatchedTime(hours: string, minutes: string, ampm?: string): string | null {
  let hourNum = parseInt(hours, 10);
  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "pm" && hourNum < 12) hourNum += 12;
    if (lower === "am" && hourNum === 12) hourNum = 0;
  }
  if (hourNum > 23) return null;
  return `${String(hourNum).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

/**
 * Fetch event detail page and extract time from it
 */
export async function fetchEventDetailTime(
  detailUrl: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<string | null> {
  try {
    let fullUrl = detailUrl;
    if (detailUrl.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      fullUrl = `${urlObj.protocol}//${urlObj.host}${detailUrl}`;
    } else if (!detailUrl.startsWith('http')) {
      fullUrl = `${baseUrl.replace(/\/$/, '')}/${detailUrl}`;
    }

    console.log(`      🔍 Fetching detail page: ${fullUrl}`);
    
    const response = await fetcher(fullUrl, { 
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
      /aanvang[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /vanaf\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /(\d{1,2})[.:h](\d{2})\s*uur/i,
      // German patterns
      /beginn[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /ab\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /(\d{1,2})[.:h](\d{2})\s*uhr/i,
      // English patterns
      /starts?\s*(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /from\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /doors?\s*(?:open\s*)?(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      // Generic patterns
      /start[:\s]*(?:om\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /time[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /om\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /(\d{1,2})[.:](\d{2})\s*[-–—]\s*\d{1,2}[.:]\d{2}(?:\s*(am|pm))?/i,
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
            const time = normalizeMatchedTime(match[1], match[2], match[3]);
            if (time) {
              console.log(`      ✅ Found time in element: ${time}`);
              return time;
            }
          }
        }
      }
    }
    
    for (const pattern of timePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const time = normalizeMatchedTime(match[1], match[2], match[3]);
        if (time) {
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
function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTitle($el: cheerio.Cheerio<cheerio.AnyNode>, $: cheerio.CheerioAPI): string {
  const selectors = [
    "h1, h2, h3, h4",
    ".title",
    '[class*="title"]',
    'span[class*="title"]',
    'div[class*="title"]',
    "[data-event-title]",
    '[aria-label*="event"]',
    '[class*="event-title"]',
  ];

  for (const selector of selectors) {
    const text = $el.find(selector).first().text();
    if (text && normalizeWhitespace(text).length > 0) {
      return normalizeWhitespace(text);
    }
  }

  const firstLinkText = $el.find("a").first().text();
  return normalizeWhitespace(firstLinkText || "");
}

function buildElementDedupKey($el: cheerio.Cheerio<cheerio.AnyNode>, $: cheerio.CheerioAPI): string | null {
  const link = $el.find("a").first().attr("href") || "";
  const title = extractTitle($el, $);
  if (!link && !title) {
    const textContent = normalizeWhitespace($el.text() || "");
    if (textContent.length > 200) return null;
    const textSnippet = textContent.slice(0, 80);
    return textSnippet ? `text:${textSnippet.toLowerCase()}` : null;
  }
  return `${link.toLowerCase()}|${title.toLowerCase()}`;
}

export async function scrapeEventCards(
  source: ScraperSource,
  enableDeepScraping: boolean = true,
  options: { fetcher?: typeof fetch; enableDebug?: boolean; detailFetcher?: typeof fetch } = {}
): Promise<RawEventCard[]> {
  const fetcher = options.fetcher || fetch;
  const detailFetcher = options.detailFetcher || fetcher;
  const enableDebug = options.enableDebug === true;
  // Apply dynamic year replacement if configured
  const actualUrl = applyDynamicYear(source.url, source.config.dynamic_year === true);
  
  // Detect platform for optimization
  const platform = detectPlatform(actualUrl);
  if (platform) {
    console.log(`🔧 Using optimized config for: ${platform.name}`);
  }
  
  console.log(`🌐 Fetching agenda from ${source.name} (${actualUrl})...`);

  const headers = source.config.headers || DEFAULT_HEADERS;
  const response = await fetcher(actualUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.name}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const events: RawEventCard[] = [];

  const selectors = getOptimizedSelectors(source);

  const collectedElements: cheerio.AnyNode[] = [];
  const seenKeys = new Set<string>();

  for (const selector of selectors) {
    const elements = $(selector);
    if (elements.length > 0) {
      console.log(`Found ${elements.length} elements with selector: ${selector}`);
    }
    elements.each((_, el) => {
      const $el = $(el);
      const key = buildElementDedupKey($el, $);
      if (!key) {
        if (enableDebug) {
          console.log("  ⏭️ Skipped element without dedup key");
        }
        return;
      }
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      collectedElements.push(el);
    });
  }

  // Filter out elements inside excluded containers
  const excludedSelector = EXCLUDED_CONTAINERS.join(', ');
  let foundElements = $(collectedElements).filter((_: number, el: cheerio.AnyNode) => {
    const isInExcluded = $(el).parents(excludedSelector).length > 0;
    if (isInExcluded) {
      console.log(`  ⏭️ Skipped element inside excluded container`);
    }
    return !isInExcluded;
  });

  if (foundElements.length === 0) {
    console.log("⚠️ No event elements found with common selectors. Trying generic approach...");
    foundElements = $("main article, main .card, .content article, .events article")
      .not(excludedSelector)
      .filter((_: number, el: cheerio.AnyNode) => {
        const $el = $(el);
        const text = $el.text();
        const hasDate = $el.find('time, [class*="date"], [datetime]').length > 0;
        const hasTitle = $el.find('h1, h2, h3, h4').length > 0;
        const hasDatePattern = /\d{1,2}[\s\-./]\w{3,}|\d{1,2}[\s\-./]\d{1,2}/i.test(text);
        return text.length > 50 && text.length < 5000 && (hasDate || hasTitle || hasDatePattern);
      });
  }

  console.log(`Processing ${foundElements.length} potential event cards...`);
  const eventKeys = new Set<string>();

  // deno-lint-ignore no-explicit-any
  foundElements.each((_: number, element: any) => {
    const $el = $(element);
    const rawHtml = $el.html() || "";
    const title = extractTitle($el, $);

    // Skip if title is blocklisted (exact match only)
    const titleLower = title.toLowerCase().trim();
    if (TITLE_BLOCKLIST.some(blocked => titleLower === blocked)) {
      console.log(`  ⏭️ Skipped blocklisted title: "${title}"`);
      return;
    }

    // Skip if title is too short or empty
    if (!title || title.length < 4) {
      console.log(`  ⏭️ Skipped empty/short title: "${title}"`);
      return;
    }

    // Skip if title looks like navigation (single word, all caps, etc.)
    if (title.length < 15 && !/\d/.test(title) && !title.includes(' ')) {
      // Single word without numbers - likely navigation unless it has date patterns nearby
      const hasDateNearby = /\d{1,2}[\s\-./]\w{3,}|\d{1,2}[\s\-./]\d{1,2}/i.test(rawHtml);
      if (!hasDateNearby) {
        console.log(`  ⏭️ Skipped likely navigation item: "${title}"`);
        return;
      }
    }

    const dataDateEl = $el.find("[data-event-date], [data-date]").first();
    const dateAttr =
      dataDateEl.attr("data-event-date") ||
      dataDateEl.attr("data-date") ||
      $el.attr("data-event-date") ||
      $el.attr("data-date") ||
      "";

    const date =
      $el.find("time, .date, [class*=\"date\"], .event-date").first().text().trim() ||
      $el.find("[datetime]").first().attr("datetime") ||
      dateAttr;

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

    // Final validation: must have date OR date-like patterns in HTML
    const hasDate = date && date.length > 0;
    const hasDatePattern = /\d{1,2}[\s\-./](jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2})[\s\-./]?\d{0,4}/i.test(rawHtml);
    
    if (!hasDate && !hasDatePattern) {
      console.log(`  ⏭️ Skipped no date indicator: "${title}"`);
      return;
    }

    const dedupKey = `${(detailUrl || '').toLowerCase()}|${titleLower}`;
    if (eventKeys.has(dedupKey)) {
      if (enableDebug) {
        console.log(`  ⏭️ Deduped event: "${title}"`);
      }
      return;
    }
    eventKeys.add(dedupKey);

    console.log(`  ✅ Valid event: "${title}"`);
    events.push({
      rawHtml: rawHtml.substring(0, 3000),
      title,
      date,
      location,
      imageUrl,
      description,
      detailUrl,
    });
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
        const time = await fetchEventDetailTime(event.detailUrl, actualUrl, detailFetcher);
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

export async function callGemini(
  apiKey: string,
  body: unknown,
  fetcher: typeof fetch = fetch
): Promise<string | null> {
  const response = await fetcher(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Gemini API error: ${response.status} - ${errorText}`);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// AI Parsing function using Google Gemini
export async function parseEventWithAI(
  apiKey: string, 
  rawEvent: RawEventCard, 
  language: string = 'en',
  defaultCoords?: { lat: number; lng: number },
  opts: { callGeminiFn?: typeof callGemini } = {}
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

    const payload = {
      contents: [
        { role: "user", parts: [{ text: getAISystemPrompt(language, defaultCoords) }] },
        { role: "model", parts: [{ text: "I understand. I will parse event data and return clean JSON." }] },
        { role: "user", parts: [{ text: userPrompt }] },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };

    const geminiCaller = opts.callGeminiFn || callGemini;
    const text = await geminiCaller(apiKey, payload);

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
export async function eventExists(
  supabase: any,
  title: string,
  eventDate: string,
  eventTime: string,
  normalized?: { timestamp: string; dateOnly: string | null }
): Promise<boolean> {
  const { timestamp, dateOnly } = normalized || normalizeEventDateForStorage(eventDate, eventTime);

  const primaryCheck = await supabase
    .from("events")
    .select("id")
    .eq("title", title)
    .eq("event_date", timestamp)
    .limit(1);

  if (primaryCheck.error) {
    console.error("Error checking for duplicate:", primaryCheck.error);
    return false;
  }

  if (primaryCheck.data && primaryCheck.data.length > 0) {
    return true;
  }

  if (dateOnly) {
    const dateOnlyCheck = await supabase
      .from("events")
      .select("id")
      .eq("title", title)
      .eq("event_date", dateOnly)
      .limit(1);

    if (!dateOnlyCheck.error && dateOnlyCheck.data && dateOnlyCheck.data.length > 0) {
      return true;
    }
  }

  return false;
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
export async function handleRequest(req: Request): Promise<Response> {
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
      enableDebug?: boolean;
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

    const { sourceId, dryRun = false, enableDeepScraping = true, limit, enableDebug = false } = options;

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
        const rawEvents = await scrapeEventCards(source, enableDeepScraping, { enableDebug });
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

          // Check for duplicate using normalized storage format
          const normalizedDate = normalizeEventDateForStorage(parsed.event_date, parsed.event_time);
          const exists = await eventExists(
            supabase,
            parsed.title,
            parsed.event_date,
            parsed.event_time,
            normalizedDate
          );

          if (exists) {
            console.log("  ⏭️ Duplicate, skipping");
            sourceStats.duplicates++;
            continue;
          }

          // Get venue coordinates via geocoding (with caching)
          const venueCountry = source.config.country || "NL";
          const municipality = source.name.replace(/^(Ontdek|Bezoek|Visit)\s*/i, "");
          
          const coords = await getVenueCoordinates(
            supabase,
            parsed.venue_name || source.name,
            venueCountry,
            municipality,
            defaultCoords
          );

          if (dryRun) {
            console.log(`  🧪 Dry run, would insert at ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
            sourceStats.inserted++;
            continue;
          }

          // Insert event
          const eventInsert: EventInsert = {
            title: parsed.title,
            description: parsed.description || "",
            category: parsed.category,
            event_type: DEFAULT_EVENT_TYPE,
            venue_name: parsed.venue_name || source.name,
            location: `POINT(${coords.lng} ${coords.lat})`,
            event_date: normalizedDate.timestamp,
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
}

if (import.meta.main) {
  serve(handleRequest);
}
