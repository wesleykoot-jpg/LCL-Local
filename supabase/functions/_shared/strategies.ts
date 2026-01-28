import type { ScraperSource, RawEventCard } from "./types.ts";
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
  config: RetryConfig = {},
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
        maxDelayMs,
      );

      console.log(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms delay`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error("Operation failed after retries");
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
   * @returns Object containing html, finalUrl (after redirects), statusCode, and headers
   */
  fetchPage(url: string): Promise<{
    html: string;
    finalUrl: string;
    statusCode: number;
    headers?: Headers;
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
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  };

  constructor(
    private fetchImpl: typeof fetch = fetch,
    private customHeaders?: Record<string, string>,
    private timeout?: number,
    private retryConfig?: RetryConfig,
  ) {}

  async fetchPage(url: string) {
    const headers = { ...this.defaultHeaders, ...(this.customHeaders || {}) };
    const timeoutMs = this.timeout ?? 15000;

    return retryWithBackoff(async () => {
      const res = await this.fetchImpl(url, {
        method: "GET",
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
      });

      const html = await res.text();
      const finalUrl = res.url || url;
      const statusCode = res.status;

      return { html, finalUrl, statusCode, headers: res.headers };
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
    private fetcherType:
      | "puppeteer"
      | "playwright"
      | "scrapingbee" = "puppeteer",
    private config?: {
      apiKey?: string;
      headless?: boolean;
      waitForSelector?: string;
      waitForTimeout?: number;
    },
    private retryConfig?: RetryConfig,
  ) {}

  async fetchPage(url: string) {
    return retryWithBackoff(async () => {
      switch (this.fetcherType) {
        case "scrapingbee":
          return await this.fetchWithScrapingBee(url);
        case "puppeteer":
          return await this.fetchWithPuppeteer(url);
        case "playwright":
          return await this.fetchWithPlaywright(url);
        default:
          throw new Error(`Unsupported fetcher type: ${this.fetcherType}`);
      }
    }, this.retryConfig);
  }

  private async fetchWithScrapingBee(url: string) {
    const apiKey = this.config?.apiKey || Deno.env.get("SCRAPINGBEE_API_KEY");

    if (!apiKey) {
      console.warn(
        "ScrapingBee API key not found, falling back to static fetch",
      );
      return await this.fallbackToStaticFetch(url);
    }

    // Basic API key validation
    if (typeof apiKey !== "string" || apiKey.length < 20) {
      console.warn(
        "ScrapingBee API key appears invalid, falling back to static fetch",
      );
      return await this.fallbackToStaticFetch(url);
    }

    try {
      const scrapingBeeUrl = new URL("https://app.scrapingbee.com/api/v1/");
      scrapingBeeUrl.searchParams.set("api_key", apiKey);
      scrapingBeeUrl.searchParams.set("url", url);
      scrapingBeeUrl.searchParams.set("render_js", "true");

      if (this.config?.waitForTimeout) {
        scrapingBeeUrl.searchParams.set(
          "wait",
          String(this.config.waitForTimeout),
        );
      }

      const response = await fetch(scrapingBeeUrl.toString());

      if (!response.ok) {
        throw new Error(
          `ScrapingBee API error: ${response.status} ${response.statusText}`,
        );
      }

      const html = await response.text();
      return {
        html,
        finalUrl: url,
        statusCode: response.status,
        headers: response.headers,
      };
    } catch (error) {
      console.error("ScrapingBee fetch failed:", error);
      throw error;
    }
  }

  private async fetchWithPuppeteer(url: string) {
    try {
      // Attempt to import puppeteer dynamically
      // This will work in environments where puppeteer is available
      const puppeteer = await import("npm:puppeteer@23.11.1").catch(() => null);

      if (!puppeteer) {
        console.warn("Puppeteer not available, falling back to static fetch");
        return await this.fallbackToStaticFetch(url);
      }

      const browser = await puppeteer.default.launch({
        headless: this.config?.headless ?? true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      try {
        const page = await browser.newPage();
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        );

        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: this.config?.waitForTimeout || 30000,
        });

        if (this.config?.waitForSelector) {
          const selectorTimeout = this.config?.waitForTimeout || 10000;
          await page
            .waitForSelector(this.config.waitForSelector, {
              timeout: selectorTimeout,
            })
            .catch(() => {
              console.warn(
                `Selector ${this.config?.waitForSelector} not found, continuing anyway`,
              );
            });
        }

        const html = await page.content();
        const finalUrl = page.url();

        return {
          html,
          finalUrl,
          statusCode: 200,
          headers: undefined, // Headless browsers don't expose response headers directly
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error("Puppeteer fetch failed:", error);
      throw error;
    }
  }

  private async fetchWithPlaywright(url: string) {
    try {
      // Attempt to import playwright dynamically
      const playwright = await import("npm:playwright@1.49.1").catch(
        () => null,
      );

      if (!playwright) {
        console.warn("Playwright not available, falling back to static fetch");
        return await this.fallbackToStaticFetch(url);
      }

      const browser = await playwright.chromium.launch({
        headless: this.config?.headless ?? true,
      });

      try {
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        });

        const page = await context.newPage();
        await page.goto(url, {
          waitUntil: "networkidle",
          timeout: this.config?.waitForTimeout || 30000,
        });

        if (this.config?.waitForSelector) {
          const selectorTimeout = this.config?.waitForTimeout || 10000;
          await page
            .waitForSelector(this.config.waitForSelector, {
              timeout: selectorTimeout,
            })
            .catch(() => {
              console.warn(
                `Selector ${this.config?.waitForSelector} not found, continuing anyway`,
              );
            });
        }

        const html = await page.content();
        const finalUrl = page.url();

        return {
          html,
          finalUrl,
          statusCode: 200,
          headers: undefined, // Headless browsers don't expose response headers directly
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error("Playwright fetch failed:", error);
      throw error;
    }
  }

  private async fallbackToStaticFetch(url: string): Promise<{
    html: string;
    finalUrl: string;
    statusCode: number;
    headers?: Headers;
  }> {
    console.log("Using static fetch fallback");
    const fetcher = new StaticPageFetcher(
      fetch,
      undefined,
      undefined,
      this.retryConfig,
    );
    return await fetcher.fetchPage(url);
  }
}

/**
 * FailoverPageFetcher implements automatic failover between static and dynamic fetchers.
 * If static fetching fails 3 times in a row, it automatically switches to dynamic fetching
 * (ScrapingBee) for the remainder of the session.
 */
export class FailoverPageFetcher implements PageFetcher {
  private staticFetcher: PageFetcher;
  private dynamicFetcher: PageFetcher | null = null;
  private failureCount = 0;
  private maxFailuresBeforeFailover = 3;
  private hasFailedOver = false;
  private source: ScraperSource;

  constructor(source: ScraperSource) {
    this.source = source;

    // Create static fetcher as primary
    const retryConfig: RetryConfig = {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    };

    this.staticFetcher = new StaticPageFetcher(
      fetch,
      source.config?.headers,
      15000,
      retryConfig,
    );

    // Pre-create dynamic fetcher if ScrapingBee key is available
    if (
      source.config?.scrapingbee_api_key ||
      Deno.env.get("SCRAPINGBEE_API_KEY")
    ) {
      const dynamicConfig = {
        apiKey:
          source.config?.scrapingbee_api_key ||
          Deno.env.get("SCRAPINGBEE_API_KEY"),
        headless: source.config?.headless ?? true,
        waitForSelector: source.config?.wait_for_selector,
        waitForTimeout: source.config?.wait_for_timeout,
      };

      this.dynamicFetcher = new DynamicPageFetcher(
        "scrapingbee",
        dynamicConfig,
        retryConfig,
      );
    }
  }

  async fetchPage(
    url: string,
  ): Promise<{ html: string; finalUrl: string; statusCode: number }> {
    // If already failed over, use dynamic fetcher
    if (this.hasFailedOver && this.dynamicFetcher) {
      console.log(
        `Using dynamic fetcher (failover active) for ${this.source.name}`,
      );
      return await this.dynamicFetcher.fetchPage(url);
    }

    try {
      // Try static fetcher first
      const result = await this.staticFetcher.fetchPage(url);

      // Reset failure count on success
      this.failureCount = 0;

      return result;
    } catch (error) {
      // Increment failure count
      this.failureCount++;
      console.warn(
        `Static fetch failed (${this.failureCount}/${this.maxFailuresBeforeFailover}) for ${this.source.name}:`,
        error,
      );

      // Check if we should fail over
      if (
        this.failureCount >= this.maxFailuresBeforeFailover &&
        this.dynamicFetcher &&
        !this.hasFailedOver
      ) {
        this.hasFailedOver = true;
        console.log(
          `Failing over to dynamic fetcher for ${this.source.name} after ${this.failureCount} failures`,
        );

        // Retry with dynamic fetcher
        return await this.dynamicFetcher.fetchPage(url);
      }

      // Re-throw if we can't fail over
      throw error;
    }
  }
}

/**
 * Factory function to create the appropriate PageFetcher for a source.
 * Reads fetcher_type from scraper_sources to support per-source configuration
 * of 'static' vs 'dynamic' fetching strategies.
 *
 * Now includes automatic failover: if static fetching fails 3 times, it pivots to
 * dynamic fetching (ScrapingBee) for the session.
 *
 * @param source - The scraper source configuration
 * @param options - Optional configuration, including useProxy to force proxy usage
 * @returns A PageFetcher instance (with failover capability)
 */
export function createFetcherForSource(
  source: ScraperSource,
  options: { useProxy?: boolean } = {},
): PageFetcher {
  const fetcherType = source.fetcher_type || "static";
  const retryConfig: RetryConfig = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  };

  const dynamicConfig = {
    apiKey:
      source.config.scrapingbee_api_key || Deno.env.get("SCRAPINGBEE_API_KEY"),
    headless: source.config.headless ?? true,
    waitForSelector: source.config.wait_for_selector,
    waitForTimeout: source.config.wait_for_timeout,
  };

  // If proxy is explicitly requested (e.g. for retries), force usage of ScrapingBee
  if (options.useProxy) {
    console.log(`Using proxy (ScrapingBee) for ${source.name} as requested`);
    return new DynamicPageFetcher("scrapingbee", dynamicConfig, retryConfig);
  }

  // Use failover fetcher for static sources (automatic pivot to dynamic if needed)
  if (fetcherType === "static") {
    return new FailoverPageFetcher(source);
  }

  // Dynamic fetchers (Puppeteer, Playwright, ScrapingBee) - no failover needed
  return new DynamicPageFetcher(
    fetcherType as "puppeteer" | "playwright" | "scrapingbee",
    dynamicConfig,
    retryConfig,
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

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    return fetch(url, {
      ...init,
      headers: { ...mergedHeaders, ...(init?.headers || {}) },
      signal: AbortSignal.timeout(timeout),
    });
  };
}

export function generatePathFallbacks(
  baseUrl: string,
  hints: string[] = [],
): string[] {
  const url = new URL(baseUrl);
  const paths = new Set<string>();
  paths.add(baseUrl);
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
  fetchListing(
    url: string,
    fetcher: PageFetcher,
  ): Promise<{
    status: number;
    html: string;
    finalUrl: string;
    headers?: Headers;
  }>;
  parseListing(
    html: string,
    listingUrl: string,
    options?: { enableDebug?: boolean; fetcher?: PageFetcher },
  ): Promise<{ events: RawEventCard[]; nextPageUrl?: string }>;
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
  ".datum-item",
  ".activity-card",
  ".card--event",
  ".event-list-item",
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

  async fetchListing(
    url: string,
    fetcher: PageFetcher,
  ): Promise<{
    status: number;
    html: string;
    finalUrl: string;
    headers?: Headers;
  }> {
    try {
      const { html, finalUrl, statusCode, headers } =
        await fetcher.fetchPage(url);
      return { status: statusCode, html, finalUrl, headers };
    } catch (error) {
      console.warn(`Fetch failed for ${url}:`, error);
      return { status: 500, html: "", finalUrl: url, headers: undefined };
    }
  }

  async parseListing(
    html: string,
    listingUrl: string,
    _options?: { enableDebug?: boolean; fetcher?: PageFetcher },
  ): Promise<{ events: RawEventCard[]; nextPageUrl?: string }> {
    // Dynamic import to avoid circular dependencies
    const { runExtractionWaterfall } = await import("./dataExtractors.ts");
    const { fingerprintCMS } = await import("./cmsFingerprinter.ts");

    // 1. Light Check (Fingerprinting)
    // This understands which method to try first based on the HTML content
    const fingerprint = fingerprintCMS(html);

    // 2. Determine preferred method
    // If user set a specific method, use it. Otherwise, use the fingerprint's top recommendation.
    const method = this.source.preferred_method || "auto";
    let preferredMethod = method as any;

    if (method === "auto" && fingerprint.recommendedStrategies.length > 0) {
      preferredMethod = fingerprint.recommendedStrategies[0];
      if (_options?.enableDebug) {
        console.log(
          `[Fingerprint] Detected ${fingerprint.cms} for ${this.source.name}. Optimization: Trying ${preferredMethod} first.`,
        );
      }
    }

    // 3. Run all in optimized order
    const result = await runExtractionWaterfall(html, {
      baseUrl: listingUrl,
      sourceName: this.source.name,
      preferredMethod: preferredMethod,
      feedDiscovery: this.source.config?.feed_discovery ?? false,
      domSelectors: this.source.config?.selectors,
      fetcher: {
        fetch: async (url: string) => {
          const f = new StaticPageFetcher();
          const res = await f.fetchPage(url);
          return { html: res.html, status: res.statusCode };
        },
      },
    });

    console.log(
      `[Waterfall] Source: ${this.source.name} | CMS: ${fingerprint.cms} | Strategy: ${result.winningStrategy || "NONE"} | Found: ${result.totalEvents}`,
    );

    // 4. Pagination Discovery
    let nextPageUrl: string | undefined;
    try {
      const $ = cheerio.load(html);
      const nextEl = $(
        'a[rel="next"], .pagination .next, a:contains("Volgende"), a:contains("Next")',
      )
        .filter((_, el) => {
          // Basic filter to ensure it's likely a pagination link
          const href = $(el).attr("href");
          return !!href && href.length > 2;
        })
        .first();

      const relativeUrl = nextEl.attr("href");
      if (relativeUrl) {
        try {
          nextPageUrl = new URL(relativeUrl, listingUrl).href;
        } catch {
          // ignore invalid URLs
        }
      }
    } catch (err) {
      console.warn(`Pagination discovery failed for ${this.source.name}:`, err);
    }

    // events already tagged with parsingMethod by dataExtractors.ts update
    return { events: result.events, nextPageUrl };
  }
}

export function resolveStrategy(
  name: string | undefined,
  source: ScraperSource,
): ScraperStrategy {
  // For now, always use DefaultStrategy
  // Future: add platform-specific strategies
  return new DefaultStrategy(source);
}
