import type { ScraperSource, RawEventCard } from "./types.ts";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

const DEFAULT_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; Samsung Galaxy S23) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Samsung Galaxy S22) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

export function createSpoofedFetch(options: FetchOptions = {}): typeof fetch {
  const mergedHeaders = { ...DEFAULT_HEADERS, ...options.headers };
  const timeout = options.timeout ?? 15000;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const headers = { ...mergedHeaders, ...(init?.headers || {}) };
    headers["User-Agent"] = getRandomUserAgent();
    return fetch(url, {
      ...init,
      headers,
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
    const selectors = this.source.config.selectors;
    if (!selectors || selectors.length === 0) {
      console.warn(`No selectors configured for source ${this.source.name}`);
      return results;
    }

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
