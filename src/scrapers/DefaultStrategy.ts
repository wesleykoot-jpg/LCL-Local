import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { extractStructuredEvents } from "../lib/structuredData.ts";
import { normalizeAndResolveUrl, probePaths } from "../lib/urlUtils.ts";
import { parseToISODate } from "../../supabase/functions/scrape-events/dateUtils.ts";
import type { ScraperSource, RawEventCard } from "../../supabase/functions/scrape-events/shared.ts";
import { fetchEventDetailTime } from "../../supabase/functions/scrape-events/shared.ts";
import { BaseStrategy, StrategyContext } from "./BaseStrategy.ts";

const DEFAULT_DISCOVERY_ANCHORS = [
  "agenda",
  "activiteiten",
  "evenementen",
  "events",
  "whatson",
  "calendar",
  "kalender",
];

const DEFAULT_ALTERNATE_PATHS = [
  "/agenda",
  "/activiteiten",
  "/evenementen",
  "/events",
  "/whatson",
  "/agenda/",
];

export class DefaultStrategy extends BaseStrategy {
  async discoverListingUrls(fetcher: typeof fetch = fetch): Promise<string[]> {
    const anchors = this.source.config.discoveryAnchors || DEFAULT_DISCOVERY_ANCHORS;
    const alternatePaths = this.source.config.alternatePaths || DEFAULT_ALTERNATE_PATHS;
    const candidates: string[] = [];

    try {
      const homeResp = await fetcher(this.source.url, {
        headers: this.source.config.headers || {},
      });
      const html = await homeResp.text();
      const $ = cheerio.load(html);

      const baseHref = $('base').attr('href') || homeResp.url || this.source.url;
      $("a[href]").each((_, el) => {
        const text = $(el).text().toLowerCase();
        const href = $(el).attr("href");
        if (!href) return;
        const normalized = normalizeAndResolveUrl(href, baseHref);
        if (anchors.some((a) => text.includes(a) || normalized.toLowerCase().includes(`/${a}`))) {
          candidates.push(normalized);
        }
      });
    } catch {
      // ignore discovery failures, rely on alternates
    }

    const probes = await probePaths(this.source.url, alternatePaths, fetcher).catch(() => []);
    for (const probe of probes) {
      candidates.push(probe.finalUrl);
      const trailing = probe.finalUrl.endsWith("/") ? probe.finalUrl.slice(0, -1) : `${probe.finalUrl}/`;
      candidates.push(trailing);
    }

    candidates.push(this.source.url);

    // dedupe preserving order
    const seen = new Set<string>();
    const ordered = candidates.filter((c) => {
      const key = c.split("#")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return ordered;
  }

  async parseListing(
    html: string,
    finalUrl: string,
    context: StrategyContext = {}
  ): Promise<RawEventCard[]> {
    const fetcher = context.fetcher || fetch;
    const enableDeepScraping = context.enableDeepScraping !== false;
    const enableDebug = context.enableDebug === true;
    const structured = extractStructuredEvents(html, finalUrl);
    if (structured.length > 0) {
      return structured;
    }

    const $ = cheerio.load(html);
    const selectors = this.source.config.selectors && this.source.config.selectors.length > 0
      ? this.source.config.selectors
      : ["article", ".agenda-item", ".event-card", ".event", ".card"];

    const dedup = new Set<string>();
    const events: RawEventCard[] = [];

    for (const selector of selectors) {
      $(selector).each((_, el) => {
        const $el = $(el);
        const title =
          $el.find("h1, h2, h3, h4").first().text().trim() ||
          $el.find('[class*="title"]').first().text().trim() ||
          $el.find("a").first().text().trim();

        const dateText =
          $el.find("time").first().attr("datetime") ||
          $el.find("time").first().text() ||
          $el.find('[class*="date"]').first().text();

        const detailHref = $el.find("a").first().attr("href") || "";
        const description =
          $el.find(".description, .excerpt, p").first().text().trim() || "";
        const location =
          $el.find(".location, .venue, address").first().text().trim() || "";

        if (!title) return;
        const isoDate = dateText ? parseToISODate(dateText) : null;
        if (!isoDate) return;

        const resolvedDetail = detailHref
          ? normalizeAndResolveUrl(detailHref, finalUrl)
          : null;

        const dedupKey = `${title.toLowerCase()}|${isoDate}|${resolvedDetail || ""}`;
        if (dedup.has(dedupKey)) return;
        dedup.add(dedupKey);

        events.push({
          rawHtml: $el.html() || "",
          title,
          date: isoDate,
          location,
          imageUrl: $el.find("img").first().attr("src") || null,
          description,
          detailUrl: resolvedDetail,
        });
      });
    }

    if (enableDeepScraping && events.length > 0) {
      for (const evt of events) {
        if (evt.detailUrl && !evt.detailPageTime) {
          const time = await fetchEventDetailTime(evt.detailUrl, finalUrl, fetcher);
          if (time) {
            evt.detailPageTime = time;
          }
        }
      }
    } else if (enableDebug && events.length === 0) {
      console.log("  ⚠️ No events parsed from selectors");
    }

    return events;
  }
}
