import type { ScraperSource } from "../supabase/functions/scrape-events/shared.ts";

/**
 * Raw representation of an event card extracted from a listing page.
 * Strategies should provide lightweight data only; normalization happens in the Edge Function.
 */
export type RawEventCard = {
  rawHtml: string;
  title: string;
  date: string;
  location: string;
  imageUrl: string | null;
  description: string;
  detailUrl: string | null;
  detailPageTime?: string;
  categoryHint?: string;
};

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

export interface ScraperStrategy {
  discoverListingUrls(fetcher?: typeof fetch): Promise<string[]>;
  fetchListing(url: string, fetcher?: typeof fetch): Promise<FetchListingResult>;
  parseListing(html: string, finalUrl: string, context?: StrategyContext): Promise<RawEventCard[]>;
  fetchAndParseDetail?(
    url: string,
    baseUrl: string,
    fetcher?: typeof fetch
  ): Promise<Partial<RawEventCard> | null>;
}

/**
 * Creates a fetch wrapper that spoofs a modern browser.
 * Ensures consistent headers, language, and conservative timeouts for Edge Functions.
 */
export function createSpoofedFetch(options: { headers?: Record<string, string>; timeoutMs?: number } = {}) {
  const defaultHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  return (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(defaultHeaders);
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }
    if (init.headers) {
      const extra = new Headers(init.headers as HeadersInit);
      extra.forEach((value, key) => headers.set(key, value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12000);
    return fetch(input, { ...init, headers, signal: controller.signal }).finally(() => clearTimeout(timeout));
  };
}

/**
 * Generate defensive fallback paths for calendar URLs.
 * Useful when a year-specific path (e.g., /2026 or -2026) returns 404.
 */
export function generatePathFallbacks(url: string): string[] {
  const target = new URL(url);
  const parts = target.pathname.split("/").filter(Boolean);
  const candidates = new Set<string>();

  // Remove trailing year segment (e.g., /2026) or suffix (-2026)
  if (parts.length > 0) {
    const trimmed = [...parts];
    const last = trimmed[trimmed.length - 1];
    if (/^\d{4}$/.test(last)) {
      trimmed.pop();
      candidates.add(`/${trimmed.join("/")}`);
    }
    if (/-\d{4}$/.test(last)) {
      trimmed[trimmed.length - 1] = last.replace(/-\d{4}$/, "");
      candidates.add(`/${trimmed.join("/")}`);
    }
  }

  // Common Dutch agenda fallbacks
  ["/agenda", "/evenementen"].forEach((path) => candidates.add(path));

  // Ensure trailing slash variants
  const normalized = Array.from(candidates).flatMap((path) => [path, path.endsWith("/") ? path : `${path}/`]);
  const absolute = normalized.map((path) => new URL(path, `${target.protocol}//${target.host}`).toString());

  // Preserve original URL as last resort
  absolute.push(url);
  return Array.from(new Set(absolute));
}
