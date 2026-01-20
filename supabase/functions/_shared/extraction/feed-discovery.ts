
import type { Extractor, ExtractionContext, ExtractionResult } from "./types.ts";

export class FeedExtractor implements Extractor {
  name = "feed" as const;

  async extract(context: ExtractionContext): Promise<ExtractionResult> {
    // Simple check: Is the content XML?
    if (context.html.trim().startsWith("<?xml") || context.html.includes("<rss") || context.html.includes("<feed")) {
        // TODO: Implement actual RSS/Atom parsing using a library like fast-xml-parser or cheerio-xml
        // For now, we return empty success to indicate "This IS a feed" but we can't parse it yet without library
        // This prevents DOM fallback from trying to parse XML as HTML
        return {
            success: false, // Set false to fall back or fail gracefully
            events: [],
            strategy: "feed",
            confidence: 1.0, 
            metadata: { isFeed: true }
        };
    }
    return { success: false, events: [], strategy: "feed", confidence: 0 };
  }
}
