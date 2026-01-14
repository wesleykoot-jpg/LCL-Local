import type { ScraperSource, RawEventCard } from "./shared.ts";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

const DEFAULT_HEADERS = {
  "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

/**
 * PageFetcher interface for abstracting HTML fetching logic.
 * Separates retrieval from parsing to support different fetching strategies
 * (static HTTP requests vs. headless browser rendering).
 */
export interface PageFetcher {
  /**
   * Fetches a page and returns its HTML content along with metadata.
   * @param url - The URL to fetch
   * @returns Object containing html, finalUrl (after redirects), and statusCode
   */
  fetchPage(url: string): Promise<{
    html: string;
    finalUrl: string;
    statusCode: number;
  }>;
}

/**
 * StaticPageFetcher implements PageFetcher using standard HTTP requests.
 * Uses user-agent spoofing and custom headers to mimic browser behavior.
 * This is the default fetcher for most scraping operations.
 */
export class StaticPageFetcher implements PageFetcher {
  private defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                  '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  };

  constructor(
    private fetchImpl: typeof fetch = fetch,
    private customHeaders?: Record<string, string>,
    private timeout?: number
  ) {}

  async fetchPage(url: string) {
    const headers = { ...this.defaultHeaders, ...(this.customHeaders || {}) };
    const timeoutMs = this.timeout ?? 15000;

    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const html = await res.text();
    const finalUrl = res.url || url;
    const statusCode = res.status;

    return { html, finalUrl, statusCode };
  }
}

/**
 * DynamicPageFetcher is a placeholder for future headless browser support.
 * TODO: Implement using Puppeteer, Playwright, or a service like ScrapingBee
 * to handle JavaScript-rendered pages and anti-bot protections.
 */
export class DynamicPageFetcher implements PageFetcher {
  async fetchPage(url: string) {
    // TODO: implement headless-browser rendering (Puppeteer/Playwright/ScrapingBee)
    // For now, return an error-like response to signal unimplemented
    console.warn(`DynamicPageFetcher not yet implemented for: ${url}`);
    return {
      html: '',
      finalUrl: url,
      statusCode: 501, // Not Implemented
    };
  }
}

/**
 * Factory function to create the appropriate PageFetcher for a source.
 * TODO: Read fetcher type from scraper_sources.config.fetcher field
 * to support per-source configuration of 'static' vs 'dynamic' fetching.
 * 
 * @param source - The scraper source configuration
 * @returns A PageFetcher instance (StaticPageFetcher or DynamicPageFetcher)
 */
export function createFetcherForSource(source: ScraperSource): PageFetcher {
  // TODO: Add 'fetcher' field to scraper_sources config and read it here
  // Example: if (source.config.fetcher === 'dynamic') return new DynamicPageFetcher();
  
  const customHeaders = source.config.headers;
  const timeout = 15000; // default timeout
  
  return new StaticPageFetcher(fetch, customHeaders, timeout);
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * @deprecated Use StaticPageFetcher directly instead.
 * This function is kept for backward compatibility.
 */
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
  
  // Add base URL
  paths.add(baseUrl);
  
  // Common event page paths
  const commonPaths = [
    "/agenda",
    "/evenementen",
    "/events",
    "/programma",
    "/kalender",
    "/activiteiten",
    "/wat-te-doen",
    "/uitagenda",
    ...hints,
  ];
  
  for (const path of commonPaths) {
    paths.add(`${url.protocol}//${url.host}${path}`);
  }
  
  return Array.from(paths);
}

export interface ScraperStrategy {
  discoverListingUrls(fetcher: PageFetcher): Promise<string[]>;
  fetchListing(url: string, fetcher: PageFetcher): Promise<{ status: number; html: string; finalUrl: string }>;
  parseListing(html: string, listingUrl: string, options?: { enableDebug?: boolean; fetcher?: PageFetcher }): Promise<RawEventCard[]>;
}

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

export class DefaultStrategy implements ScraperStrategy {
  protected source: ScraperSource;

  constructor(source: ScraperSource) {
    this.source = source;
  }

  async discoverListingUrls(_fetcher: PageFetcher): Promise<string[]> {
    const hints = [
      ...(this.source.config.discoveryAnchors || []),
      ...(this.source.config.alternatePaths || []),
    ];
    return generatePathFallbacks(this.source.url, hints);
  }

  async fetchListing(url: string, fetcher: PageFetcher): Promise<{ status: number; html: string; finalUrl: string }> {
    try {
      const { html, finalUrl, statusCode } = await fetcher.fetchPage(url);
      return { status: statusCode, html, finalUrl };
    } catch (error) {
      console.warn(`Fetch failed for ${url}:`, error);
      return { status: 500, html: "", finalUrl: url };
    }
  }

  async parseListing(
    html: string,
    listingUrl: string,
    _options?: { enableDebug?: boolean; fetcher?: PageFetcher }
  ): Promise<RawEventCard[]> {
    const $ = cheerio.load(html);
    const results: RawEventCard[] = [];
    const selectors = this.source.config.selectors || SELECTORS;

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = $(el);
        const rawHtml = $.html(el);

        // Extract title
        const title = $el.find("h1, h2, h3, h4, .title, [class*='title']").first().text().trim() ||
          $el.find("a").first().text().trim();

        if (!title || title.length < 3) return;

        // Extract date
        const dateText = $el.find("time, .date, [class*='date'], [datetime]").first().text().trim() ||
          $el.attr("datetime") || "";

        // Extract location
        const location = $el.find(".location, .venue, [class*='location'], [class*='venue']").first().text().trim() ||
          this.source.name;

        // Extract description
        const description = $el.find("p, .description, .excerpt, [class*='description']").first().text().trim();

        // Extract detail URL
        const detailUrl = $el.find("a").first().attr("href") || $el.attr("href") || "";
        const fullDetailUrl = detailUrl.startsWith("http")
          ? detailUrl
          : detailUrl.startsWith("/")
            ? `${new URL(listingUrl).origin}${detailUrl}`
            : "";

        // Extract image
        const imageUrl = $el.find("img").first().attr("src") ||
          $el.find("[style*='background']").first().attr("style")?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1] ||
          null;

        results.push({
          title,
          date: dateText,
          location,
          description,
          detailUrl: fullDetailUrl,
          imageUrl,
          rawHtml,
        });
      });

      if (results.length > 0) break;
    }

    return results;
  }
}

export function resolveStrategy(name: string | undefined, source: ScraperSource): ScraperStrategy {
  // For now, always use DefaultStrategy
  // Future: add platform-specific strategies
  return new DefaultStrategy(source);
}
