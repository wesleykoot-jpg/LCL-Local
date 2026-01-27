/**
 * Page Fetcher: Multi-strategy page fetching with fallback chain
 * 
 * Strategies:
 * 1. Static (fetch) - Fast, no JS, for simple HTML pages
 * 2. Browserless (cloud Playwright) - Full JS rendering via WebSocket
 * 3. ScrapingBee - Anti-bot proxy with optional JS rendering
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.177.0/hash/mod.ts";

// Types
export type FetcherType = 'static' | 'playwright' | 'browserless' | 'scrapingbee';

export interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  fetcherUsed: FetcherType;
  durationMs: number;
  contentHash: string;
}

export interface FetchOptions {
  timeout?: number;
  waitForSelector?: string;
  userAgent?: string;
  proxy?: boolean;
  cookies?: Record<string, string>;
}

// Default options
const DEFAULT_OPTIONS: FetchOptions = {
  timeout: 30000,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/**
 * Main PageFetcher class with fallback chain
 */
export class PageFetcher {
  private supabase: ReturnType<typeof createClient>;
  private sourceId?: string;

  constructor(supabase: ReturnType<typeof createClient>, sourceId?: string) {
    this.supabase = supabase;
    this.sourceId = sourceId;
  }

  /**
   * Fetch a page using the specified strategy with fallback
   */
  async fetch(
    url: string,
    strategy: FetcherType = 'static',
    options: FetchOptions = {}
  ): Promise<FetchResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    // Define fallback chain based on starting strategy
    const fallbackChain = this.getFallbackChain(strategy);

    let lastError: Error | null = null;

    for (const fetcher of fallbackChain) {
      try {
        console.log(`[PageFetcher] Trying ${fetcher} for ${url}`);
        
        let result: FetchResult;

        switch (fetcher) {
          case 'static':
            result = await this.fetchStatic(url, opts);
            break;
          case 'browserless':
            result = await this.fetchBrowserless(url, opts);
            break;
          case 'scrapingbee':
            result = await this.fetchScrapingBee(url, opts);
            break;
          default:
            throw new Error(`Unknown fetcher: ${fetcher}`);
        }

        // Save raw page for delta detection
        if (this.sourceId) {
          await this.saveRawPage(url, result);
        }

        return result;

      } catch (error) {
        console.warn(`[PageFetcher] ${fetcher} failed: ${error}`);
        lastError = error instanceof Error ? error : new Error(String(error));
        // Continue to next fallback
      }
    }

    throw lastError || new Error('All fetchers failed');
  }

  /**
   * Get fallback chain based on starting strategy
   */
  private getFallbackChain(strategy: FetcherType): FetcherType[] {
    switch (strategy) {
      case 'static':
        return ['static', 'browserless', 'scrapingbee'];
      case 'browserless':
        return ['browserless', 'scrapingbee', 'static'];
      case 'scrapingbee':
        return ['scrapingbee', 'browserless'];
      case 'playwright':
        // Map playwright to browserless (cloud version)
        return ['browserless', 'scrapingbee'];
      default:
        return ['static', 'browserless', 'scrapingbee'];
    }
  }

  /**
   * Static fetch using standard HTTP
   */
  private async fetchStatic(url: string, opts: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': opts.userAgent!,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      });

      const html = await response.text();
      const contentHash = this.hashContent(html);

      return {
        html,
        finalUrl: response.url,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        fetcherUsed: 'static',
        durationMs: Date.now() - startTime,
        contentHash,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fetch using Browserless (cloud Playwright via WebSocket)
   */
  private async fetchBrowserless(url: string, opts: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const browserlessUrl = Deno.env.get('BROWSERLESS_WS_URL');
    const browserlessToken = Deno.env.get('BROWSERLESS_TOKEN');

    if (!browserlessUrl && !browserlessToken) {
      throw new Error('BROWSERLESS_WS_URL or BROWSERLESS_TOKEN not configured');
    }

    // Use HTTP API for simplicity (WebSocket requires more complex handling)
    const apiUrl = browserlessToken 
      ? `https://chrome.browserless.io/content?token=${browserlessToken}`
      : browserlessUrl?.replace('wss://', 'https://').replace('/chromium', '/content');

    const response = await fetch(apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: opts.timeout,
        },
        waitForSelector: opts.waitForSelector ? {
          selector: opts.waitForSelector,
          timeout: 10000,
        } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Browserless error: ${response.status} ${await response.text()}`);
    }

    const html = await response.text();
    const contentHash = this.hashContent(html);

    return {
      html,
      finalUrl: url, // Browserless doesn't return final URL in content API
      statusCode: 200,
      headers: {},
      fetcherUsed: 'browserless',
      durationMs: Date.now() - startTime,
      contentHash,
    };
  }

  /**
   * Fetch using ScrapingBee (anti-bot proxy)
   */
  private async fetchScrapingBee(url: string, opts: FetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const apiKey = Deno.env.get('SCRAPINGBEE_API_KEY');

    if (!apiKey) {
      throw new Error('SCRAPINGBEE_API_KEY not configured');
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      url: url,
      render_js: 'true',
      premium_proxy: opts.proxy ? 'true' : 'false',
      country_code: 'nl',
    });

    if (opts.waitForSelector) {
      params.set('wait_for', opts.waitForSelector);
    }

    const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ScrapingBee error: ${response.status} ${errorText}`);
    }

    const html = await response.text();
    const contentHash = this.hashContent(html);

    return {
      html,
      finalUrl: response.headers.get('Spb-Resolved-Url') || url,
      statusCode: parseInt(response.headers.get('Spb-Initial-Status-Code') || '200'),
      headers: Object.fromEntries(response.headers.entries()),
      fetcherUsed: 'scrapingbee',
      durationMs: Date.now() - startTime,
      contentHash,
    };
  }

  /**
   * Hash content for delta detection
   */
  private hashContent(content: string): string {
    // Remove dynamic content before hashing
    const normalized = content
      .replace(/\b(csrf|token|nonce|timestamp|session)[^"'\s]*/gi, '')
      .replace(/\d{13,}/g, '') // Remove timestamps
      .replace(/[\s]+/g, ' ')
      .trim();

    const hash = createHash("sha256");
    hash.update(normalized);
    return hash.toString();
  }

  /**
   * Save raw page HTML to database for delta detection and healing
   */
  private async saveRawPage(url: string, result: FetchResult): Promise<void> {
    try {
      await this.supabase.from('raw_pages').insert({
        source_id: this.sourceId,
        url,
        final_url: result.finalUrl,
        html: result.html,
        content_hash: result.contentHash,
        status_code: result.statusCode,
        headers: result.headers,
        fetcher_used: result.fetcherUsed,
        fetch_duration_ms: result.durationMs,
      });
    } catch (error) {
      console.warn(`[PageFetcher] Failed to save raw page: ${error}`);
    }
  }

  /**
   * Check if content has changed since last fetch
   */
  async hasContentChanged(url: string, currentHash: string): Promise<boolean> {
    if (!this.sourceId) return true;

    const { data } = await this.supabase
      .from('raw_pages')
      .select('content_hash')
      .eq('source_id', this.sourceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return true;
    return data.content_hash !== currentHash;
  }
}

/**
 * Create a PageFetcher instance with Supabase client
 */
export function createPageFetcher(
  supabase: ReturnType<typeof createClient>,
  sourceId?: string
): PageFetcher {
  return new PageFetcher(supabase, sourceId);
}

/**
 * Simple fetch function for one-off fetches
 */
export async function fetchPage(
  url: string,
  strategy: FetcherType = 'static',
  options: FetchOptions = {}
): Promise<FetchResult> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const fetcher = new PageFetcher(supabase);
  return fetcher.fetch(url, strategy, options);
}
