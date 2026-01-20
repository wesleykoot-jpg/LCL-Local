
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.ts";
import type { RawEventCard } from "../types.ts";

export class HydrationExtractor implements Extractor {
  name = "hydration" as const;

  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    const $ = cheerio.load(context.html);
    const events: RawEventCard[] = [];

    // 1. Next.js
    const nextData = $("#__NEXT_DATA__").html();
    if (nextData) {
      try {
        const json = JSON.parse(nextData);
        events.push(...this.findEventsInObject(json));
      } catch (e) {
        console.warn("Failed to parse NEXT_DATA", e);
      }
    }

    // 2. Nuxt.js
    // Nuxt often puts state in window.__NUXT__ = { ... }; script
    if (context.html.includes("__NUXT__")) {
      const nuxtMatch = context.html.match(/window\.__NUXT__\s*=\s*({[\s\S]*?});/);
      if (nuxtMatch && nuxtMatch[1]) {
        try {
            // This is dangerous if using eval, but Nuxt state is effectively JS code.
            // Safe JSON parse is preferred if possible. Nuxt 3 uses JSON in script type="application/json" id="__NUXT_DATA__"
            // Let's try Nuxt 3 selector first
            const nuxt3Data = $("#__NUXT_DATA__").html();
            if (nuxt3Data) {
                 // Nuxt 3 is complex array-based encoding, skipping advanced de-serialization for now
                 // unless standard JSON
                 try {
                     const json = JSON.parse(nuxt3Data);
                     events.push(...this.findEventsInObject(json));
                 } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
      }
    }

    // 3. Generic Redux/State (window.__INITIAL_STATE__)
    const reduxMatch = context.html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
    if (reduxMatch && reduxMatch[1]) {
         try {
             const json = JSON.parse(reduxMatch[1]);
             events.push(...this.findEventsInObject(json));
         } catch { /* ignore */ }
    }

    // Filter out obviously bad results
    const validEvents = events.filter(e => e.title && e.date);

    return {
      success: validEvents.length > 0,
      events: validEvents,
      strategy: "hydration",
      confidence: 1.0 // High confidence if found in state
    };
  }

  // Recursive search for event-like objects
  private findEventsInObject(obj: any, depth = 0): RawEventCard[] {
    if (depth > 5 || !obj) return [];
    const results: RawEventCard[] = [];

    if (Array.isArray(obj)) {
      for (const item of obj) {
        results.push(...this.findEventsInObject(item, depth + 1));
      }
      return results;
    }

    if (typeof obj === "object") {
      // Check if this object looks like an event
      if (this.isEventLike(obj)) {
        results.push(this.mapObjectToCard(obj));
      }

      // Continue traversal
      for (const key in obj) {
        // Skip large strings or unrelated blocks to save CPU
        if (key === "html" || key === "content" || key === "children") continue; 
        results.push(...this.findEventsInObject(obj[key], depth + 1));
      }
    }

    return results;
  }

  private isEventLike(obj: any): boolean {
    if (!obj) return false;
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    
    // Must have title-like and date-like fields
    const hasTitle = keys.some(k => k === "title" || k === "name" || k === "headline");
    const hasDate = keys.some(k => k.includes("date") || k === "start" || k === "starttime" || k === "begin" || k === "datetime");
    
    // Optional: Location check
    // const hasLocation = keys.some(k => k.includes("location") || k === "venue" || k === "place");

    // Negative checks (avoid menu items, users, etc)
    const isUser = keys.includes("username") || keys.includes("email");
    const isMenu = keys.includes("menuitem") || keys.includes("navigation");

    return hasTitle && hasDate && !isUser && !isMenu;
  }

  private mapObjectToCard(obj: any): RawEventCard {
    // Heuristic mapping
    // This is "best effort" mapping. 
    
    const getVal = (patterns: string[]): string => {
        for (const p of patterns) {
            // Exact match
            if (obj[p]) return String(obj[p]);
            // Case-insensitive match
            const key = Object.keys(obj).find(k => k.toLowerCase() === p.toLowerCase());
            if (key && obj[key]) return String(obj[key]);
            
            // Nested simple (e.g. venue.name)
            if (p.includes('.')) {
                const [parent, child] = p.split('.');
                if (obj[parent] && obj[parent][child]) return String(obj[parent][child]);
            }
        }
        return "";
    };

    const title = getVal(["title", "name", "headline", "summary"]);
    const date = getVal(["startDate", "start_date", "date", "startTime", "datetime", "begin"]);
    const location = getVal(["location", "venue.name", "venue", "place.name", "locationName"]);
    const description = getVal(["description", "summary", "intro", "shortDescription"]);
    const image = getVal(["image", "imageUrl", "thumbnail", "picture", "photo"]);
    const url = getVal(["url", "permaLink", "link", "href"]); // Id usually needs constructing

    return {
      title,
      date,
      location,
      description,
      imageUrl: image,
      detailUrl: url,
      rawHtml: JSON.stringify(obj), // Store source JSON as raw "HTML" for debug
    };
  }
}
