
import type { ExtractionResult, ExtractionStrategy, ExtractionContext } from "./types.ts";
import { HydrationExtractor } from "./hydration.ts";
import { JsonLdExtractor } from "./json-ld.ts";
import { FeedExtractor } from "./feed-discovery.ts";
import { DomExtractor } from "./dom-fallback.ts";

export { HydrationExtractor, JsonLdExtractor, FeedExtractor, DomExtractor };
export * from "./types.ts";

// Instantiate stateless extractors
const strategies = {
  hydration: new HydrationExtractor(),
  json_ld: new JsonLdExtractor(),
  feed: new FeedExtractor(),
  dom: new DomExtractor(),
};

export async function runExtractionWaterfall(
  html: string,
  options: {
    url: string;
    preferredMethod?: string;
    detectedCms?: string;
  }
): Promise<ExtractionResult & { winningStrategy?: ExtractionStrategy }> {
  
  const context: ExtractionContext = {
    html,
    url: options.url,
    detectedCms: options.detectedCms,
    preferredMethod: options.preferredMethod,
  };

  // 1. Try Preferred Method First (Auto-Optimization)
  if (options.preferredMethod && Object.prototype.hasOwnProperty.call(strategies, options.preferredMethod)) {
    const key = options.preferredMethod as keyof typeof strategies;
    const result = await strategies[key].extract(context);
    if (result.success) {
      return { ...result, winningStrategy: key };
    }
  }

  // 2. Waterfall: Hydration -> JSON-LD -> Feed -> DOM
  // Priority 1: Hydration (Highest fidelity)
  const hydration = await strategies.hydration.extract(context);
  if (hydration.success) return { ...hydration, winningStrategy: "hydration" };

  // Priority 2: JSON-LD (Standard schema)
  const jsonLd = await strategies.json_ld.extract(context);
  if (jsonLd.success) return { ...jsonLd, winningStrategy: "json_ld" };

  // Priority 3: Feeds (Stability)
  const feed = await strategies.feed.extract(context);
  if (feed.success) return { ...feed, winningStrategy: "feed" };

  // Priority 4: DOM Fallback (Visual)
  const dom = await strategies.dom.extract(context);
  return { ...dom, winningStrategy: dom.success ? "dom" : undefined };
}
