import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../_shared/dateUtils.ts";
import type { ScraperSource, RawEventCard, StructuredDate, StructuredLocation } from "./shared.ts";
import {
  createSpoofedFetch,
  resolveStrategy,
  type PageFetcher,
  StaticPageFetcher,
  DynamicPageFetcher,
  createFetcherForSource,
} from "../_shared/strategies.ts";
import { sendSlackNotification } from "../_shared/slack.ts";
import { jitteredDelay, isRateLimited } from "../_shared/rateLimiting.ts";
import {
  logScraperFailure,
  getHistoricalEventCount,
  increaseRateLimit,
  getEffectiveRateLimit
} from "../_shared/scraperObservability.ts";
import { parseRateLimitHeaders } from "../_shared/rateLimitParsing.ts";
import { classifyTextToCategory, INTERNAL_CATEGORIES, type InternalCategory } from "../_shared/categoryMapping.ts";

interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Converts lat/lng into PostGIS POINT string with lng first.
 * Returns POINT(0 0) and fallback flag when coordinates are missing or zeroed.
 */
function toPostgisPoint(coords?: Coordinates | null): { point: string; isFallback: boolean } {
  if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return { point: 'POINT(0 0)', isFallback: true };
  }

  const isZero = Math.abs(coords.lat) < 1e-6 && Math.abs(coords.lng) < 1e-6;
  return { point: `POINT(${coords.lng} ${coords.lat})`, isFallback: isZero };
}

// Default CSS selectors for event scraping
const SELECTORS = [
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
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scraper-key",
};

// Dynamically calculate target year (current year, or configurable via env)
function getTargetYear(): number {
  const envYear = Deno.env.get("TARGET_EVENT_YEAR");
  if (envYear) {
    const parsed = parseInt(envYear, 10);
    if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2100) {
      return parsed;
    }
  }
  return new Date().getFullYear();
}

const TARGET_YEAR = getTargetYear();

const DEFAULT_EVENT_TYPE = "anchor";

// Maximum length for input strings in log messages to prevent log overflow
const MAX_LOG_INPUT_LENGTH = 100;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const stripHtml = (value?: string) =>
  (value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value: string) =>
  value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());

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

export function constructEventDateTime(eventDate: string, eventTime: string): string {
  const timeMatch = eventTime.match(/^(\d{2}):(\d{2})$/);
  const hours = timeMatch ? timeMatch[1] : "12";
  const minutes = timeMatch ? timeMatch[2] : "00";

  const [year, month, day] = eventDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, Number(hours), Number(minutes), 0));
  return date.toISOString();
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

/**
 * Parses raw date/time strings into a structured date object.
 * 
 * Note: This function stores the parsed local time as-is in UTC format.
 * This is intentional because scraped events typically display times in the
 * local timezone (Europe/Amsterdam), and we want to preserve that display time.
 * The timezone field is stored for future use if proper timezone conversion is needed.
 * 
 * @param dateStr - Raw date string (e.g., "vandaag", "za 18 mei", "2026-01-15")
 * @param timeStr - Raw time string (e.g., "20:00", "hele dag", "TBD")
 * @param timezone - IANA timezone identifier stored for reference (default: Europe/Amsterdam)
 * @returns StructuredDate object with times stored as UTC (representing local display time)
 */
export function parseDate(
  dateStr: string,
  timeStr: string | null | undefined,
  timezone: string = "Europe/Amsterdam"
): StructuredDate | null {
  const isoDate = parseToISODate(dateStr);
  if (!isoDate) return null;

  const normalizedTime = timeStr?.trim().toLowerCase() || "";
  const isAllDay = !normalizedTime ||
    normalizedTime === "tbd" ||
    normalizedTime === "hele dag" ||
    normalizedTime === "all day";

  // Parse time if available
  let hours = 12;
  let minutes = 0;

  if (!isAllDay) {
    const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    } else {
      // Map descriptive times to approximate hours
      const descriptiveMap: Record<string, number> = {
        'ochtend': 10,
        'morning': 10,
        'middag': 14,
        'afternoon': 14,
        'avond': 20,
        'evening': 20,
        'nacht': 22,
        'night': 22,
      };
      hours = descriptiveMap[normalizedTime] || 12;
    }
  }

  // Store the local time as UTC - the timezone field indicates the original timezone
  // This preserves the display time while providing timezone context
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcStart = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)).toISOString();

  return {
    utc_start: utcStart,
    timezone,
    all_day: isAllDay,
  };
}

/**
 * Parses raw location string into a structured location object.
 * @param locationStr - Raw location string from scraping
 * @param defaultCoords - Default coordinates from source config
 * @returns StructuredLocation object with null for missing data
 */
export function parseLocation(
  locationStr: string | null | undefined,
  defaultCoords?: { lat: number; lng: number }
): StructuredLocation {
  const name = normalizeWhitespace(locationStr || "");

  const result: StructuredLocation = {
    // Use null instead of "Unknown location" - let frontend handle display
    name: name || null,
  };

  if (defaultCoords) {
    result.coordinates = {
      lat: defaultCoords.lat,
      lng: defaultCoords.lng,
    };
  }

  return result;
}

export function mapToInternalCategory(input?: string): InternalCategory {
  const value = (input || "").toLowerCase();

  // Use the modern category classification system
  const category = classifyTextToCategory(value);

  // Validate that the result is one of our internal categories
  if (INTERNAL_CATEGORIES.includes(category as InternalCategory)) {
    return category as InternalCategory;
  }

  // Log unexpected category results for debugging
  console.warn(`classifyTextToCategory returned unexpected value: "${category}" for input: "${input?.slice(0, MAX_LOG_INPUT_LENGTH)}". Using fallback "community"`);

  // Default fallback to community (most general category)
  return "community";
}

function isTargetYear(isoDate: string | null): boolean {
  return !!isoDate && isoDate.startsWith(`${TARGET_YEAR}-`);
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createEventFingerprint(title: string, eventDate: string, sourceId: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}|${sourceId}`);
}

function extractTimeFromHtml(html: string): string | null {
  const timePatterns = [
    /(\d{1,2})[.:h](\d{2})\s*(am|pm)?/i,
    /(\d{1,2})\s*uhr/i,
  ];
  for (const pattern of timePatterns) {
    const match = html.match(pattern);
    if (match) {
      return normalizeMatchedTime(match[1], match[2], match[3]);
    }
  }
  return null;
}

export async function fetchEventDetailTime(
  detailUrl: string,
  baseUrl: string,
  fetcher?: PageFetcher
): Promise<string | null> {
  try {
    let fullUrl = detailUrl;
    if (detailUrl.startsWith("/")) {
      const urlObj = new URL(baseUrl);
      fullUrl = `${urlObj.protocol}//${urlObj.host}${detailUrl}`;
    } else if (!detailUrl.startsWith("http")) {
      fullUrl = `${baseUrl.replace(/\/$/, "")}/${detailUrl}`;
    }

    // Use provided fetcher or create a default StaticPageFetcher
    const pageFetcher = fetcher || new StaticPageFetcher();
    const { html, statusCode } = await pageFetcher.fetchPage(fullUrl);

    if (statusCode < 200 || statusCode >= 400) return null;

    const $ = cheerio.load(html);
    const pageText = $("body").text();

    const timeElements = [
      ".event-time",
      ".time",
      '[class*="time"]',
      '[class*="tijd"]',
      ".aanvang",
      '[class*="aanvang"]',
    ];

    for (const selector of timeElements) {
      const el = $(selector);
      if (el.length > 0) {
        const elText = el.text() || el.attr("content") || "";
        const normalized = extractTimeFromHtml(elText);
        if (normalized) return normalized;
      }
    }

    return extractTimeFromHtml(pageText);
  } catch {
    return null;
  }
}

interface NormalizedEvent {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  image_url: string | null;
  venue_name: string;
  venue_address?: string;
  internal_category: InternalCategory;
  detail_url?: string | null;
  structured_date?: StructuredDate;
  structured_location?: StructuredLocation;
  organizer?: string;
}

function cheapNormalizeEvent(raw: RawEventCard, source: ScraperSource): NormalizedEvent | null {
  if (!raw.title) return null;
  const isoDate = parseToISODate(raw.date);
  if (!isoDate || !isTargetYear(isoDate)) return null;

  const time =
    raw.detailPageTime ||
    extractTimeFromHtml(raw.rawHtml) ||
    extractTimeFromHtml(raw.description) ||
    "TBD";

  const description =
    normalizeWhitespace(raw.description || "") ||
    normalizeWhitespace(cheerio.load(raw.rawHtml || "").text()).slice(0, 240);

  // Build structured date
  const structuredDate = parseDate(
    raw.date,
    time,
    source.config.language === "nl" ? "Europe/Amsterdam" : "Europe/Amsterdam"
  );

  // Build structured location
  const defaultCoords = source.default_coordinates || source.config.default_coordinates;
  const structuredLocation = parseLocation(raw.location, defaultCoords);

  return {
    title: normalizeWhitespace(raw.title),
    description,
    event_date: isoDate,
    event_time: time || "TBD",
    image_url: raw.imageUrl,
    venue_name: raw.location || source.name,
    internal_category: mapToInternalCategory(raw.categoryHint || raw.description || raw.title),
    detail_url: raw.detailUrl,
    structured_date: structuredDate || undefined,
    structured_location: structuredLocation,
  };
}

// Exponential backoff with jitter for retries
async function exponentialBackoff(attempt: number, baseMs: number = 1000): Promise<void> {
  const delay = Math.min(baseMs * Math.pow(2, attempt), 30000); // cap at 30s
  const jitter = delay * 0.2 * Math.random(); // 20% jitter
  console.log(`Backoff: waiting ${Math.round(delay + jitter)}ms before retry ${attempt + 1}`);
  await new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

async function callGemini(
  apiKey: string,
  body: unknown,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Add jittered delay before each request (except first if it's after a backoff)
    if (attempt === 0) {
      await jitteredDelay(100, 200); // 100-300ms jitter before first call
    }

    // Note: Use raw fetch for Gemini API calls instead of PageFetcher.
    // PageFetcher is designed for scraping web pages with browser-like behavior
    // (user-agent spoofing, redirect handling). API endpoints expect direct HTTP requests.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    const text = await response.text();

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      console.warn(`Gemini 429 rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
      if (attempt < maxRetries) {
        await exponentialBackoff(attempt);
        continue; // retry
      }
    }

    console.error("Gemini error", response.status, text);

    // Don't retry on non-429 errors
    if (response.status !== 429) {
      return null;
    }
  }

  console.error("Gemini: max retries exceeded");
  return null;
}

export async function parseEventWithAI(
  apiKey: string,
  rawEvent: RawEventCard,
  language: string = "nl",
  options: { fetcher?: PageFetcher; callGeminiFn?: typeof callGemini } = {}
): Promise<NormalizedEvent | null> {
  // Note: fetcher parameter is kept in options for potential future use (e.g., fetching 
  // additional event details from URLs within rawHtml) and for test mocking consistency.
  // Currently unused as Gemini API calls use raw fetch (see callGemini).
  const callFn = options.callGeminiFn || callGemini;

  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = `Je bent een datacleaner. Haal evenementen-informatie uit ruwe HTML.
- Retourneer uitsluitend geldige JSON.
- Weiger evenementen die niet in 2026 plaatsvinden.
- Houd tekst in originele taal (${language}).
- velden: title, description (max 200 chars), event_date (YYYY-MM-DD), event_time (HH:MM), venue_name, venue_address, image_url`;

  const userPrompt = `Vandaag is ${today}.
Bron hint titel: ${rawEvent.title}
Bron hint datum: ${rawEvent.date}
Bron hint locatie: ${rawEvent.location}
HTML:
${rawEvent.rawHtml}`;

  const payload = {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 768 },
  };

  const text = await callFn(apiKey, payload);
  if (!text) return null;

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

  let parsed: Partial<NormalizedEvent>;
  try {
    parsed = JSON.parse(cleaned) as Partial<NormalizedEvent>;
  } catch (e) {
    console.warn("Failed to parse AI response as JSON:", e);
    return null;
  }

  if (!parsed || !parsed.title || !parsed.event_date) return null;
  const isoDate = parseToISODate(parsed.event_date);
  if (!isoDate || !isTargetYear(isoDate)) return null;

  // Build structured date from AI-parsed data
  const structuredDate = parseDate(
    isoDate,
    parsed.event_time,
    language === "nl" ? "Europe/Amsterdam" : "Europe/Amsterdam"
  );

  // Build structured location from AI-parsed data
  const structuredLocation = parseLocation(parsed.venue_name || rawEvent.location);

  return {
    title: normalizeWhitespace(parsed.title),
    description: parsed.description ? normalizeWhitespace(parsed.description) : "",
    event_date: isoDate,
    event_time: parsed.event_time || "TBD",
    venue_name: parsed.venue_name || rawEvent.location || "",
    venue_address: parsed.venue_address,
    image_url: rawEvent.imageUrl ?? parsed.image_url ?? null,
    internal_category: mapToInternalCategory(
      (parsed as Record<string, unknown>).category as string ||
      parsed.description ||
      rawEvent.title,
    ),
    detail_url: rawEvent.detailUrl,
    structured_date: structuredDate || undefined,
    structured_location: structuredLocation,
  };
}

// deno-lint-ignore no-explicit-any
async function upsertProbeLog(supabase: any, sourceId: string, probes: Array<Record<string, unknown>>) {
  try {
    await supabase.from("scraper_sources").update({ last_probe_urls: probes }).eq("id", sourceId);
  } catch (error) {
    console.warn("Failed to persist probe log", error);
  }
}

// deno-lint-ignore no-explicit-any
async function fingerprintExists(
  supabase: any,
  sourceId: string,
  fingerprint: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("source_id", sourceId)
    .eq("event_fingerprint", fingerprint)
    .limit(1);
  if (error) {
    console.warn("Fingerprint lookup failed", error.message);
    return false;
  }
  return (data && data.length > 0) || false;
}

export async function eventExists(
  supabase: any,
  title: string,
  eventDate: string,
  eventTime: string,
  _normalized?: { timestamp: string; dateOnly: string | null },
  sourceId?: string
): Promise<boolean> {
  const fingerprint = await createEventFingerprint(title, eventDate, sourceId || "unknown");
  return fingerprintExists(supabase, sourceId || "unknown", fingerprint);
}

export interface ScrapeEventCardOptions {
  fetcher?: PageFetcher;
  listingHtml?: string;
  listingUrl?: string;
  enableDebug?: boolean;
}

export async function scrapeEventCards(
  source: ScraperSource,
  enableDeepScraping: boolean = true,
  options: ScrapeEventCardOptions = {}
): Promise<RawEventCard[]> {
  const strategy = resolveStrategy((source as { strategy?: string }).strategy, source);
  const fetcher = options.fetcher || createFetcherForSource(source);

  // Use effective rate limit (may be dynamically increased)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const rateLimit = supabaseUrl && supabaseKey
    ? await getEffectiveRateLimit(supabaseUrl, supabaseKey, source.id)
    : source.config.rate_limit_ms ?? 150;

  let listingHtml = options.listingHtml;
  let listingUrl = options.listingUrl || source.url;

  if (!listingHtml) {
    const candidates = await strategy.discoverListingUrls(fetcher);
    for (const candidate of candidates) {
      const resp = await strategy.fetchListing(candidate, fetcher);

      // Handle rate limiting responses
      if (isRateLimited(resp.status) && supabaseUrl && supabaseKey) {
        // Parse rate-limit headers from the response
        const rateLimitInfo = parseRateLimitHeaders(resp.headers);

        await increaseRateLimit(
          supabaseUrl,
          supabaseKey,
          source.id,
          resp.status,
          rateLimitInfo.retryAfterSeconds,
          rateLimitInfo.remaining,
          rateLimitInfo.resetTs
        );
        console.warn(`Rate limited (${resp.status}) for ${source.name}, backing off`);
      }

      if (resp.status === 404 || !resp.html) continue;
      listingHtml = resp.html;
      listingUrl = resp.finalUrl || candidate;
      break;
    }
  }

  if (!listingHtml) return [];

  const rawEvents = await strategy.parseListing(listingHtml, listingUrl, { enableDebug: options.enableDebug, fetcher });

  if (enableDeepScraping) {
    for (const raw of rawEvents) {
      if (!raw.detailUrl || raw.detailPageTime) continue;
      const time = await fetchEventDetailTime(raw.detailUrl, listingUrl, fetcher);
      if (time) raw.detailPageTime = time;
      // Use jittered delay (±20%) to avoid fingerprinting
      await jitteredDelay(rateLimit, 20);
    }
  }

  return rawEvents;
}

/**
 * Validates that a category value is allowed by the database constraint.
 * Database constraint allows: active, gaming, entertainment, social, family, 
 * outdoors, music, workshops, foodie, community
 */
function ensureValidCategory(category: unknown): InternalCategory {
  // Type guard: ensure we're working with a string
  if (typeof category !== 'string') {
    console.warn(`Category is not a string (type: ${typeof category}, value: ${JSON.stringify(category)}). Falling back to "community"`);
    return "community";
  }

  const normalized = category.toLowerCase().trim();

  // Validate against the allowed categories
  if (INTERNAL_CATEGORIES.includes(normalized as InternalCategory)) {
    return normalized as InternalCategory;
  }

  // Log invalid category attempts for debugging
  console.warn(`Invalid category detected: "${category}". Falling back to "community"`);
  return "community";
}

// deno-lint-ignore no-explicit-any
async function insertEvent(
  supabase: any,
  event: Record<string, unknown>
): Promise<boolean> {
  // Final defensive validation: ensure category is valid before insert
  if (event.category !== undefined) {
    event.category = ensureValidCategory(event.category);
  } else {
    console.warn("Event missing category field, defaulting to community");
    event.category = "community";
  }

  const { error } = await supabase.from("events").insert(event);
  if (error) {
    // Enhanced error logging for constraint violations
    if (error.code === '23514') {
      console.error("CHECK CONSTRAINT VIOLATION:", {
        error_message: error.message,
        error_code: error.code,
        event_title: event.title,
        attempted_category: event.category,
        valid_categories: INTERNAL_CATEGORIES,
        hint: "Category value does not match database constraint"
      });
    } else {
      console.error("Insert failed", {
        error_message: error.message,
        error_code: error.code,
        event_title: event.title
      });
    }
    return false;
  }
  return true;
}

// deno-lint-ignore no-explicit-any
async function updateSourceStats(
  supabase: any,
  sourceId: string,
  scraped: number,
  success: boolean
) {
  try {
    await supabase.rpc("update_scraper_source_stats", {
      p_source_id: sourceId,
      p_events_scraped: scraped,
      p_success: success,
    });
  } catch (error) {
    console.warn("update_scraper_source_stats failed", error);
  }
}

/**
 * Self-healing fetcher logic: Check if source needs fetcher_type change
 * If a source returns 0 events for 3 consecutive runs with HTTP 200 OK,
 * automatically switch to a more capable fetcher type.
 */
// deno-lint-ignore no-explicit-any
async function checkAndHealFetcher(
  supabase: any,
  sourceId: string,
  eventsFound: number,
  httpStatus: number
): Promise<{ healed: boolean; newFetcher?: string }> {
  try {
    const { data, error } = await supabase.rpc("check_and_heal_fetcher", {
      p_source_id: sourceId,
      p_events_found: eventsFound,
      p_http_status: httpStatus,
    });

    if (error) {
      console.warn("check_and_heal_fetcher failed:", error.message);
      return { healed: false };
    }

    if (data?.healed) {
      console.log(
        `Self-healing: Switched ${data.source_name} from ${data.old_fetcher} to ${data.new_fetcher}`
      );
    }

    return {
      healed: data?.healed || false,
      newFetcher: data?.new_fetcher,
    };
  } catch (error) {
    console.warn("checkAndHealFetcher error:", error);
    return { healed: false };
  }
}

export interface ScrapeOptions {
  sourceId?: string;
  dryRun?: boolean;
  enableDeepScraping?: boolean;
  limit?: number;
  enableDebug?: boolean;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let options: ScrapeOptions & { action?: string } = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        options = body ? JSON.parse(body) : {};
      } catch {
        options = {};
      }
    }

    // Handle integrity test action
    if (options.action === "run-integrity-test") {
      const { runScraperIntegrityTest } = await import("./testLogic.ts");
      const report = await runScraperIntegrityTest();
      return new Response(JSON.stringify(report), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sourceId, dryRun = false, enableDeepScraping = true, limit, enableDebug = false } = options;

    let query = supabase.from("scraper_sources").select("*").eq("enabled", true);
    if (sourceId) query = query.eq("id", sourceId);
    if (limit) query = query.limit(limit);

    const { data: sources, error: sourcesError } = await query;
    if (sourcesError) throw new Error(sourcesError.message);
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No enabled sources" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stats = {
      totalSources: sources.length,
      totalEventsScraped: 0,
      totalEventsInserted: 0,
      totalEventsDuplicate: 0,
      totalEventsFailed: 0,
      sourceResults: [] as Array<Record<string, unknown>>,
    };

    for (const source of sources as ScraperSource[]) {
      const strategy = resolveStrategy((source as { strategy?: string }).strategy, source);
      const fetcher = createFetcherForSource(source);
      const probeLog: Array<{ candidate: string; status: number; finalUrl: string; ok: boolean }> = [];

      // Get effective rate limit (may be dynamically adjusted)
      const rateLimit = await getEffectiveRateLimit(supabaseUrl, supabaseKey, source.id);
      const sourceStats = { name: source.name, scraped: 0, inserted: 0, duplicates: 0, failed: 0 };
      let lastHttpStatus = 0; // Track HTTP status for self-healing

      try {
        const candidates = await strategy.discoverListingUrls(fetcher);
        let listingHtml = "";
        let listingUrl = source.url;

        for (const candidate of candidates) {
          const resp = await strategy.fetchListing(candidate, fetcher);
          lastHttpStatus = resp.status; // Track last HTTP status
          probeLog.push({ candidate, status: resp.status, finalUrl: resp.finalUrl, ok: resp.status >= 200 && resp.status < 400 });

          // Handle rate limiting responses
          if (isRateLimited(resp.status)) {
            // Parse rate-limit headers from the response
            const rateLimitInfo = parseRateLimitHeaders(resp.headers);

            await increaseRateLimit(
              supabaseUrl,
              supabaseKey,
              source.id,
              resp.status,
              rateLimitInfo.retryAfterSeconds,
              rateLimitInfo.remaining,
              rateLimitInfo.resetTs
            );
            console.warn(`Rate limited (${resp.status}) for ${source.name}, backing off`);

            // Log the failure
            await logScraperFailure(supabaseUrl, supabaseKey, {
              source_id: source.id,
              url: candidate,
              error_type: 'rate_limited',
              error_message: `Received ${resp.status} response`,
              status_code: resp.status,
            });
          }

          if (resp.status === 404 || !resp.html) continue;
          listingHtml = resp.html;
          listingUrl = resp.finalUrl || candidate;
          break;
        }

        if (!listingHtml) {
          await upsertProbeLog(supabase, source.id, probeLog);
          await updateSourceStats(supabase, source.id, 0, false);
          stats.totalEventsFailed++;
          continue;
        }

        const rawEvents = await strategy.parseListing(listingHtml, listingUrl, { enableDebug, fetcher });
        sourceStats.scraped = rawEvents.length;
        stats.totalEventsScraped += rawEvents.length;

        // Check for anomaly: 0 events when we expected more (broken selectors)
        if (rawEvents.length === 0) {
          const historicalCount = await getHistoricalEventCount(supabaseUrl, supabaseKey, source.id);
          if (historicalCount > 0) {
            // Log potential broken selector
            await logScraperFailure(supabaseUrl, supabaseKey, {
              source_id: source.id,
              url: listingUrl,
              error_type: 'no_events_found',
              error_message: `Expected ~${historicalCount} events based on history, found 0`,
              raw_html: listingHtml.slice(0, 50000), // Store first 50KB for debugging
              selector_context: { selectors: source.config.selectors || SELECTORS },
              events_expected: historicalCount,
              events_found: 0,
            });
          }
        }

        if (enableDeepScraping) {
          for (const raw of rawEvents) {
            if (!raw.detailUrl || raw.detailPageTime) continue;
            const time = await fetchEventDetailTime(raw.detailUrl, listingUrl, fetcher);
            if (time) raw.detailPageTime = time;
            // Use jittered delay (±20%) to avoid fingerprinting
            await jitteredDelay(rateLimit, 20);
          }
        }

        for (const raw of rawEvents) {
          let normalized = cheapNormalizeEvent(raw, source);
          if ((!normalized || normalized.event_time === "TBD" || !normalized.description) && geminiApiKey) {
            const aiResult = await parseEventWithAI(geminiApiKey, raw, source.language || "nl", { fetcher });
            if (aiResult) normalized = aiResult;
          }

          if (!normalized) {
            sourceStats.failed++;
            continue;
          }

          const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, source.id);
          const exists = await fingerprintExists(supabase, source.id, fingerprint);
          if (exists) {
            sourceStats.duplicates++;
            stats.totalEventsDuplicate++;
            continue;
          }

          const normalizedDate = normalizeEventDateForStorage(
            normalized.event_date,
            normalized.event_time === "TBD" ? "12:00" : normalized.event_time,
          );
          const defaultCoords = source.default_coordinates || source.config.default_coordinates;
          const { point, isFallback } = toPostgisPoint(defaultCoords);
          const sanitizedTitle = toTitleCase(normalized.title);
          const sanitizedDescription = stripHtml(normalized.description || "");

          // Log warning if coordinates are missing or fallback
          if (isFallback) {
            console.warn(`No coordinates found for source: ${source.name} (${source.id}). Using fallback POINT(0 0)`);
          }

          const eventInsert = {
            title: sanitizedTitle,
            description: sanitizedDescription,
            category: normalized.internal_category,
            event_type: DEFAULT_EVENT_TYPE,
            venue_name: normalized.venue_name || source.name,
            location: point,
            event_date: normalizedDate.timestamp,
            event_time: normalized.event_time,
            image_url: normalized.image_url,
            created_by: null,
            status: "published",
            source_id: source.id,
            event_fingerprint: fingerprint,
            // Time mode: default to 'fixed' for now, will be enhanced later
            time_mode: 'fixed',
            opening_hours: null,
            // New structured fields
            structured_date: normalized.structured_date || null,
            structured_location: normalized.structured_location
              ? {
                ...normalized.structured_location,
                coordinates: normalized.structured_location.coordinates || (!isFallback ? defaultCoords : undefined),
              }
              : (!isFallback && defaultCoords
                ? { name: normalized.venue_name || source.name, coordinates: defaultCoords }
                : null),
            organizer: normalized.organizer || null,
          };

          if (!dryRun) {
            const inserted = await insertEvent(supabase, eventInsert);
            if (inserted) {
              sourceStats.inserted++;
              stats.totalEventsInserted++;
            } else {
              sourceStats.failed++;
              stats.totalEventsFailed++;
            }
          } else {
            // In dry-run we still count as would-be insert to surface potential duplicates/stats.
            sourceStats.inserted++;
            stats.totalEventsInserted++;
          }

          // Use jittered delay (±20%) to avoid fingerprinting
          await jitteredDelay(rateLimit, 20);
        }

        await upsertProbeLog(supabase, source.id, probeLog);
        await updateSourceStats(supabase, source.id, sourceStats.scraped, sourceStats.scraped > 0);

        // Self-healing: Check if fetcher_type needs to be upgraded
        // Only if we got HTTP 200 OK but 0 events
        if (lastHttpStatus === 200 && sourceStats.scraped === 0) {
          await checkAndHealFetcher(supabase, source.id, sourceStats.scraped, lastHttpStatus);
        }
      } catch (error) {
        console.error(`Error processing ${source.name}`, error);
        await updateSourceStats(supabase, source.id, sourceStats.scraped, false);
      }

      stats.sourceResults.push(sourceStats);
    }

    // Send Slack notification if webhook URL is configured
    if (!dryRun) {
      const message = `🎉 Scraper Complete\n` +
        `Sources: ${stats.totalSources}\n` +
        `Scraped: ${stats.totalEventsScraped} | Inserted: ${stats.totalEventsInserted}\n` +
        `Duplicates: ${stats.totalEventsDuplicate} | Failed: ${stats.totalEventsFailed}`;
      await sendSlackNotification(message, false);
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scraper error", error);

    // Send Slack notification for errors
    const errorMessage = `❌ Scraper Error\n${error instanceof Error ? error.message : "Unknown error"}`;
    await sendSlackNotification(errorMessage, true);

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

export { parseToISODate } from "../_shared/dateUtils.ts";
export type { ScraperSource, FetcherType } from "./shared.ts";
export type { PageFetcher, RetryConfig } from "../_shared/strategies.ts";
export { StaticPageFetcher, DynamicPageFetcher, createFetcherForSource } from "../_shared/strategies.ts";

// ============================================================================
// AGGREGATOR PATTERN - STRATEGY ORCHESTRATION
// ============================================================================

// Import strategy configurations
import {
  ALL_STRATEGIES,
  getEnabledStrategies,
  shouldRunNow,
} from "./config.ts";

// Import strategy implementations
import { createSportsStrategy } from "./strategies/sports.ts";
import { createMusicStrategy } from "./strategies/music.ts";
import { createNightlifeStrategy } from "./strategies/nightlife.ts";
import { createCultureStrategy } from "./strategies/culture.ts";
import { createDiningStrategy } from "./strategies/dining.ts";
import type { BaseScraperStrategy, ScraperRunResult } from "./strategies/base.ts";

/**
 * Factory map for creating strategy instances
 */
const STRATEGY_FACTORIES: Record<string, (supabase: SupabaseClient, config: typeof ALL_STRATEGIES.sports.config) => BaseScraperStrategy> = {
  sports: (supabase, config) => createSportsStrategy(supabase, config),
  music: (supabase, config) => createMusicStrategy(supabase, config),
  nightlife: (supabase, config) => createNightlifeStrategy(supabase, config),
  culture: (supabase, config) => createCultureStrategy(supabase, config),
  dining: (supabase, config) => createDiningStrategy(supabase, config),
};

/**
 * Run a specific strategy by name
 */
async function runStrategy(
  supabase: SupabaseClient,
  strategyName: string
): Promise<ScraperRunResult | null> {
  const strategyConfig = ALL_STRATEGIES[strategyName as keyof typeof ALL_STRATEGIES];
  if (!strategyConfig) {
    console.error(`Unknown strategy: ${strategyName}`);
    return null;
  }

  const factory = STRATEGY_FACTORIES[strategyName];
  if (!factory) {
    console.error(`No factory for strategy: ${strategyName}`);
    return null;
  }

  const strategy = factory(supabase, strategyConfig.config);
  return await strategy.run();
}

/**
 * Run all scheduled scrapers based on their cron schedules
 */
async function runScheduledScrapers(supabase: SupabaseClient): Promise<Record<string, ScraperRunResult>> {
  const results: Record<string, ScraperRunResult> = {};
  const now = new Date();

  for (const strategyName of getEnabledStrategies()) {
    const strategyConfig = ALL_STRATEGIES[strategyName as keyof typeof ALL_STRATEGIES];

    // Check if this strategy should run based on its cron schedule
    if (shouldRunNow(strategyConfig.config.schedule, now)) {
      console.log(`[scheduler] Running ${strategyName} (schedule: ${strategyConfig.config.schedule})`);
      const result = await runStrategy(supabase, strategyName);
      if (result) {
        results[strategyName] = result;
      }
    } else {
      console.log(`[scheduler] Skipping ${strategyName} (not scheduled for now)`);
    }
  }

  return results;
}

/**
 * Run all enabled scrapers regardless of schedule
 */
async function runAllScrapers(supabase: SupabaseClient): Promise<Record<string, ScraperRunResult>> {
  const results: Record<string, ScraperRunResult> = {};

  for (const strategyName of getEnabledStrategies()) {
    console.log(`[orchestrator] Running ${strategyName}...`);
    const result = await runStrategy(supabase, strategyName);
    if (result) {
      results[strategyName] = result;
    }
  }

  return results;
}

/**
 * Handle strategy-based scraping requests
 * This is the new entry point for the aggregator pattern
 */
export async function handleStrategyRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let body: { strategy?: string; mode?: "scheduled" | "all" | "single" } = {};
    if (req.method === "POST") {
      try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    const { strategy, mode = "scheduled" } = body;

    let results: Record<string, ScraperRunResult>;

    if (mode === "single" && strategy) {
      // Run a specific strategy (manual trigger)
      console.log(`[handler] Manual trigger for strategy: ${strategy}`);
      const result = await runStrategy(supabase, strategy);
      results = result ? { [strategy]: result } : {};
    } else if (mode === "all") {
      // Run all enabled strategies
      console.log("[handler] Running all enabled strategies");
      results = await runAllScrapers(supabase);
    } else {
      // Run scheduled strategies
      console.log("[handler] Running scheduled strategies");
      results = await runScheduledScrapers(supabase);
    }

    // Calculate totals
    const totals = {
      strategies: Object.keys(results).length,
      success: 0,
      failed: 0,
      skipped: 0,
    };

    for (const result of Object.values(results)) {
      totals.success += result.success;
      totals.failed += result.failed;
      totals.skipped += result.skipped;
    }

    // Send Slack notification
    const message = `🎯 Strategy Scraper Complete\n` +
      `Strategies: ${totals.strategies}\n` +
      `Success: ${totals.success} | Failed: ${totals.failed} | Skipped: ${totals.skipped}`;
    await sendSlackNotification(message, false);

    return new Response(
      JSON.stringify({ success: true, results, totals }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Strategy scraper error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await sendSlackNotification(`❌ Strategy Scraper Error\n${errorMessage}`, true);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Export strategy types and factories for testing
export {
  ALL_STRATEGIES,
  getEnabledStrategies,
  STRATEGY_FACTORIES,
  runStrategy,
  runScheduledScrapers,
  runAllScrapers,
};

if (import.meta.main) {
  serve(handleRequest);
}
