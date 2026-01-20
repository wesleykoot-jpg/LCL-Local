
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.ts";
import type { RawEventCard } from "../types.ts";
import { detectCMS } from "./cms-detector.ts";

export class DomExtractor implements Extractor {
  name = "dom" as const;

  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    const $ = cheerio.load(context.html);
    const events: RawEventCard[] = [];
    
    // Auto-detect CMS if not provided
    const cms = context.detectedCms || detectCMS(context.html);
    
    // Select selectors based on CMS
    const selectors = this.getSelectorsForCMS(cms);
    
    // Also include generic selectors
    if (cms !== "unknown") {
        selectors.push(...this.getSelectorsForCMS("unknown"));
    }

    for (const selector of selectors) {
        const elements = $(selector);
        if (elements.length === 0) continue;

        elements.each((_, el) => {
            const card = this.parseElement($(el), $, context.url);
            if (card && card.title && card.date) {
                events.push(card);
            }
        });

        // If we found events with a high-specificity selector, stop there
        if (events.length > 0) break;
    }

    return {
      success: events.length > 0,
      events,
      strategy: "dom",
      confidence: 0.6, // DOM is always medium confidence
      metadata: { detectedCms: cms }
    };
  }

  private getSelectorsForCMS(cms: string): string[] {
      switch (cms) {
          case "wordpress":
              return [
                  "article.type-tribe_events", 
                  ".tribe-events-calendar-list__event-row",
                  ".tribe-common-g-row.tribe-events-calendar-list__event-row",
                  "article.event",
                  ".event-article"
              ];
          case "wix":
              return ["[data-hook='event-list-item']", ".wix-events-list-item"];
          case "squarespace":
              return [".eventlist-event", ".event-item"];
          case "unknown":
          default:
              return [
                "article.event", ".event-item", ".event-card", ".agenda-item", 
                ".calendar-event", "li.event", ".post-item", ".activity-card"
              ];
      }
  }

  private parseElement($el: cheerio.Cheerio<cheerio.AnyNode>, $: cheerio.CheerioAPI, baseUrl: string): RawEventCard | null {
      // Logic adapted from DefaultStrategy in strategies.ts
      
      const title = $el.find("h1, h2, h3, h4, .title, [class*='title']").first().text().trim() ||
                    $el.find("a").first().text().trim();
      
      if (!title || title.length < 3) return null;

      let date = $el.find("time, .date, [class*='date'], [datetime]").first().text().trim() ||
                 $el.attr("datetime") || "";
      
      // Basic date heuristic fallback
      if (!date) {
         const text = $el.text().trim();
         const dateMatch = text.match(/\d{1,2}\s+(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i);
         if (dateMatch) date = dateMatch[0];
      }

      const location = $el.find(".location, .venue, [class*='location']").first().text().trim();
      const description = $el.find("p, .description, .excerpt").first().text().trim();
      
      let detailUrl = $el.find("a").first().attr("href") || $el.attr("href") || "";
      if (detailUrl && !detailUrl.startsWith("http")) {
          try {
              detailUrl = new URL(detailUrl, baseUrl).href;
          } catch { /* ignore */ }
      }

      const imageUrl = $el.find("img").first().attr("src") || 
                       $el.find("[style*='background']").first().attr("style")?.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];

      return {
          title, 
          date, 
          location, 
          description, 
          detailUrl, 
          imageUrl: imageUrl || null,
          rawHtml: $.html($el) // verification
      };
  }
}
