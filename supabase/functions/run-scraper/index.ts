import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../_shared/dateUtils.ts";
import type { ScraperSource, RawEventCard } from "../_shared/types.ts";
import { createSpoofedFetch, resolveStrategy } from "../_shared/strategies.ts";
import { sendSlackNotification, createScraperBlockNotification } from "../_shared/slack.ts";
import { classifyTextToCategory } from "../_shared/categoryMapping.ts";

/**
 * Run Scraper Edge Function
 *
 * This function replaces the Node.js CLI scraper (src/cli.ts) with a Deno-based
 * Supabase Edge Function. It provides a unified HTTP endpoint to trigger web
 * scraping operations.
 *
 * Usage:
 * POST /functions/v1/run-scraper
 * Body: {
 *   "sourceId": "optional-uuid",  // Scrape specific source
 *   "dryRun": false,              // If true, don't write to database
 *   "enableDeepScraping": true,   // Fetch detail pages for time extraction
 *   "limit": 10                   // Max sources to process
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Scraping completed successfully",
 *   "runId": "run_2026-01-13T20-10-05",
 *   "stats": { ... }
 * }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal categories used by the product - aligned with modern UI categories
const INTERNAL_CATEGORIES = ["active", "gaming", "entertainment", "social", "family", "outdoors", "music", "workshops", "foodie", "community"] as const;
type InternalCategory = (typeof INTERNAL_CATEGORIES)[number];

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

const DEFAULT_EVENT_TYPE = "anchor";

// Gemini API request payload interface
interface GeminiRequestPayload {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
  };
}

// ============ Helper Functions ============

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function constructEventDateTime(eventDate: string, eventTime: string): string {
  const timeMatch = eventTime.match(/^(\d{2}):(\d{2})$/);
  const hours = timeMatch ? timeMatch[1] : "12";
  const minutes = timeMatch ? timeMatch[2] : "00";
  const [year, month, day] = eventDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, Number(hours), Number(minutes), 0));
  return date.toISOString();
}

function normalizeEventDateForStorage(
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

function mapToInternalCategory(input?: string): InternalCategory {
  const value = (input || "").toLowerCase();
  
  // Use the modern category classification system
  const category = classifyTextToCategory(value);
  
  // Validate that the result is one of our internal categories
  if (INTERNAL_CATEGORIES.includes(category as InternalCategory)) {
    return category as InternalCategory;
  }
  
  // Default fallback to community (most general category)
  return "community";
}

function isTargetYear(isoDate: string | null): boolean {
  const targetYear = getTargetYear();
  return !!isoDate && isoDate.startsWith(`${targetYear}-`);
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createEventFingerprint(title: string, eventDate: string, sourceId: string): Promise<string> {
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

async function fetchEventDetailTime(
  detailUrl: string,
  baseUrl: string,
  fetcher: typeof fetch
): Promise<string | null> {
  try {
    let fullUrl = detailUrl;
    if (detailUrl.startsWith("/")) {
      const urlObj = new URL(baseUrl);
      fullUrl = `${urlObj.protocol}//${urlObj.host}${detailUrl}`;
    } else if (!detailUrl.startsWith("http")) {
      fullUrl = `${baseUrl.replace(/\/$/, "")}/${detailUrl}`;
    }

    const response = await fetcher(fullUrl, { method: "GET" });
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    const pageText = $("body").text();

    const timeElements = [".event-time", ".time", '[class*="time"]', '[class*="tijd"]', ".aanvang", '[class*="aanvang"]'];

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
}

function cheapNormalizeEvent(raw: RawEventCard, source: ScraperSource): NormalizedEvent | null {
  if (!raw.title) return null;
  const isoDate = parseToISODate(raw.date);
  if (!isoDate || !isTargetYear(isoDate)) return null;

  const time = raw.detailPageTime || extractTimeFromHtml(raw.rawHtml) || extractTimeFromHtml(raw.description) || "TBD";
  const description = normalizeWhitespace(raw.description || "") || normalizeWhitespace(cheerio.load(raw.rawHtml || "").text()).slice(0, 240);

  return {
    title: normalizeWhitespace(raw.title),
    description,
    event_date: isoDate,
    event_time: time || "TBD",
    image_url: raw.imageUrl,
    venue_name: raw.location || source.name,
    internal_category: mapToInternalCategory(raw.categoryHint || raw.description || raw.title),
    detail_url: raw.detailUrl,
  };
}

// Jittered delay helper
function jitteredDelay(baseMs: number = 100, jitterMs: number = 200): Promise<void> {
  const delay = baseMs + Math.random() * jitterMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Exponential backoff with jitter for retries
async function exponentialBackoff(attempt: number, baseMs: number = 1000): Promise<void> {
  const delay = Math.min(baseMs * Math.pow(2, attempt), 30000);
  const jitter = delay * 0.2 * Math.random();
  console.log(`Backoff: waiting ${Math.round(delay + jitter)}ms before retry ${attempt + 1}`);
  await new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

async function callGemini(
  apiKey: string,
  payload: GeminiRequestPayload,
  fetcher: typeof fetch,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt === 0) {
      await jitteredDelay(100, 200);
    }

    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }

    const text = await response.text();

    if (response.status === 429) {
      console.warn(`Gemini 429 rate limit hit (attempt ${attempt + 1}/${maxRetries + 1})`);
      if (attempt < maxRetries) {
        await exponentialBackoff(attempt);
        continue;
      }
    }

    console.error("Gemini error", response.status, text);

    if (response.status !== 429) {
      return null;
    }
  }

  console.error("Gemini: max retries exceeded");
  return null;
}

async function parseEventWithAI(
  apiKey: string,
  rawEvent: RawEventCard,
  language: string = "nl",
  fetcher: typeof fetch
): Promise<NormalizedEvent | null> {
  const today = new Date().toISOString().split("T")[0];
  const targetYear = getTargetYear();
  const systemPrompt = `Je bent een datacleaner. Haal evenementen-informatie uit ruwe HTML.
- Retourneer uitsluitend geldige JSON.
- Weiger evenementen die niet in ${targetYear} plaatsvinden.
- Houd tekst in originele taal (${language}).
- velden: title, description (max 200 chars), event_date (YYYY-MM-DD), event_time (HH:MM), venue_name, venue_address, image_url`;

  const userPrompt = `Vandaag is ${today}.
Bron hint titel: ${rawEvent.title}
Bron hint datum: ${rawEvent.date}
Bron hint locatie: ${rawEvent.location}
HTML:
${rawEvent.rawHtml}`;

  const payload: GeminiRequestPayload = {
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 768 },
  };

  const text = await callGemini(apiKey, payload, fetcher);
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

  return {
    title: normalizeWhitespace(parsed.title),
    description: parsed.description ? normalizeWhitespace(parsed.description) : "",
    event_date: isoDate,
    event_time: parsed.event_time || "TBD",
    venue_name: parsed.venue_name || rawEvent.location || "",
    venue_address: parsed.venue_address,
    image_url: rawEvent.imageUrl ?? parsed.image_url ?? null,
    internal_category: mapToInternalCategory(
      (parsed as Record<string, unknown>).category as string || parsed.description || rawEvent.title
    ),
    detail_url: rawEvent.detailUrl,
  };
}

async function fingerprintExists(supabase: SupabaseClient, sourceId: string, fingerprint: string): Promise<boolean> {
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

async function insertEvent(supabase: SupabaseClient, event: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("events").insert(event);
  if (error) {
    console.error("Insert failed", error.message);
    return false;
  }
  return true;
}

async function updateSourceStats(supabase: SupabaseClient, sourceId: string, scraped: number, success: boolean) {
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

// ============ Main Scraper Logic ============

function generateRunId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").substring(0, 19);
  return `run_${timestamp}`;
}

interface ScrapeOptions {
  sourceId?: string;
  dryRun?: boolean;
  enableDeepScraping?: boolean;
  limit?: number;
}

interface SourceStats {
  name: string;
  scraped: number;
  inserted: number;
  duplicates: number;
  failed: number;
}

async function processSingleSource(
  supabase: SupabaseClient,
  source: ScraperSource,
  geminiApiKey: string | undefined,
  enableDeepScraping: boolean,
  dryRun: boolean
): Promise<SourceStats> {
  const stats: SourceStats = { name: source.name, scraped: 0, inserted: 0, duplicates: 0, failed: 0 };

  const strategy = resolveStrategy((source as { strategy?: string }).strategy, source);
  const fetcher = createSpoofedFetch({ headers: source.config.headers });
  const rateLimit = source.config.rate_limit_ms ?? 200;

  // Discover and fetch listing
  const candidates = await strategy.discoverListingUrls(fetcher);
  let listingHtml = "";
  let listingUrl = source.url;

  for (const candidate of candidates) {
    const resp = await strategy.fetchListing(candidate, fetcher);
    if (resp.status === 404 || !resp.html) continue;
    listingHtml = resp.html;
    listingUrl = resp.finalUrl || candidate;
    break;
  }

  if (!listingHtml) {
    console.warn(`No valid listing found for source: ${source.name}`);
    return stats;
  }

  const rawEvents = await strategy.parseListing(listingHtml, listingUrl, { enableDebug: false, fetcher });
  stats.scraped = rawEvents.length;

  // Deep scraping for detail page times
  if (enableDeepScraping) {
    for (const raw of rawEvents) {
      if (!raw.detailUrl || raw.detailPageTime) continue;
      const time = await fetchEventDetailTime(raw.detailUrl, listingUrl, fetcher);
      if (time) raw.detailPageTime = time;
      await new Promise((resolve) => setTimeout(resolve, rateLimit));
    }
  }

  // Process each event
  for (const raw of rawEvents) {
    let normalized = cheapNormalizeEvent(raw, source);

    // Use AI if needed
    if ((!normalized || normalized.event_time === "TBD" || !normalized.description) && geminiApiKey) {
      const aiResult = await parseEventWithAI(geminiApiKey, raw, source.language || "nl", fetcher);
      if (aiResult) normalized = aiResult;
    }

    if (!normalized) {
      stats.failed++;
      continue;
    }

    const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, source.id);
    const exists = await fingerprintExists(supabase, source.id, fingerprint);
    if (exists) {
      stats.duplicates++;
      continue;
    }

    const normalizedDate = normalizeEventDateForStorage(
      normalized.event_date,
      normalized.event_time === "TBD" ? "12:00" : normalized.event_time
    );
    const defaultCoords = source.default_coordinates || source.config.default_coordinates;
    const point = defaultCoords ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})` : "POINT(0 0)";
    
    // Log warning if coordinates are missing
    if (!defaultCoords) {
      console.warn(`No coordinates found for source: ${source.name} (${source.id}). Using fallback POINT(0 0)`);
    }

    const eventInsert = {
      title: normalized.title,
      description: normalized.description || "",
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
    };

    if (!dryRun) {
      const inserted = await insertEvent(supabase, eventInsert);
      if (inserted) {
        stats.inserted++;
      } else {
        stats.failed++;
      }
    } else {
      // In dry-run we still count as would-be insert
      stats.inserted++;
    }

    await new Promise((resolve) => setTimeout(resolve, rateLimit));
  }

  return stats;
}

async function runScraper(
  supabase: SupabaseClient,
  options: ScrapeOptions,
  geminiApiKey: string | undefined
): Promise<{
  totalSources: number;
  totalEventsScraped: number;
  totalEventsInserted: number;
  totalEventsDuplicate: number;
  totalEventsFailed: number;
  sourceResults: SourceStats[];
}> {
  const { sourceId, dryRun = false, enableDeepScraping = true, limit } = options;

  // Get enabled sources
  let query = supabase.from("scraper_sources").select("*").eq("enabled", true);
  if (sourceId) query = query.eq("id", sourceId);
  if (limit) query = query.limit(limit);

  const { data: sources, error: sourcesError } = await query;
  if (sourcesError) throw new Error(sourcesError.message);

  if (!sources || sources.length === 0) {
    return {
      totalSources: 0,
      totalEventsScraped: 0,
      totalEventsInserted: 0,
      totalEventsDuplicate: 0,
      totalEventsFailed: 0,
      sourceResults: [],
    };
  }

  const stats = {
    totalSources: sources.length,
    totalEventsScraped: 0,
    totalEventsInserted: 0,
    totalEventsDuplicate: 0,
    totalEventsFailed: 0,
    sourceResults: [] as SourceStats[],
  };

  for (const source of sources as ScraperSource[]) {
    console.log(`Processing source: ${source.name}`);

    try {
      const sourceStats = await processSingleSource(
        supabase,
        source,
        geminiApiKey,
        enableDeepScraping,
        dryRun
      );

      stats.totalEventsScraped += sourceStats.scraped;
      stats.totalEventsInserted += sourceStats.inserted;
      stats.totalEventsDuplicate += sourceStats.duplicates;
      stats.totalEventsFailed += sourceStats.failed;
      stats.sourceResults.push(sourceStats);

      if (!dryRun) {
        await updateSourceStats(supabase, source.id, sourceStats.scraped, sourceStats.scraped > 0);
      }
    } catch (error) {
      console.error(`Error processing ${source.name}:`, error);
      stats.totalEventsFailed++;
      stats.sourceResults.push({
        name: source.name,
        scraped: 0,
        inserted: 0,
        duplicates: 0,
        failed: 1,
      });
    }
  }

  return stats;
}

// Validate and sanitize scrape options
function validateScrapeOptions(input: unknown): ScrapeOptions {
  if (!input || typeof input !== "object") {
    return {};
  }

  const obj = input as Record<string, unknown>;
  const validated: ScrapeOptions = {};

  // Validate sourceId (should be a UUID string)
  if (typeof obj.sourceId === "string" && obj.sourceId.length > 0 && obj.sourceId.length <= 100) {
    validated.sourceId = obj.sourceId;
  }

  // Validate dryRun (should be a boolean)
  if (typeof obj.dryRun === "boolean") {
    validated.dryRun = obj.dryRun;
  }

  // Validate enableDeepScraping (should be a boolean)
  if (typeof obj.enableDeepScraping === "boolean") {
    validated.enableDeepScraping = obj.enableDeepScraping;
  }

  // Validate limit (should be a positive integer)
  if (typeof obj.limit === "number" && Number.isInteger(obj.limit) && obj.limit > 0 && obj.limit <= 1000) {
    validated.limit = obj.limit;
  }

  return validated;
}

// ============ HTTP Handler ============

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed. Use POST to invoke the scraper.",
      }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing Supabase environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse and validate request options
    let options: ScrapeOptions = {};
    try {
      const body = await req.text();
      if (body) {
        const parsed = JSON.parse(body);
        options = validateScrapeOptions(parsed);
      }
    } catch (parseError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runId = generateRunId();
    const { dryRun = false } = options;

    console.log(`🚀 Starting scraper run: ${runId}`);
    console.log(`   Dry run: ${dryRun ? "YES" : "NO"}`);
    if (options.sourceId) console.log(`   Source ID: ${options.sourceId}`);
    if (options.limit) console.log(`   Limit: ${options.limit}`);

    // Run the scraper
    const stats = await runScraper(supabase, options, geminiApiKey);

    console.log(`\n📊 Scraper run complete`);
    console.log(`   Total sources: ${stats.totalSources}`);
    console.log(`   Events scraped: ${stats.totalEventsScraped}`);
    console.log(`   Events inserted: ${stats.totalEventsInserted}`);
    console.log(`   Duplicates: ${stats.totalEventsDuplicate}`);
    console.log(`   Failed: ${stats.totalEventsFailed}`);

    // Send Slack notification if webhook URL is configured
    if (!dryRun) {
      const blockNotification = createScraperBlockNotification({
        eventsScraped: stats.totalEventsScraped,
        eventsInserted: stats.totalEventsInserted,
        eventsDuplicate: stats.totalEventsDuplicate,
        eventsFailed: stats.totalEventsFailed,
        totalSources: stats.totalSources,
      });
      await sendSlackNotification(blockNotification, false);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Scraping completed successfully",
        runId,
        dryRun,
        stats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scraper error:", error);
    
    // Send Slack notification for errors
    const errorMessage = `❌ Scraper Error\n${error instanceof Error ? error.message : "Unknown error"}`;
    await sendSlackNotification(errorMessage, true);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
