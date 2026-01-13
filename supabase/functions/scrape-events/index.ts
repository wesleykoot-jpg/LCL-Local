import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "./dateUtils.ts";
import type { ScraperSource, RawEventCard } from "./shared.ts";
import { createSpoofedFetch, resolveStrategy } from "./strategies.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-scraper-key",
};

// Internal categories used by the product.
export const INTERNAL_CATEGORIES = ["nightlife", "food", "culture", "active", "family"] as const;
export type InternalCategory = (typeof INTERNAL_CATEGORIES)[number];

const TARGET_YEAR = 2026;

const DEFAULT_EVENT_TYPE = "anchor";

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

export function mapToInternalCategory(input?: string): InternalCategory {
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

  // map legacy categories from AI outputs
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
  fetcher: typeof fetch = createSpoofedFetch()
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

// Jittered delay helper (100-300ms random delay)
function jitteredDelay(baseMs: number = 100, jitterMs: number = 200): Promise<void> {
  const delay = baseMs + Math.random() * jitterMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
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
  fetcher: typeof fetch,
  maxRetries: number = 3
): Promise<string | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Add jittered delay before each request (except first if it's after a backoff)
    if (attempt === 0) {
      await jitteredDelay(100, 200); // 100-300ms jitter before first call
    }

    const response = await fetcher(
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
  options: { fetcher?: typeof fetch; callGeminiFn?: typeof callGemini } = {}
): Promise<NormalizedEvent | null> {
  const fetcher = options.fetcher || createSpoofedFetch();
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

  const text = await callFn(apiKey, payload, fetcher);
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
    image_url: parsed.image_url ?? rawEvent.imageUrl ?? null,
    internal_category: mapToInternalCategory(
      (parsed as Record<string, unknown>).category as string ||
        parsed.description ||
        rawEvent.title,
    ),
    detail_url: rawEvent.detailUrl,
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
  fetcher?: typeof fetch;
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
  const fetcher = options.fetcher || createSpoofedFetch({ headers: source.config.headers });
  const rateLimit = source.config.rate_limit_ms ?? 150;

  let listingHtml = options.listingHtml;
  let listingUrl = options.listingUrl || source.url;

  if (!listingHtml) {
    const candidates = await strategy.discoverListingUrls(fetcher);
    for (const candidate of candidates) {
      const resp = await strategy.fetchListing(candidate, fetcher);
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
      await new Promise((resolve) => setTimeout(resolve, rateLimit));
    }
  }

  return rawEvents;
}

// deno-lint-ignore no-explicit-any
async function insertEvent(
  supabase: any,
  event: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase.from("events").insert(event);
  if (error) {
    console.error("Insert failed", error.message);
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

    let options: ScrapeOptions = {};
    if (req.method === "POST") {
      try {
        const body = await req.text();
        options = body ? JSON.parse(body) : {};
      } catch {
        options = {};
      }
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
      const fetcher = createSpoofedFetch({ headers: source.config.headers });
      const probeLog: Array<{ candidate: string; status: number; finalUrl: string; ok: boolean }> = [];
      const rateLimit = source.config.rate_limit_ms ?? 200;
      const sourceStats = { name: source.name, scraped: 0, inserted: 0, duplicates: 0, failed: 0 };

      try {
        const candidates = await strategy.discoverListingUrls(fetcher);
        let listingHtml = "";
        let listingUrl = source.url;

        for (const candidate of candidates) {
          const resp = await strategy.fetchListing(candidate, fetcher);
          probeLog.push({ candidate, status: resp.status, finalUrl: resp.finalUrl, ok: resp.status >= 200 && resp.status < 400 });
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

        if (enableDeepScraping) {
          for (const raw of rawEvents) {
            if (!raw.detailUrl || raw.detailPageTime) continue;
            const time = await fetchEventDetailTime(raw.detailUrl, listingUrl, fetcher);
            if (time) raw.detailPageTime = time;
            await new Promise((resolve) => setTimeout(resolve, rateLimit));
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
          const point = defaultCoords
            ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})`
            : "POINT(0 0)";

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

          await new Promise((resolve) => setTimeout(resolve, rateLimit));
        }

        await upsertProbeLog(supabase, source.id, probeLog);
        await updateSourceStats(supabase, source.id, sourceStats.scraped, sourceStats.scraped > 0);
      } catch (error) {
        console.error(`Error processing ${source.name}`, error);
        await updateSourceStats(supabase, source.id, sourceStats.scraped, false);
      }

      stats.sourceResults.push(sourceStats);
    }

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scraper error", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

export { parseToISODate } from "./dateUtils.ts";
export type { ScraperSource } from "./shared.ts";

if (import.meta.main) {
  serve(handleRequest);
}
