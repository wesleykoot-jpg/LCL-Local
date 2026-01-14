import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../_shared/dateUtils.ts";
import type { ScraperSource, RawEventCard } from "../_shared/types.ts";
import { createSpoofedFetch, resolveStrategy } from "../_shared/strategies.ts";
import { sendSlackNotification } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal categories used by the product.
const INTERNAL_CATEGORIES = ["nightlife", "food", "culture", "active", "family"] as const;
type InternalCategory = (typeof INTERNAL_CATEGORIES)[number];

const TARGET_YEAR = 2026;
const DEFAULT_EVENT_TYPE = "anchor";

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
  const keywordMap: Array<{ cat: InternalCategory; terms: string[] }> = [
    { cat: "nightlife", terms: ["night", "club", "dj", "concert", "music", "party", "bar"] },
    { cat: "food", terms: ["food", "dinner", "restaurant", "wine", "beer", "market", "taste"] },
    { cat: "culture", terms: ["museum", "exhibition", "theater", "art", "culture", "film"] },
    { cat: "active", terms: ["sport", "run", "walk", "cycling", "bike", "yoga", "fitness"] },
    { cat: "family", terms: ["kids", "family", "children", "parent", "play", "zoo"] },
  ];

  for (const entry of keywordMap) {
    if (entry.terms.some((term) => value.includes(term))) {
      return entry.cat;
    }
  }

  if (["cinema", "gaming"].includes(value)) return "culture";
  if (["crafts"].includes(value)) return "family";
  if (["sports"].includes(value)) return "active";

  return "culture";
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

// ============ Worker Logic ============

interface JobRecord {
  id: string;
  source_id: string;
  attempts: number;
  max_attempts: number;
}

async function claimNextJob(supabase: SupabaseClient): Promise<JobRecord | null> {
  // First, find the next pending job
  const { data: pendingJobs, error: selectError } = await supabase
    .from("scrape_jobs")
    .select("id, source_id, attempts, max_attempts")
    .eq("status", "pending")
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1);

  if (selectError) {
    console.error("Failed to find pending job:", selectError.message);
    return null;
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    return null;
  }

  const job = pendingJobs[0] as JobRecord;

  // Try to claim it by updating status (could race with other workers)
  const { data: claimedJobs, error: updateError } = await supabase
    .from("scrape_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      attempts: job.attempts + 1,
    })
    .eq("id", job.id)
    .eq("status", "pending") // Only claim if still pending (optimistic lock)
    .select("id, source_id, attempts, max_attempts");

  if (updateError) {
    console.error("Failed to claim job:", updateError.message);
    return null;
  }

  if (!claimedJobs || claimedJobs.length === 0) {
    // Job was claimed by another worker, try again
    console.log("Job was claimed by another worker, retrying...");
    return claimNextJob(supabase);
  }

  return claimedJobs[0] as JobRecord;
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

async function failJob(supabase: SupabaseClient, job: JobRecord, errorMessage: string) {
  const shouldRetry = job.attempts < job.max_attempts;
  await supabase
    .from("scrape_jobs")
    .update({
      status: shouldRetry ? "pending" : "failed",
      error_message: errorMessage,
      completed_at: shouldRetry ? null : new Date().toISOString(),
    })
    .eq("id", job.id);
}

async function processSingleSource(
  supabase: SupabaseClient,
  source: ScraperSource,
  geminiApiKey: string | undefined,
  enableDeepScraping: boolean
): Promise<{ scraped: number; inserted: number; duplicates: number; failed: number }> {
  const stats = { scraped: 0, inserted: 0, duplicates: 0, failed: 0 };

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

    const inserted = await insertEvent(supabase, eventInsert);
    if (inserted) {
      stats.inserted++;
    } else {
      stats.failed++;
    }

    await new Promise((resolve) => setTimeout(resolve, rateLimit));
  }

  return stats;
}

/**
 * Scrape Worker
 *
 * Processes ONE source per invocation, giving each source its own 2-second CPU budget.
 * Can optionally chain to the next job after completion.
 *
 * Usage:
 * POST /functions/v1/scrape-worker
 * Body (optional): { "chain": true, "enableDeepScraping": true }
 */
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
    let options: { chain?: boolean; enableDeepScraping?: boolean } = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        options = body ? JSON.parse(body) : {};
      } catch {
        options = {};
      }
    }

    const { chain = false, enableDeepScraping = true } = options;

    // Claim the next pending job
    const job = await claimNextJob(supabase);

    if (!job) {
      console.log("Worker: No pending jobs to process");
      return new Response(
        JSON.stringify({ success: true, message: "No pending jobs", processed: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Worker: Processing job ${job.id} for source ${job.source_id} (attempt ${job.attempts})`);

    // Get the source details
    const { data: sourceData, error: sourceError } = await supabase
      .from("scraper_sources")
      .select("*")
      .eq("id", job.source_id)
      .single();

    if (sourceError || !sourceData) {
      await failJob(supabase, job, `Source not found: ${sourceError?.message || "Unknown"}`);
      throw new Error(`Source not found: ${job.source_id}`);
    }

    const source = sourceData as ScraperSource;

    try {
      // Process the single source
      const stats = await processSingleSource(supabase, source, geminiApiKey, enableDeepScraping);

      // Update source stats
      await updateSourceStats(supabase, source.id, stats.scraped, stats.scraped > 0);

      // Mark job as completed
      await completeJob(supabase, job.id, stats.scraped, stats.inserted);

      console.log(`Worker: Completed job ${job.id} - scraped: ${stats.scraped}, inserted: ${stats.inserted}, duplicates: ${stats.duplicates}`);

      // Send Slack notification for job completion if webhook is configured
      const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
      if (slackWebhookUrl) {
        const message = `✅ Job ${job.id} completed\n` +
          `Source: ${source.name}\n` +
          `Scraped: ${stats.scraped} | Inserted: ${stats.inserted} | Duplicates: ${stats.duplicates}`;
        await sendSlackNotification(slackWebhookUrl, message, false);
      }

      // Chain to the next job if requested
      if (chain) {
        // Check if there are more pending jobs
        const { count } = await supabase
          .from("scrape_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");

        if (count && count > 0) {
          console.log(`Worker: Chaining to next job (${count} remaining)`);
          // Fire and forget - trigger next worker
          fetch(`${supabaseUrl}/functions/v1/scrape-worker`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ chain: true, enableDeepScraping }),
          }).catch((e) => console.warn("Chain trigger failed:", e));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: true,
          jobId: job.id,
          source: source.name,
          stats,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Worker: Job ${job.id} failed -`, errorMessage);

      await failJob(supabase, job, errorMessage);
      await updateSourceStats(supabase, source.id, 0, false);

      // Send Slack notification for job failure
      const slackWebhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
      if (slackWebhookUrl) {
        const message = `❌ Job ${job.id} failed\n` +
          `Source: ${source.name}\n` +
          `Error: ${errorMessage}\n` +
          `Will retry: ${job.attempts < job.max_attempts}`;
        await sendSlackNotification(slackWebhookUrl, message, true);
      }

      // Still chain to next job on failure
      if (chain) {
        fetch(`${supabaseUrl}/functions/v1/scrape-worker`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chain: true, enableDeepScraping }),
        }).catch((e) => console.warn("Chain trigger failed:", e));
      }

      return new Response(
        JSON.stringify({
          success: false,
          processed: true,
          jobId: job.id,
          source: source.name,
          error: errorMessage,
          willRetry: job.attempts < job.max_attempts,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Worker error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
