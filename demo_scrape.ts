#!/usr/bin/env -S deno run --allow-net --allow-env --unstable
/**
 * Live demo scraper.
 *
 * Runs a lightweight scrape against the provided sources (RUN_SOURCES env or defaults)
 * and prints a validation report plus a short human-readable summary.
 *
 * Usage:
 *   deno run --allow-net --allow-env --unstable demo_scrape.ts
 */
import * as cheerio from "cheerio";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { parseToISODate } from "./supabase/functions/scrape-events/dateUtils.ts";
import { normalizeAndResolveUrl } from "./src/lib/urlUtils.ts";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type NormalizedEvent = {
  source: string;
  source_url: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  location_address: JsonValue | null;
  price: number | null;
  currency: string | null;
  categories: string[];
  image: string | null;
  raw_html: string;
  json_ld: JsonValue | null;
  dedup_hash: string;
  extracted_at: string;
  confidence: number;
  outdated?: boolean;
};

type AttemptLog = { timestamp: string; url: string; event: string; status?: number };

type SourceReport = {
  source: string;
  url: string;
  status: "success" | "partial" | "failed" | "blocked";
  http_status: number | null;
  attempted_paths: string[];
  attempts_log: AttemptLog[];
  extracted_count_total: number;
  extracted_examples: NormalizedEvent[];
  supabase_inserts: string[];
  duplicates_skipped: number;
  errors: string[];
  suggestions: string[];
  debug?: {
    html_preview?: string[];
    json_ld_preview?: JsonValue | null;
    selectors_used?: string[];
    llm_prompt?: string;
    llm_response_excerpt?: string;
  };
};

const DEFAULT_SOURCES = [
  "https://www.ontdekexample.nl/agenda",
  "https://www.beleefexample.nl/evenementen",
  "https://www.visitexample.nl/activiteiten",
];

const DEFENSIVE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  Referer: "",
};

const RATE_LIMIT_MS_PER_HOST = 500; // 2 req/sec per host
const BACKOFF_MS = [1000, 3000, 9000];

const LLM_INSTRUCTIONS =
  "Return ONLY valid minified JSON with keys: title, description, event_date (YYYY-MM-DD), event_time (HH:MM or null), location_name, image_url. Keep original language. If unsure return null for missing fields.";

const hostTimestamps = new Map<string, number>();

export function normalizeLocationForHash(location: string | null | undefined): string {
  return (location || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function computeDedupHash(
  title: string,
  startDate: string,
  location: string | null | undefined,
): Promise<string> {
  const normalized = `${title.trim().toLowerCase()}|${startDate.trim()}|${normalizeLocationForHash(location)}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i)) return false;
    seen.add(i);
    return true;
  });
}

export function buildCandidateUrls(inputUrl: string): string[] {
  let base: URL;
  try {
    base = new URL(inputUrl);
  } catch {
    return [];
  }

  const root = `${base.protocol}//${base.host}`;
  const paths = [base.pathname];
  if (!paths[0].endsWith("/")) paths.push(`${paths[0]}/`);
  if (paths[0].endsWith("/")) paths.push(paths[0].slice(0, -1));

  const canonicalPaths = ["/agenda", "/evenementen", "/activiteiten"];
  for (const c of canonicalPaths) {
    if (!paths.includes(c)) paths.push(c, `${c}/`);
  }
  paths.push("/search?q=agenda", "/sitemap.xml");

  const urls = paths.map((p) => normalizeAndResolveUrl(p, root));
  if (base.protocol === "https:") {
    urls.push(`http://${base.host}${paths[0]}`);
  } else {
    urls.push(`https://${base.host}${paths[0]}`);
  }

  return unique([base.toString(), ...urls]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(url: string) {
  try {
    const host = new URL(url).host;
    const last = hostTimestamps.get(host) || 0;
    const now = Date.now();
    const delta = now - last;
    if (delta < RATE_LIMIT_MS_PER_HOST) {
      await sleep(RATE_LIMIT_MS_PER_HOST - delta);
    }
    hostTimestamps.set(host, Date.now());
  } catch {
    // ignore
  }
}

async function fetchWithRetries(
  url: string,
  attempts: AttemptLog[],
  init: RequestInit = {},
): Promise<Response | null> {
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    await throttle(url);
    try {
      const resp = await fetch(url, {
        redirect: "follow",
        ...init,
      });
      attempts.push({ timestamp: new Date().toISOString(), url, event: `fetch:${i + 1}`, status: resp.status });
      if (resp.status === 429 || resp.status >= 500) {
        await sleep(BACKOFF_MS[i]);
        continue;
      }
      return resp;
    } catch (error) {
      attempts.push({
        timestamp: new Date().toISOString(),
        url,
        event: `error:${i + 1}`,
        status: 0,
      });
      if (i < BACKOFF_MS.length - 1) {
        await sleep(BACKOFF_MS[i]);
      } else {
        console.warn(`Fetch failed for ${url}: ${error}`);
      }
    }
  }
  return null;
}

function firstLines(html: string, lines = 5): string[] {
  return html
    .split("\n")
    .slice(0, lines)
    .map((l) => l.trim());
}

function chooseConfidence(source: "jsonld" | "cheerio" | "llm"): number {
  if (source === "jsonld") return 0.95;
  if (source === "cheerio") return 0.75;
  return 0.55;
}

function extractJsonLdBlocks(html: string): JsonValue[] {
  const $ = cheerio.load(html);
  const blocks: JsonValue[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    if (!text) return;
    try {
      const parsed = JSON.parse(text) as JsonValue;
      blocks.push(parsed);
    } catch {
      // ignore
    }
  });
  return blocks;
}

function mapJsonLdEvent(node: Record<string, JsonValue>, baseUrl: string): { raw: NormalizedEvent; json: JsonValue } | null {
  const type = node["@type"] || node["type"];
  const isEvent =
    (Array.isArray(type) && type.some((t) => `${t}`.toLowerCase() === "event")) ||
    `${type}`.toLowerCase() === "event";
  if (!isEvent) return null;

  const title = typeof node.name === "string"
    ? node.name
    : typeof node.headline === "string"
    ? node.headline
    : "";
  const startDateRaw = typeof node.startDate === "string" ? node.startDate : "";
  const parsedDate = parseToISODate(startDateRaw);
  if (!title || !parsedDate) return null;

  let eventTime: string | null = null;
  const timeMatch = startDateRaw.match(/T(\d{2}:\d{2})/);
  if (timeMatch) {
    eventTime = timeMatch[1];
  }

  const location =
    typeof node.location === "object" && node.location && typeof (node.location as Record<string, JsonValue>).name === "string"
      ? ((node.location as Record<string, JsonValue>).name as string)
      : "";
  const rawUrl = typeof node.url === "string" ? node.url : "";
  const detailUrl = rawUrl ? new URL(rawUrl, baseUrl).toString() : baseUrl;

  const raw_html = JSON.stringify(node).slice(0, 3000);
  return {
    raw: {
      source: new URL(baseUrl).host,
      source_url: detailUrl,
      title,
      description: typeof node.description === "string" ? node.description : "",
      start_date: parsedDate,
      end_date: null,
      location_name: location || null,
      location_address: typeof node.location === "object" ? (node.location as JsonValue) : null,
      price: null,
      currency: null,
      categories: [],
      image: typeof node.image === "string" ? node.image : null,
      raw_html,
      json_ld: node as JsonValue,
      dedup_hash: "",
      extracted_at: new Date().toISOString(),
      confidence: chooseConfidence("jsonld"),
    },
    json: node as JsonValue,
  };
}

async function normalizeCheerioEvent(
  el: cheerio.Cheerio<cheerio.AnyNode>,
  $: cheerio.CheerioAPI,
  pageUrl: string,
): Promise<NormalizedEvent | null> {
  const title =
    el.find("h1, h2, h3, h4").first().text().trim() ||
    el.find('[class*="title"]').first().text().trim() ||
    el.find("a").first().text().trim();
  const dateText =
    el.find("time").first().attr("datetime") ||
    el.find("time").first().text() ||
    el.find('[class*="date"]').first().text();
  const location =
    el.find(".location, .venue, address, [class*=\"loca\"]").first().text().trim() || null;
  const description = el.find(".description, .excerpt, p").first().text().trim();
  const detailHref = el.find("a").first().attr("href") || "";
  const image = el.find("img").first().attr("src") || null;

  const parsedDate = dateText ? parseToISODate(dateText) : null;
  if (!title || !parsedDate) return null;

  const detailUrl = detailHref ? normalizeAndResolveUrl(detailHref, pageUrl) : pageUrl;
  const dedup_hash = await computeDedupHash(title, parsedDate, location);

  return {
    source: new URL(pageUrl).host,
    source_url: detailUrl,
    title,
    description,
    start_date: parsedDate,
    end_date: null,
    location_name: location,
    location_address: null,
    price: null,
    currency: null,
    categories: [],
    image,
    raw_html: el.html() || "",
    json_ld: null,
    dedup_hash,
    extracted_at: new Date().toISOString(),
    confidence: chooseConfidence("cheerio"),
  };
}

async function parseWithCheerio(html: string, pageUrl: string) {
  const $ = cheerio.load(html);
  const selectors = [
    '[class*="event"]',
    '[class*="agenda"]',
    '[class*="evenement"]',
    '[class*="programma"]',
    '[class*="card"]',
    "article",
    "li",
  ];
  const excluded = ["nav", "header", "footer", ".menu", ".navigation", ".breadcrumb"];
  const eventPromises: Array<Promise<NormalizedEvent | null>> = [];
  const selectorsUsed = new Set<string>();

  for (const sel of selectors) {
    $(sel)
      .filter((_, el) => {
        const tag = el.tagName?.toLowerCase() || "";
        if (excluded.includes(tag)) return false;
        const cls = ($(el).attr("class") || "").toLowerCase();
        return !excluded.some((ex) => cls.includes(ex.replace(".", "")));
      })
      .each((_idx, el) => {
        selectorsUsed.add(sel);
        eventPromises.push(normalizeCheerioEvent($(el), $, pageUrl));
      });
  }

  const resolved = (await Promise.all(eventPromises)).filter((e): e is NormalizedEvent => Boolean(e));
  return { events: resolved, selectorsUsed: Array.from(selectorsUsed) };
}

async function callOpenAILLM(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: LLM_INSTRUCTIONS },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });
    if (!response.ok) {
      console.warn(`OpenAI error ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.warn(`OpenAI call failed: ${error}`);
    return null;
  }
}

async function callGeminiLLM(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${LLM_INSTRUCTIONS}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      },
    );
    if (!response.ok) {
      console.warn(`Gemini error ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (error) {
    console.warn(`Gemini call failed: ${error}`);
    return null;
  }
}

async function parseLLMEvent(snippet: string, pageUrl: string) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const prompt = `HTML snippet:\n${snippet}\n\nReturn a single event JSON.`;
  const llmText = openaiKey
    ? await callOpenAILLM(prompt, openaiKey)
    : geminiKey
    ? await callGeminiLLM(prompt, geminiKey)
    : null;
  if (!llmText) return { event: null, prompt, response: null };

  let cleaned = llmText.trim();
  cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, JsonValue>;
    const title = typeof parsed.title === "string" ? parsed.title : "";
    const date = typeof parsed.event_date === "string" ? parseToISODate(parsed.event_date) : null;
    if (!title || !date) return { event: null, prompt, response: llmText };
    const location = typeof parsed.location_name === "string" ? parsed.location_name : null;
    const dedup_hash = await computeDedupHash(title, date, location);
    const start_date = date;
    const description = typeof parsed.description === "string" ? parsed.description : "";
    const image = typeof parsed.image_url === "string" ? parsed.image_url : null;

    const event: NormalizedEvent = {
      source: new URL(pageUrl).host,
      source_url: pageUrl,
      title,
      description,
      start_date,
      end_date: null,
      location_name: location,
      location_address: null,
      price: null,
      currency: null,
      categories: [],
      image,
      raw_html: snippet.slice(0, 3000),
      json_ld: null,
      dedup_hash,
      extracted_at: new Date().toISOString(),
      confidence: chooseConfidence("llm"),
    };

    return { event, prompt, response: llmText };
  } catch (error) {
    console.warn(`LLM parse failed: ${error}`);
    return { event: null, prompt, response: llmText };
  }
}

async function upsertToSupabase(client: SupabaseClient | null, event: NormalizedEvent) {
  if (!client) return { insertedId: null, duplicate: false, error: null };
  try {
    const { data, error } = await client
      .from("events")
      .upsert(
        {
          source: event.source,
          source_url: event.source_url,
          title: event.title,
          description: event.description,
          start_date: event.start_date,
          end_date: event.end_date,
          location_name: event.location_name,
          location_address: event.location_address,
          price: event.price,
          currency: event.currency,
          categories: event.categories,
          image: event.image,
          raw_html: event.raw_html,
          json_ld: event.json_ld,
          dedup_hash: event.dedup_hash,
          extracted_at: event.extracted_at,
        },
        { onConflict: "dedup_hash" },
      )
      .select("id, dedup_hash");

    if (error) {
      if (error.message?.toLowerCase().includes("duplicate")) {
        return { insertedId: null, duplicate: true, error: null };
      }
      return { insertedId: null, duplicate: false, error: error.message };
    }

    if (data && data.length > 0) {
      return { insertedId: data[0].id as string, duplicate: false, error: null };
    }

    return { insertedId: null, duplicate: true, error: null };
  } catch (error) {
    return { insertedId: null, duplicate: false, error: error instanceof Error ? error.message : `${error}` };
  }
}

async function processSource(url: string, supabase: SupabaseClient | null): Promise<SourceReport> {
  const attempts_log: AttemptLog[] = [];
  const attempted_paths = buildCandidateUrls(url);
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  let html: string | null = null;
  let http_status: number | null = null;
  let html_preview: string[] | undefined;
  let json_ld_preview: JsonValue | null = null;
  let selectors_used: string[] | undefined;
  let llm_prompt: string | undefined;
  let llm_response_excerpt: string | undefined;
  let blocked = false;
  let errors: string[] = [];

  for (const candidate of attempted_paths) {
    DEFENSIVE_HEADERS.Referer = candidate;
    const resp = await fetchWithRetries(candidate, attempts_log, { headers: DEFENSIVE_HEADERS });
    if (!resp) continue;
    http_status = resp.status;
    if (resp.status === 403) {
      blocked = true;
      errors.push("Robots/captcha blocked (403)");
      break;
    }
    if (!resp.ok) continue;
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) continue;
    html = await resp.text();
    html_preview = firstLines(html);
    break;
  }

  const supabase_inserts: string[] = [];
  let duplicates_skipped = 0;
  const suggestions: string[] = [];

  if (blocked) {
    suggestions.push("Use headless renderer or add cookies to bypass bot protection.");
    return {
      source: host,
      url,
      status: "blocked",
      http_status,
      attempted_paths,
      attempts_log,
      extracted_count_total: 0,
      extracted_examples: [],
      supabase_inserts,
      duplicates_skipped,
      errors,
      suggestions,
      debug: { html_preview },
    };
  }

  if (!html) {
    errors.push("No HTML retrieved");
    suggestions.push("Try alternate paths or renderer, or check sitemap/search endpoints.");
    return {
      source: host,
      url,
      status: "failed",
      http_status,
      attempted_paths,
      attempts_log,
      extracted_count_total: 0,
      extracted_examples: [],
      supabase_inserts,
      duplicates_skipped,
      errors,
      suggestions,
      debug: { html_preview },
    };
  }

  const jsonBlocks = extractJsonLdBlocks(html);
  if (jsonBlocks.length > 0) {
    json_ld_preview = jsonBlocks[0];
  }

  const normalizedEvents: NormalizedEvent[] = [];

  // JSON-LD first
  for (const block of jsonBlocks) {
    const nodes = Array.isArray(block) ? block : [block];
    for (const node of nodes) {
      if (node && typeof node === "object" && !Array.isArray(node)) {
        const mapped = mapJsonLdEvent(node as Record<string, JsonValue>, url);
        if (mapped) {
          mapped.raw.dedup_hash = await computeDedupHash(
            mapped.raw.title,
            mapped.raw.start_date,
            mapped.raw.location_name,
          );
          normalizedEvents.push(mapped.raw);
        }
      }
    }
  }

  // Cheerio fallback
  if (normalizedEvents.length === 0) {
    const cheerioResult = await parseWithCheerio(html, url);
    selectors_used = cheerioResult.selectorsUsed;
    normalizedEvents.push(...cheerioResult.events);
  }

  // LLM fallback
  if (normalizedEvents.length === 0) {
    const $ = cheerio.load(html);
    const candidateCard = $('[class*="event"], [class*="agenda"], article, li').first();
    if (candidateCard.length > 0) {
      const snippet = candidateCard.html() || "";
      const llmResult = await parseLLMEvent(snippet, url);
      llm_prompt = llmResult.prompt;
      llm_response_excerpt = llmResult.response ? llmResult.response.slice(0, 400) : undefined;
      if (llmResult.event) {
        normalizedEvents.push(llmResult.event);
      } else {
        errors.push("LLM parsing returned no event");
      }
    }
  }

  const seen = new Set<string>();
  const finalEvents: NormalizedEvent[] = [];
  for (const evt of normalizedEvents) {
    if (!evt.start_date) continue;
    if (!evt.dedup_hash) {
      evt.dedup_hash = await computeDedupHash(evt.title, evt.start_date, evt.location_name);
    }
    if (seen.has(evt.dedup_hash)) {
      duplicates_skipped += 1;
      continue;
    }
    seen.add(evt.dedup_hash);
    evt.outdated = !evt.start_date.includes("2026") && !evt.description.includes("2026");
    finalEvents.push(evt);
  }

  finalEvents.sort((a, b) => {
    const aOld = a.outdated ? 1 : 0;
    const bOld = b.outdated ? 1 : 0;
    if (aOld !== bOld) return aOld - bOld;
    return a.start_date.localeCompare(b.start_date);
  });

  const extracted_examples: NormalizedEvent[] = finalEvents.slice(0, 3);
  const extracted_count_total = finalEvents.length;

  for (const evt of extracted_examples) {
    const { insertedId, duplicate, error } = await upsertToSupabase(supabase, evt);
    if (duplicate) duplicates_skipped += 1;
    if (insertedId) supabase_inserts.push(insertedId);
    if (error) errors.push(error);
  }

  const status: SourceReport["status"] =
    extracted_examples.length > 0 ? "success" : normalizedEvents.length > 0 ? "partial" : "failed";

  if (status !== "success") {
    suggestions.push("Adjust selectors or enable rendering; inspect sitemap/search endpoints.");
  }

  return {
    source: host,
    url,
    status,
    http_status,
    attempted_paths,
    attempts_log,
    extracted_count_total,
    extracted_examples,
    supabase_inserts,
    duplicates_skipped,
    errors,
    suggestions,
    debug: {
      html_preview,
      json_ld_preview,
      selectors_used,
      llm_prompt,
      llm_response_excerpt,
    },
  };
}

function getSourcesFromEnv(): string[] {
  const env = Deno.env.get("RUN_SOURCES");
  if (!env) return DEFAULT_SOURCES;
  return env
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function createSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && supabaseKey) {
    return createClient(supabaseUrl, supabaseKey);
  }
  return null;
}

async function main() {
  const run_id = crypto.randomUUID();
  const run_started_at = new Date();
  const sources = getSourcesFromEnv();
  const supabase = createSupabaseClient();

  const reports: SourceReport[] = [];
  for (const src of sources) {
    const report = await processSource(src, supabase);
    reports.push(report);
  }

  const run_finished_at = new Date();
  const total_events_extracted = reports.reduce((acc, r) => acc + r.extracted_count_total, 0);
  const total_saved_to_supabase = reports.reduce((acc, r) => acc + r.supabase_inserts.length, 0);

  const summary = {
    total_sources: reports.length,
    total_events_extracted,
    total_saved_to_supabase,
    top_action_items: reports
      .filter((r) => r.status !== "success")
      .map((r) => `${r.source}: ${r.suggestions[0] || "inspect selectors"}`)
      .slice(0, 5),
  };

  const report = {
    run_id,
    run_started_at: run_started_at.toISOString(),
    run_finished_at: run_finished_at.toISOString(),
    sources: reports,
    summary,
  };

  console.log(JSON.stringify(report, null, 2));

  const humanSummary = [
    `Run ${run_id} (${run_started_at.toISOString()} → ${run_finished_at.toISOString()})`,
    `Sources OK: ${reports.filter((r) => r.status === "success").length}/${reports.length}`,
    `Events extracted: ${total_events_extracted}, saved to Supabase: ${total_saved_to_supabase}`,
  ];
  for (const rep of reports) {
    humanSummary.push(
      `- ${rep.source}: ${rep.status} (events ${rep.extracted_examples.length}/${rep.extracted_count_total})`,
    );
    if (rep.suggestions.length > 0) {
      humanSummary.push(`  Suggestions: ${rep.suggestions.slice(0, 3).join("; ")}`);
    }
  }
  console.log("\nHuman summary:\n" + humanSummary.join("\n"));
}

if (import.meta.main) {
  await main();
}
