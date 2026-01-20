
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.ts";
import type { RawEventCard } from "../types.ts";

export class JsonLdExtractor implements Extractor {
  name = "json_ld" as const;

  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    const $ = cheerio.load(context.html);
    const events: RawEventCard[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const text = $(el).html();
      if (!text) return;

      try {
        const json = this.safeParse(text);
        events.push(...this.processNode(json, context.url));
      } catch (e) {
        // console.warn("JSON-LD parse failed", e);
      }
    });

    return {
      success: events.length > 0,
      events,
      strategy: "json_ld",
      confidence: 0.95
    };
  }

  private safeParse(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch {
      // Soft Repair: Remove trailing commas, fixing unquoted keys (simple regexes)
      // This is a minimal repair implementation
      const repaired = jsonString
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      return JSON.parse(repaired);
    }
  }

  private processNode(node: any, baseUrl: string): RawEventCard[] {
    if (!node) return [];
    const results: RawEventCard[] = [];

    if (Array.isArray(node)) {
      node.forEach(n => results.push(...this.processNode(n, baseUrl)));
      return results;
    }

    if (this.isEvent(node)) {
      results.push(this.mapNodeToCard(node, baseUrl));
    } else if (node["@graph"] && Array.isArray(node["@graph"])) {
        // Handle @graph structure often used by Yoast schemas
        node["@graph"].forEach((n: any) => results.push(...this.processNode(n, baseUrl)));
    }

    return results;
  }

  private isEvent(node: any): boolean {
    const type = node["@type"] || node["type"];
    if (!type) return false;
    if (Array.isArray(type)) return type.some(t => t.toLowerCase().includes("event"));
    return typeof type === "string" && type.toLowerCase().includes("event");
  }

  private mapNodeToCard(node: any, baseUrl: string): RawEventCard {
    const title = node.name || node.headline || "";
    const date = node.startDate || "";
    const locationObj = node.location || {};
    const location = locationObj.name || locationObj.address?.addressLocality || "";
    const description = node.description || "";
    const image = node.image ? (typeof node.image === 'string' ? node.image : node.image.url) : null;
    let url = node.url || node["@id"] || "";
    
    // Resolve relative URL
    if (url && !url.startsWith("http")) {
        try {
            url = new URL(url, baseUrl).href;
        } catch { /* ignore */ }
    }

    return {
      title,
      date,
      location,
      description,
      imageUrl: image,
      detailUrl: url,
      rawHtml: JSON.stringify(node),
    };
  }
}
