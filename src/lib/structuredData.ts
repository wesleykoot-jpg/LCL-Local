import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { parseToISODate } from "../../supabase/functions/_shared/dateUtils.ts";
import type { RawEventCard } from "../../supabase/functions/scrape-events/shared.ts";

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
    detailUrl,
    detailPageTime: eventTime,
  };
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
      detailUrl: url ? new URL(url, baseUrl).toString() : null,
    });
  });

  return results;
}

export function extractStructuredEvents(html: string, baseUrl: string): RawEventCard[] {
  const jsonLdEvents = extractJsonLdEvents(html, baseUrl);
  if (jsonLdEvents.length > 0) return jsonLdEvents;
  return extractMicrodataEvents(html, baseUrl);
}
