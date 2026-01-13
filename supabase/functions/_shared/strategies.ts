import type { ScraperSource, RawEventCard } from "./types.ts";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

const DEFAULT_HEADERS = {
  "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export function createSpoofedFetch(options: FetchOptions = {}): typeof fetch {
  const mergedHeaders = { ...DEFAULT_HEADERS, ...options.headers };
  const timeout = options.timeout ?? 15000;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return fetch(url, {
      ...init,
      headers: { ...mergedHeaders, ...(init?.headers || {}) },
      signal: AbortSignal.timeout(timeout),
    });
  };
}

export function generatePathFallbacks(baseUrl: string, hints: string[] = []): string[] {
  const url = new URL(baseUrl);
  const paths = new Set<string>();
  paths.add(baseUrl);
  const commonPaths = ["/agenda", "/evenementen", "/events", "/programma", "/kalender", "/activiteiten", "/wat-te-doen", "/uitagenda", ...hints];
  for (const path of commonPaths) {
    paths.add(`${url.protocol}//${url.host}${path}`);
  }
  return Array.from(paths);
}

export interface ScraperStrategy {
  discoverListingUrls(fetcher: typeof fetch): Promise<string[]>;
  fetchListing(url: string, fetcher: typeof fetch): Promise<{ status: number; html: string; finalUrl: string }>;
  parseListing(html: string, listingUrl: string, options?: { enableDebug?: boolean; fetcher?: typeof fetch }): Promise<RawEventCard[]>;
}

const SELECTORS = [
  "article.event", ".event-item", ".event-card", "[itemtype*='Event']", ".agenda-item",
  ".calendar-event", "[class*='event']", "[class*='agenda']", "li.event", ".post-item",
];

export class DefaultStrategy implements ScraperStrategy {
  protected source: ScraperSource;

  constructor(source: ScraperSource) {
    this.source = source;
  }

  async discoverListingUrls(_fetcher: typeof fetch): Promise<string[]> {
    const hints = [...(this.source.config.discoveryAnchors || []), ...(this.source.config.alternatePaths || [])];
    return generatePathFallbacks(this.source.url, hints);
  }

  async fetchListing(url: string, fetcher: typeof fetch): Promise<{ status: number; html: string; finalUrl: string }> {
    try {
      const response = await fetcher(url, { method: "GET" });
      const html = await response.text();
      return { status: response.status, html, finalUrl: response.url || url };
    } catch (error) {
      console.warn(`Fetch failed for ${url}:`, error);
      return { status: 500, html: "", finalUrl: url };
    }
  }

  async parseListing(html: string, listingUrl: string, _options?: { enableDebug?: boolean; fetcher?: typeof fetch }): Promise<RawEventCard[]> {
    const $ = cheerio.load(html);
    const results: RawEventCard[] = [];
    const selectors = this.source.config.selectors || SELECTORS;

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = $(el);
        const rawHtml = $.html(el);
        const title = $el.find("h1, h2, h3, h4, .title, [class*='title']").first().text().trim() || $el.find("a").first().text().trim();
        if (!title || title.length < 3) return;

        const dateText = $el.find("time, .date, [class*='date'], [datetime]").first().text().trim() || $el.attr("datetime") || "";
        const location = $el.find(".location, .venue, [class*='location'], [class*='venue']").first().text().trim() || this.source.name;
        const description = $el.find("p, .description, .excerpt, [class*='description']").first().text().trim();
        const detailUrl = $el.find("a").first().attr("href") || $el.attr("href") || "";
        const fullDetailUrl = detailUrl.startsWith("http") ? detailUrl : detailUrl.startsWith("/") ? `${new URL(listingUrl).origin}${detailUrl}` : "";
        const imageUrl = $el.find("img").first().attr("src") || $el.find("[style*='background']").first().attr("style")?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] || null;

        results.push({ title, date: dateText, location, description, detailUrl: fullDetailUrl, imageUrl, rawHtml });
      });

      if (results.length > 0) break;
    }

    return results;
  }
}

export function resolveStrategy(_name: string | undefined, source: ScraperSource): ScraperStrategy {
  return new DefaultStrategy(source);
}