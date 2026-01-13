import * as cheerio from "npm:cheerio@1.0.0-rc.12";

// RawEventCard type definition (moved here to avoid circular dependency)
export interface RawEventCard {
  title: string;
  date: string;
  location: string;
  description: string;
  detailUrl: string;
  imageUrl: string | null;
  rawHtml: string;
  categoryHint?: string;
  detailPageTime?: string;
}

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  requires_render?: boolean;
  last_probe_urls?: Record<string, unknown>;
  language?: string;
  country?: string;
  default_coordinates?: { lat: number; lng: number };
  config: {
    selectors?: string[];
    headers?: Record<string, string>;
    rate_limit_ms?: number;
    default_coordinates?: { lat: number; lng: number };
    language?: string;
    country?: string;
    dynamic_year?: boolean;
    discoveryAnchors?: string[];
    alternatePaths?: string[];
    requires_render?: boolean;
  };
}

// RawEventCard is now defined above

export const DEFAULT_HEADERS = {
  "User-Agent": "LCL-EventScraper/1.0 (Event aggregator for local social app)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en,nl;q=0.9,de;q=0.8",
};

function normalizeMatchedTime(hours: string, minutes: string, ampm?: string): string | null {
  let hourNum = parseInt(hours, 10);
  if (ampm) {
    const lower = ampm.toLowerCase();
    if (lower === "pm" && hourNum < 12) hourNum += 12;
    if (lower === "am" && hourNum === 12) hourNum = 0;
  }
  if (hourNum > 23) return null;
  return `${String(hourNum).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

export async function fetchEventDetailTime(
  detailUrl: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch
): Promise<string | null> {
  try {
    let fullUrl = detailUrl;
    if (detailUrl.startsWith("/")) {
      const urlObj = new URL(baseUrl);
      fullUrl = `${urlObj.protocol}//${urlObj.host}${detailUrl}`;
    } else if (!detailUrl.startsWith("http")) {
      fullUrl = `${baseUrl.replace(/\/$/, "")}/${detailUrl}`;
    }

    const response = await fetcher(fullUrl, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const pageText = $("body").text();

    const timePatterns = [
      /aanvang[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /vanaf\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /(\d{1,2})[.:h](\d{2})\s*uur/i,
      /beginn[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /ab\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /(\d{1,2})[.:h](\d{2})\s*uhr/i,
      /starts?\s*(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /from\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /doors?\s*(?:open\s*)?(?:at\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /start[:\s]*(?:om\s*)?(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /time[:\s]*(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /om\s+(\d{1,2})[.:h](\d{2})(?:\s*(am|pm))?/i,
      /(\d{1,2})[.:](\d{2})\s*[-–—]\s*\d{1,2}[.:]\d{2}(?:\s*(am|pm))?/i,
    ];

    const timeElements = [
      ".event-time",
      ".time",
      '[class*="time"]',
      '[class*="tijd"]',
      ".event-details",
      ".details",
      'meta[property="event:start_time"]',
      ".aanvang",
      '[class*="aanvang"]',
      ".beginn",
      '[class*="beginn"]',
    ];

    for (const selector of timeElements) {
      const el = $(selector);
      if (el.length > 0) {
        const elText = el.text() || el.attr("content") || "";
        for (const pattern of timePatterns) {
          const match = elText.match(pattern);
          if (match) {
            const time = normalizeMatchedTime(match[1], match[2], match[3]);
            if (time) {
              return time;
            }
          }
        }
      }
    }

    for (const pattern of timePatterns) {
      const match = pageText.match(pattern);
      if (match) {
        const time = normalizeMatchedTime(match[1], match[2], match[3]);
        if (time) {
          return time;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
