import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../_shared/dateUtils.ts";
import type { ScrapeJobPayload, ScraperSource, RawEventCard } from "../_shared/types.ts";
import { createFetcherForSource, resolveStrategy } from "../_shared/strategies.ts";
import { sendSlackNotification } from "../_shared/slack.ts";
import { classifyTextToCategory, INTERNAL_CATEGORIES, type InternalCategory } from "../_shared/categoryMapping.ts";
import { logError, logWarning, logSupabaseError } from "../_shared/errorLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
const BATCH_SIZE = 20;

class ProxyRetryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyRetryError";
  }
}

// ============ Helper Functions (copied from scrape-events for isolation) ============

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

function getProxyApiKey(): string | undefined {
  return Deno.env.get("SCRAPER_PROXY_API_KEY") ||
    Deno.env.get("PROXY_PROVIDER_API_KEY") ||
    Deno.env.get("SCRAPINGBEE_API_KEY");
}

function isTargetYear(isoDate: string | null): boolean {
  return !!isoDate && isoDate.startsWith(`${TARGET_YEAR}-`);
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createEventFingerprint(title: string, eventDate: string, sourceId: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}|${sourceId}`);
}

async function createContentHash(title: string, eventDate: string): Promise<string> {
  return sha256Hex(`${title}|${eventDate}`);
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
  body: unknown,
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
        body: JSON.stringify(body),
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
  const systemPrompt = `Je bent een datacleaner. Haal evenementen-informatie uit ruwe HTML.
- Retourneer uitsluitend geldige JSON.
- Weiger evenementen die niet in 2026 plaatsvinden.
- Houd tekst in originele taal (${language}).
- velden: title, description (max 200 chars), event_date (YYYY-MM-DD), event_time (HH:MM), venue_name, venue_address, image_url
- category: Kies de BEST PASSENDE uit: [active, gaming, entertainment, social, family, outdoors, music, workshops, foodie, community]. Indien onzeker of geen match, kies 'community'.`;

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

async function contentHashExists(supabase: SupabaseClient, contentHash: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .eq("content_hash", contentHash)
    .limit(1);
  if (error) {
    console.warn("Content hash lookup failed", error.message);
    return false;
  }
  return (data && data.length > 0) || false;
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

async function insertEvent(supabase: SupabaseClient, event: Record<string, unknown>, sourceId: string): Promise<boolean> {
  const { error } = await supabase.from("events").insert(event);
  if (error) {
    console.error("Insert failed", error.message);
    // Log to centralized error_logs table
    await logSupabaseError('scrape-worker', 'insertEvent', 'Event insert', error, {
      source_id: sourceId,
      event_title: event.title,
      event_date: event.event_date,
      fingerprint: event.event_fingerprint,
    });
    return false;
  }
  return true;
}

async function updateSourceStats(
  supabase: SupabaseClient,
  sourceId: string,
  scraped: number,
  success: boolean,
  lastError?: string
) {
  try {
    await supabase.rpc("update_scraper_source_stats", {
      p_source_id: sourceId,
      p_events_scraped: scraped,
      p_success: success,
      p_last_error: lastError ?? null,
    });
  } catch (error) {
    console.warn("update_scraper_source_stats failed", error);
    await logWarning('scrape-worker', 'updateSourceStats', `Stats update failed for source ${sourceId}`, {
      source_id: sourceId,
      scraped,
      success,
      error: String(error),
    });
  }
}

/**
 * Self-healing fetcher logic: Check if source needs fetcher_type change
 */
async function checkAndHealFetcher(
  supabase: SupabaseClient,
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

// ============ Worker Logic ============

interface ScrapeJobRecord {
  id: string;
  source_id: string;
  payload: ScrapeJobPayload | null;
  attempts: number;
  max_attempts: number;
}

export async function claimScrapeJobs(
  supabase: SupabaseClient,
  batchSize: number
): Promise<ScrapeJobRecord[]> {
  const { data, error } = await supabase.rpc("claim_scrape_jobs", {
    p_batch_size: batchSize,
  });

  if (error) {
    console.error("Failed to claim jobs:", error.message);
    return [];
  }

  // Map RPC output (out_*) to ScrapeJobRecord interface
  return (data ?? []).map((row: any) => ({
    id: row.out_id,
    source_id: row.out_source_id,
    payload: row.out_payload,
    attempts: row.out_attempts,
    max_attempts: row.out_max_attempts,
  }));
}

async function completeJob(
  supabase: SupabaseClient,
  jobId: string,
  eventsScraped: number,
  eventsInserted: number
) {
  await supabase
    .from("scrape_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      events_scraped: eventsScraped,
      events_inserted: eventsInserted,
    })
    .eq("id", jobId);
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  payload: ScrapeJobPayload,
  errorMessage: string
) {
  await supabase
    .from("scrape_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      payload,
    })
    .eq("id", jobId);
}

async function processSingleSource(
  supabase: SupabaseClient,
  source: ScraperSource,
  geminiApiKey: string | undefined,
  enableDeepScraping: boolean
): Promise<{ scraped: number; inserted: number; duplicates: number; failed: number }> {
  const stats = { scraped: 0, inserted: 0, duplicates: 0, failed: 0 };

  const strategy = resolveStrategy((source as { strategy?: string }).strategy, source);
  const fetcher = createFetcherForSource(source);
  const rateLimit = source.config.rate_limit_ms ?? 200;
  const proxyApiKey = getProxyApiKey();

  // Discover and fetch listing
  const candidates = await strategy.discoverListingUrls(fetcher);
  let listingHtml = "";
  let listingUrl = source.url;

  for (const candidate of candidates) {
    const resp = await strategy.fetchListing(candidate, fetcher);
    if (resp.status === 403 || resp.status === 429) {
      const message = `Source ${source.name} returned ${resp.status} for ${candidate}`;
      console.warn(message);
      if (proxyApiKey) {
        throw new ProxyRetryError(message);
      }
    }
    if (resp.status === 404 || !resp.html) continue;
    listingHtml = resp.html;
    listingUrl = resp.finalUrl || candidate;
    break;
  }

  if (!listingHtml) {
    throw new Error("No valid listing found");
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

    // Use AI if needed (this is Wall Clock time, not CPU time!)
    if ((!normalized || normalized.event_time === "TBD" || !normalized.description) && geminiApiKey) {
      const aiResult = await parseEventWithAI(geminiApiKey, raw, source.language || "nl", fetcher);
      if (aiResult) normalized = aiResult;
    }

    if (!normalized) {
      stats.failed++;
      continue;
    }

    const contentHash = await createContentHash(normalized.title, normalized.event_date);
    const contentExists = await contentHashExists(supabase, contentHash);
    if (contentExists) {
      stats.duplicates++;
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
      content_hash: contentHash,
    };

    const inserted = await insertEvent(supabase, eventInsert, source.id);
    if (inserted) {
      stats.inserted++;
    } else {
      stats.failed++;
    }

    await new Promise((resolve) => setTimeout(resolve, rateLimit));
  }

  return stats;
}

export async function processJob(
  supabase: SupabaseClient,
  job: ScrapeJobRecord,
  geminiApiKey: string | undefined,
  enableDeepScraping: boolean
): Promise<{
  jobId: string;
  sourceId: string;
  status: "completed" | "failed";
  stats?: { scraped: number; inserted: number; duplicates: number; failed: number };
  error?: string;
}> {
  const payload: ScrapeJobPayload = {
    sourceId: job.payload?.sourceId ?? job.source_id,
    scheduledAt: job.payload?.scheduledAt ?? new Date().toISOString(),
    proxyRetry: job.payload?.proxyRetry,
  };

  const { data: sourceData, error: sourceError } = await supabase
    .from("scraper_sources")
    .select("*")
    .eq("id", job.source_id)
    .single();

  if (sourceError || !sourceData) {
    const errorMessage = `Source not found: ${sourceError?.message || "Unknown"}`;
    await failJob(supabase, job.id, payload, errorMessage);
    await updateSourceStats(supabase, job.source_id, 0, false, errorMessage);
    return { jobId: job.id, sourceId: job.source_id, status: "failed", error: errorMessage };
  }

  const source = sourceData as ScraperSource;

  try {
    const stats = await processSingleSource(supabase, source, geminiApiKey, enableDeepScraping);

    await updateSourceStats(supabase, source.id, stats.scraped, stats.scraped > 0);

    if (stats.scraped === 0) {
      await checkAndHealFetcher(supabase, source.id, stats.scraped, 200);
    }

    await completeJob(supabase, job.id, stats.scraped, stats.inserted);

    const defaultCoords = source.default_coordinates || source.config?.default_coordinates;
    const coordsInfo = defaultCoords
      ? `📍 ${defaultCoords.lat.toFixed(4)}, ${defaultCoords.lng.toFixed(4)}`
      : "📍 No coordinates";

    const message = `✅ Job ${job.id} completed\n` +
      `Source: ${source.name}\n` +
      `Scraped: ${stats.scraped} | Inserted: ${stats.inserted} | Duplicates: ${stats.duplicates}\n` +
      `${coordsInfo}`;
    await sendSlackNotification(message, false);

    return { jobId: job.id, sourceId: source.id, status: "completed", stats };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const proxyRetry = error instanceof ProxyRetryError;
    if (proxyRetry) {
      payload.proxyRetry = true;
    }

    await logError({
      level: 'error',
      source: 'scrape-worker',
      function_name: 'processSingleSource',
      message: `Job ${job.id} failed for source "${source.name}": ${errorMessage}`,
      error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
      stack_trace: error instanceof Error ? error.stack : undefined,
      context: {
        job_id: job.id,
        source_id: source.id,
        source_name: source.name,
        source_url: source.url,
        attempts: job.attempts,
        proxy_retry: proxyRetry,
      },
    });

    await failJob(supabase, job.id, payload, errorMessage);
    await updateSourceStats(supabase, source.id, 0, false, errorMessage);

    const message = `❌ Job ${job.id} failed\n` +
      `Source: ${source.name}\n` +
      `Error: ${errorMessage}\n` +
      `Proxy retry: ${proxyRetry ? "queued" : "no"}`;
    await sendSlackNotification(message, true);

    return { jobId: job.id, sourceId: source.id, status: "failed", error: errorMessage };
  }
}

/**
 * Scrape Worker
 *
 * Processes a batch of sources per invocation using concurrent execution.
 *
 * Usage:
 * POST /functions/v1/scrape-worker
 * Body (optional): { "enableDeepScraping": true }
 */
if (import.meta.main) {
  serve(async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase env vars");
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Parse options
      let options: { enableDeepScraping?: boolean } = {};
      if (req.method === "POST") {
        try {
          const body = await req.text();
          options = body ? JSON.parse(body) : {};
        } catch {
          options = {};
        }
      }

      const { enableDeepScraping = true } = options;

      const jobs = await claimScrapeJobs(supabase, BATCH_SIZE);

      if (jobs.length === 0) {
        console.log("Worker: No pending jobs to process");
        return new Response(
          JSON.stringify({ success: true, message: "No pending jobs", processed: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Worker: Processing ${jobs.length} jobs`);

      const results = await Promise.allSettled(
        jobs.map((job) => processJob(supabase, job, geminiApiKey, enableDeepScraping))
      );

      const summary = results.reduce(
        (acc, result) => {
          if (result.status === "fulfilled") {
            acc.processed += 1;
            if (result.value.status === "completed") {
              acc.completed += 1;
            } else {
              acc.failed += 1;
            }
            acc.results.push(result.value);
          } else {
            acc.processed += 1;
            acc.failed += 1;
            acc.results.push({
              jobId: "unknown",
              sourceId: "unknown",
              status: "failed",
              error: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
          }
          return acc;
        },
        {
          processed: 0,
          completed: 0,
          failed: 0,
          results: [] as Array<{
            jobId: string;
            sourceId: string;
            status: "completed" | "failed";
            stats?: { scraped: number; inserted: number; duplicates: number; failed: number };
            error?: string;
          }>,
        }
      );

      const allJobsSucceeded = summary.failed === 0;

      // Chain-triggering: if we processed a full batch, check for more jobs
      if (jobs.length === BATCH_SIZE) {
        const { count } = await supabase
          .from("scrape_jobs")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (count && count > 0) {
          console.log(`Worker: ${count} more jobs pending, chain-triggering...`);
          fetch(`${supabaseUrl}/functions/v1/scrape-worker`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify(options),
          }).catch((err) => console.error("Failed to chain-trigger worker:", err));
        }
      }

      return new Response(
        JSON.stringify({
          success: allJobsSucceeded,
          allJobsSucceeded,
          processed: true,
          batchSize: jobs.length,
          summary,
        }),
        { status: allJobsSucceeded ? 200 : 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Worker error:", error);
      // Log top-level errors
      await logError({
        level: 'fatal',
        source: 'scrape-worker',
        function_name: 'serve',
        message: `Worker fatal error: ${error instanceof Error ? error.message : String(error)}`,
        error_type: error instanceof Error ? error.constructor.name : 'UnknownError',
        stack_trace: error instanceof Error ? error.stack : undefined,
      });
      return new Response(
        JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  });
}
