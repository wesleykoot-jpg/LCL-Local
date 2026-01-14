import type { ScraperSource, RawEventCard, FetcherType } from "./shared.ts";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";

const DEFAULT_HEADERS = {
  "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

/**
 * Retry configuration for fetcher operations
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Implements exponential backoff retry logic
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delayMs = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );
      
      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

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
 * Includes retry logic with exponential backoff for transient failures.
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
    private timeout?: number,
    private retryConfig?: RetryConfig
  ) {}

  async fetchPage(url: string) {
    const headers = { ...this.defaultHeaders, ...(this.customHeaders || {}) };
    const timeoutMs = this.timeout ?? 15000;

    return retryWithBackoff(async () => {
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
    }, this.retryConfig);
  }
}

/**
 * DynamicPageFetcher implements PageFetcher using headless browser rendering.
 * Supports Puppeteer, Playwright, and ScrapingBee for JavaScript-rendered pages
 * and handling anti-bot protections.
 * 
 * Note: This implementation uses conditional logic based on available libraries.
 * Libraries are optional dependencies and loaded dynamically when needed.
 */
export class DynamicPageFetcher implements PageFetcher {
  constructor(
    private fetcherType: 'puppeteer' | 'playwright' | 'scrapingbee' = 'puppeteer',
    private config?: {
      apiKey?: string;
      headless?: boolean;
      waitForSelector?: string;
      waitForTimeout?: number;
    },
    private retryConfig?: RetryConfig
  ) {}

  async fetchPage(url: string) {
    return retryWithBackoff(async () => {
      switch (this.fetcherType) {
        case 'scrapingbee':
          return await this.fetchWithScrapingBee(url);
        case 'puppeteer':
          return await this.fetchWithPuppeteer(url);
        case 'playwright':
          return await this.fetchWithPlaywright(url);
        default:
          throw new Error(`Unsupported fetcher type: ${this.fetcherType}`);
      }
    }, this.retryConfig);
  }

  private async fetchWithScrapingBee(url: string) {
    const apiKey = this.config?.apiKey || Deno.env.get('SCRAPINGBEE_API_KEY');
    
    if (!apiKey) {
      console.warn('ScrapingBee API key not found, falling back to static fetch');
      return await this.fallbackToStaticFetch(url);
    }

    try {
      const scrapingBeeUrl = new URL('https://app.scrapingbee.com/api/v1/');
      scrapingBeeUrl.searchParams.set('api_key', apiKey);
      scrapingBeeUrl.searchParams.set('url', url);
      scrapingBeeUrl.searchParams.set('render_js', 'true');
      
      if (this.config?.waitForTimeout) {
        scrapingBeeUrl.searchParams.set('wait', String(this.config.waitForTimeout));
      }

      const response = await fetch(scrapingBeeUrl.toString());
      
      if (!response.ok) {
        throw new Error(`ScrapingBee API error: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return {
        html,
        finalUrl: url,
        statusCode: response.status,
      };
    } catch (error) {
      console.error('ScrapingBee fetch failed:', error);
      throw error;
    }
  }

  private async fetchWithPuppeteer(url: string) {
    try {
      // Attempt to import puppeteer dynamically
      // This will work in environments where puppeteer is available
      const puppeteer = await import('npm:puppeteer@23.11.1').catch(() => null);
      
      if (!puppeteer) {
        console.warn('Puppeteer not available, falling back to static fetch');
        return await this.fallbackToStaticFetch(url);
      }

      const browser = await puppeteer.default.launch({
        headless: this.config?.headless ?? true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        );

        await page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: this.config?.waitForTimeout || 30000 
        });

        if (this.config?.waitForSelector) {
          await page.waitForSelector(this.config.waitForSelector, {
            timeout: 10000,
          }).catch(() => {
            console.warn(`Selector ${this.config?.waitForSelector} not found, continuing anyway`);
          });
        }

        const html = await page.content();
        const finalUrl = page.url();

        return {
          html,
          finalUrl,
          statusCode: 200,
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('Puppeteer fetch failed:', error);
      throw error;
    }
  }

  private async fetchWithPlaywright(url: string) {
    try {
      // Attempt to import playwright dynamically
      const playwright = await import('npm:playwright@1.49.1').catch(() => null);
      
      if (!playwright) {
        console.warn('Playwright not available, falling back to static fetch');
        return await this.fallbackToStaticFetch(url);
      }

      const browser = await playwright.chromium.launch({
        headless: this.config?.headless ?? true,
      });

      try {
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                    '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        });

        const page = await context.newPage();
        await page.goto(url, { 
          waitUntil: 'networkidle',
          timeout: this.config?.waitForTimeout || 30000 
        });

        if (this.config?.waitForSelector) {
          await page.waitForSelector(this.config.waitForSelector, {
            timeout: 10000,
          }).catch(() => {
            console.warn(`Selector ${this.config?.waitForSelector} not found, continuing anyway`);
          });
        }

        const html = await page.content();
        const finalUrl = page.url();

        return {
          html,
          finalUrl,
          statusCode: 200,
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error('Playwright fetch failed:', error);
      throw error;
    }
  }

  private async fallbackToStaticFetch(url: string): Promise<{ html: string; finalUrl: string; statusCode: number }> {
    console.log('Using static fetch fallback');
    const fetcher = new StaticPageFetcher();
    return await fetcher.fetchPage(url);
  }
}

/**
 * Factory function to create the appropriate PageFetcher for a source.
 * Reads fetcher_type from scraper_sources to support per-source configuration
 * of 'static' vs 'dynamic' fetching strategies.
 * 
 * @param source - The scraper source configuration
 * @returns A PageFetcher instance (StaticPageFetcher or DynamicPageFetcher)
 */
export function createFetcherForSource(source: ScraperSource): PageFetcher {
  const fetcherType = source.fetcher_type || 'static';
  const customHeaders = source.config.headers;
  const timeout = 15000; // default timeout
  
  const retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  };

  // Static fetcher (default)
  if (fetcherType === 'static') {
    return new StaticPageFetcher(fetch, customHeaders, timeout, retryConfig);
  }

  // Dynamic fetchers (Puppeteer, Playwright, ScrapingBee)
  const dynamicConfig = {
    apiKey: source.config.scrapingbee_api_key,
    headless: source.config.headless ?? true,
    waitForSelector: source.config.wait_for_selector,
    waitForTimeout: source.config.wait_for_timeout,
  };

  return new DynamicPageFetcher(
    fetcherType as 'puppeteer' | 'playwright' | 'scrapingbee',
    dynamicConfig,
    retryConfig
  );
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * @deprecated Use StaticPageFetcher directly instead.
 * This function is kept for backward compatibility.
 * 
 * Migration example:
 * ```typescript
 * // Old way:
 * const fetcher = createSpoofedFetch({ headers: customHeaders });
 * const response = await fetcher(url, { method: "GET" });
 * 
 * // New way:
 * const fetcher = new StaticPageFetcher(fetch, customHeaders);
 * const { html, finalUrl, statusCode } = await fetcher.fetchPage(url);
 * ```
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
