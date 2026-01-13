import type { RawEventCard, ScraperSource } from "../../supabase/functions/scrape-events/shared.ts";

export interface FetchListingResult {
  status: number;
  html: string;
  finalUrl: string;
  headers: Headers;
}

export interface StrategyContext {
  fetcher?: typeof fetch;
  enableDeepScraping?: boolean;
  enableDebug?: boolean;
}

export abstract class BaseStrategy {
  protected source: ScraperSource;

  constructor(source: ScraperSource) {
    this.source = source;
  }

  abstract discoverListingUrls(fetcher?: typeof fetch): Promise<string[]>;

  async fetchListing(url: string, fetcher: typeof fetch = fetch): Promise<FetchListingResult> {
    const response = await fetcher(url, { headers: this.source.config.headers || {} });
    const html = await response.text();
    return {
      status: response.status,
      html,
      finalUrl: response.url || url,
      headers: response.headers,
    };
  }

  abstract parseListing(
    html: string,
    finalUrl: string,
    context?: StrategyContext
  ): Promise<RawEventCard[]>;

  async fetchAndParseDetail(
    _url: string,
    _baseUrl: string,
    _fetcher: typeof fetch = fetch
  ): Promise<Partial<RawEventCard> | null> {
    return null;
  }
}
