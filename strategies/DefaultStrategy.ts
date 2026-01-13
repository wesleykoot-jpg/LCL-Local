import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../supabase/functions/scrape-events/dateUtils.ts";
import type { ScraperSource } from "../supabase/functions/scrape-events/shared.ts";
import {
  RawEventCard,
  ScraperStrategy,
  StrategyContext,
  FetchListingResult,
  createSpoofedFetch,
  generatePathFallbacks,
} from "./BaseStrategy.ts";

const DEFAULT_DISCOVERY_ANCHORS = [
  "agenda",
  "evenementen",
  "events",
  "whatson",
  "kalender",
];

const DEFAULT_SELECTORS = [
  "article.event-card",
  "article.agenda-item",
  ".event-card",
  ".event-item",
  ".agenda-event",
  ".card.event",
  ".agenda-item",
  "article",
];

function extractStructuredEvents(html: string, baseUrl: string): RawEventCard[] {
  const $ = cheerio.load(html);
  const results: RawEventCard[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const mapped = mapStructuredNode(node, baseUrl);
        if (mapped) results.push(mapped);
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  });

  return results;
}

function mapStructuredNode(node: Record<string, unknown>, baseUrl: string): RawEventCard | null {
  const type = node["@type"] || node["type"];
  const isEvent =
    (Array.isArray(type) && type.some((t) => `${t}`.toLowerCase() === "event")) ||
    `${type}`.toLowerCase() === "event";
  if (!isEvent) return null;

  const title =
    typeof node.name === "string"
      ? node.name
      : typeof node.headline === "string"
        ? node.headline
        : "";
  const startDate = typeof node.startDate === "string" ? parseToISODate(node.startDate) : null;
  if (!title || !startDate) return null;

  const location =
    typeof node.location === "object" && node.location && typeof (node.location as Record<string, unknown>).name === "string"
      ? ((node.location as Record<string, unknown>).name as string)
      : "";
  const rawUrl = typeof node.url === "string" ? node.url : "";
  const detailUrl = rawUrl ? new URL(rawUrl, baseUrl).toString() : null;

  let eventTime: string | undefined;
  if (typeof node.startDate === "string") {
    const timeMatch = `${node.startDate}`.match(/T(\d{2}:\d{2})/);
    if (timeMatch) eventTime = timeMatch[1];
  }

  const description = typeof node.description === "string" ? node.description : "";
  const imageUrl = typeof node.image === "string" ? node.image : null;
  const categoryHint = typeof node.eventAttendanceMode === "string" ? node.eventAttendanceMode : undefined;

  return {
    rawHtml: JSON.stringify(node).slice(0, 2000),
    title,
    date: startDate,
    location,
    imageUrl,
    description,
    detailUrl,
    detailPageTime: eventTime,
    categoryHint,
  };
}

export class DefaultStrategy implements ScraperStrategy {
  constructor(private source: ScraperSource) {}

  /**
   * Discover possible listing URLs by probing anchors and defensive fallbacks.
   */
  async discoverListingUrls(fetcher: typeof fetch = createSpoofedFetch()): Promise<string[]> {
    const candidates = new Set<string>();
    candidates.add(this.source.url);
    generatePathFallbacks(this.source.url).forEach((u) => candidates.add(u));
    (this.source.config.alternatePaths || []).forEach((path) => {
      try {
        candidates.add(new URL(path, this.source.url).toString());
      } catch {
        // ignore invalid alternate path
      }
    });

    try {
      const resp = await fetcher(this.source.url);
      const html = await resp.text();
      const $ = cheerio.load(html);
      const anchors = this.source.config.discoveryAnchors || DEFAULT_DISCOVERY_ANCHORS;
      $("a[href]").each((_, el) => {
        const text = $(el).text().toLowerCase();
        const href = $(el).attr("href");
        if (!href) return;
        const normalized = new URL(href, resp.url || this.source.url).toString();
        if (anchors.some((a) => text.includes(a) || normalized.toLowerCase().includes(`/${a}`))) {
          candidates.add(normalized);
        }
      });
    } catch {
      // silent discovery failure is fine; fallbacks cover the gap
    }

    return Array.from(candidates);
  }

  /**
   * Fetch listing HTML; retry on 404 with generated fallbacks.
   */
  async fetchListing(url: string, fetcher: typeof fetch = createSpoofedFetch()): Promise<FetchListingResult> {
    const attempts = generatePathFallbacks(url);
    for (const candidate of attempts) {
      try {
        const response = await fetcher(candidate);
        const html = await response.text();
        if (response.status !== 404 && html.trim().length > 0) {
          return {
            status: response.status,
            html,
            finalUrl: response.url || candidate,
            headers: response.headers,
          };
        }
      } catch {
        // continue trying the next candidate
      }
    }

    // final fallback: return empty result for original URL
    return {
      status: 404,
      html: "",
      finalUrl: url,
      headers: new Headers(),
    };
  }

  async parseListing(
    html: string,
    finalUrl: string,
    context: StrategyContext = {}
  ): Promise<RawEventCard[]> {
    const structured = extractStructuredEvents(html, finalUrl);
    if (structured.length > 0) return structured;

    const $ = cheerio.load(html);
    const selectors = this.source.config.selectors && this.source.config.selectors.length > 0
      ? this.source.config.selectors
      : DEFAULT_SELECTORS;

    const seen = new Set<string>();
    const events: RawEventCard[] = [];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el);
        const title =
          $el.find("h1, h2, h3, h4").first().text().trim() ||
          $el.find('[class*=\"title\"]').first().text().trim() ||
          $el.find("a").first().text().trim();
        const dateText =
          $el.find("time").first().attr("datetime") ||
          $el.find("time").first().text() ||
          $el.find('[class*=\"date\"]').first().text();

        const isoDate = dateText ? parseToISODate(dateText) : null;
        if (!title || !isoDate) return;

        const dedupKey = `${title.toLowerCase()}|${isoDate}`;
        if (seen.has(dedupKey)) return;
        seen.add(dedupKey);

        const detailHref = $el.find("a").first().attr("href") || "";
        const detailUrl = detailHref ? new URL(detailHref, finalUrl).toString() : null;

        events.push({
          rawHtml: $el.html() || "",
          title,
          date: isoDate,
          location: $el.find(".location, .venue, address").first().text().trim(),
          imageUrl: $el.find("img").first().attr("src") || null,
          description: $el.find(".description, .excerpt, p").first().text().trim(),
          detailUrl,
        });
      });
    }

    if (context.enableDebug && events.length === 0) {
      console.log("DefaultStrategy: no events matched selectors");
    }

    return events;
  }
}
