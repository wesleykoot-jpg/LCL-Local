import * as cheerio from "cheerio";

// Locally defined to avoid dependency on Deno-specific supabase/functions
export interface RawEventCard {
  rawHtml: string;
  title: string;
  date: string;
  location: string;
  imageUrl?: string | null;
  description: string;
  detailUrl?: string | null;
  detailUrlSource?: string | null;
  price?: string | null;
  price_currency?: string | null;
}

export function parseToISODate(dateStr: string, today?: Date): string | null {
  if (!dateStr || typeof dateStr !== "string") return null;

  const todayDate = today ? new Date(today) : new Date();
  const safeYear = (year: number) => year >= 2020 && year <= 2030;
  const cleaned = dateStr.trim().toLowerCase();
  if (!cleaned) return null;

  const relativeMap: Record<string, number> = { vandaag: 0, today: 0, morgen: 1, tomorrow: 1, overmorgen: 2, "day after tomorrow": 2 };
  if (relativeMap[cleaned] !== undefined) {
    const target = new Date(todayDate);
    target.setDate(target.getDate() + relativeMap[cleaned]);
    return target.toISOString().split("T")[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split("-").map(Number);
    if (safeYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) return cleaned;
    return null;
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[tT]/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    if (!safeYear(year)) return null;
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // RFC 2822 format (from RSS feeds): "Mon, 13 Oct 2025 14:04:25 +0000"
  const rfc2822Match = dateStr.match(/^\w{3},?\s+(\d{1,2})\s+(\w{3})\s+(\d{4})/i);
  if (rfc2822Match) {
    const day = parseInt(rfc2822Match[1], 10);
    const monthName = rfc2822Match[2].toLowerCase();
    const year = parseInt(rfc2822Match[3], 10);
    const MONTHS_SHORT: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    const month = MONTHS_SHORT[monthName];
    if (month && safeYear(year) && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const MONTHS: Record<string, number> = {
    januari: 1, jan: 1, january: 1, februari: 2, feb: 2, february: 2, februar: 2,
    maart: 3, mrt: 3, march: 3, märz: 3, maerz: 3, april: 4, apr: 4,
    mei: 5, may: 5, mai: 5, juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7,
    augustus: 8, aug: 8, august: 8, september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, october: 10, november: 11, nov: 11, december: 12, dec: 12,
  };

  const textual = cleaned.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const dayNamePattern = "(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|ma|di|wo|do|vr|za|zo|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)?";
  const textualMatch = textual.match(new RegExp(`^${dayNamePattern}\\s*(\\d{1,2})\\s*([\\p{L}.]+)(?:\\s*(\\d{2,4}))?`, "iu"));
  if (textualMatch) {
    const day = parseInt(textualMatch[2], 10);
    const monthNameRaw = textualMatch[3].replace(/\./g, "");
    const yearMatch = textualMatch[4] ? parseInt(textualMatch[4], 10) : todayDate.getFullYear();
    const month = MONTHS[monthNameRaw] || MONTHS[monthNameRaw.slice(0, 3)];
    if (month && day >= 1 && day <= 31 && safeYear(yearMatch)) {
      return `${yearMatch}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const europeanMatch = textual.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if ( europeanMatch) {
    const [, dayRaw, monthRaw, yearRaw] = europeanMatch;
    const centuryPrefix = String(todayDate.getFullYear()).slice(0, 2);
    const yearNum = parseInt(yearRaw.length === 2 ? `${centuryPrefix}${yearRaw}` : yearRaw, 10);
    if (!safeYear(yearNum)) return null;
    return `${yearNum}-${monthRaw.padStart(2, "0")}-${dayRaw.padStart(2, "0")}`;
  }

  return null;
}


function mapStructuredEvent(
  node: Record<string, unknown>,
  baseUrl: string
): RawEventCard | null {
  const type = node["@type"] || node["type"];
  if (!type) return null;

  const isEvent =
    (Array.isArray(type) && type.some((t) => `${t}`.toLowerCase() === "event")) ||
    `${type}`.toLowerCase() === "event";
  if (!isEvent) return null;

  const title = typeof node.name === "string" ? node.name : typeof node.headline === "string" ? node.headline : "";
  const startDate = typeof node.startDate === "string" ? parseToISODate(node.startDate) : null;

  if (!title || !startDate) return null;

  const location = typeof node?.location === "object" && node.location && typeof (node.location as Record<string, unknown>).name === "string"
    ? (node.location as Record<string, unknown>).name as string
    : "";

  const rawUrl = typeof node.url === "string" ? node.url : "";
  const detailUrl = rawUrl ? new URL(rawUrl, baseUrl).toString() : null;

  let eventTime: string | undefined;
  if (typeof node.startDate === "string") {
    const timeMatch = `${node.startDate}`.match(/T(\d{2}:\d{2})/);
    if (timeMatch) {
      eventTime = timeMatch[1];
    }
  }

  const description = typeof node.description === "string" ? node.description : "";
  const imageUrl = typeof node.image === "string" ? node.image : null;

  return {
    rawHtml: JSON.stringify(node).slice(0, 3000),
    title,
    date: startDate,
    location,
    imageUrl,
    description,
    detail_url: detailUrl,
    detail_page_time: eventTime,
  } as any;
}

export function extractJsonLdEvents(html: string, baseUrl: string): RawEventCard[] {
  const $ = cheerio.load(html);
  const results: RawEventCard[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text();
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (Array.isArray(node["@graph"])) {
          for (const item of node["@graph"]) {
            const mapped = mapStructuredEvent(item as Record<string, unknown>, baseUrl);
            if (mapped) {
              results.push(mapped);
            }
          }
        } else {
          const mapped = mapStructuredEvent(node as Record<string, unknown>, baseUrl);
          if (mapped) {
            results.push(mapped);
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  });

  return results;
}

export function extractMicrodataEvents(html: string, baseUrl: string): RawEventCard[] {
  const $ = cheerio.load(html);
  const results: RawEventCard[] = [];

  $('[itemscope][itemtype*="Event"]').each((_, el) => {
    const $el = $(el);
    const name = $el.find('[itemprop="name"]').first().text().trim() || $el.attr("title") || "";
    const startDate = $el.find('[itemprop="startDate"]').first().attr("content") ||
      $el.find('[itemprop="startDate"]').first().text();
    const url = $el.find('[itemprop="url"]').first().attr("href") || $el.find("a").first().attr("href") || "";
    const location = $el.find('[itemprop="location"] [itemprop="name"]').first().text() ||
      $el.find('[itemprop="location"]').first().text();
    const description = $el.find('[itemprop="description"]').first().text();

    const isoDate = startDate ? parseToISODate(startDate) : null;
    if (!name || !isoDate) return;

    results.push({
      rawHtml: $el.html() || "",
      title: name.trim(),
      date: isoDate,
      location: location.trim(),
      imageUrl: $el.find("img").first().attr("src") || null,
      description: description.trim(),
      detailUrl: (url ? new URL(url, baseUrl).toString() : "") as string,
    });
  });

  return results;
}

export function extractStructuredEvents(html: string, baseUrl: string): RawEventCard[] {
  const jsonLdEvents = extractJsonLdEvents(html, baseUrl);
  if (jsonLdEvents.length > 0) return jsonLdEvents;
  return extractMicrodataEvents(html, baseUrl);
}
