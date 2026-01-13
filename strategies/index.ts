import type { ScraperStrategy, RawEventCard } from "./BaseStrategy.ts";
import { createSpoofedFetch, generatePathFallbacks } from "./BaseStrategy.ts";
import { DefaultStrategy } from "./DefaultStrategy.ts";
import type { ScraperSource } from "../supabase/functions/scrape-events/shared.ts";

/**
 * Registry for available scraping strategies.
 * New platform-specific strategies can be added here without touching the Edge Function.
 */
export const strategyRegistry: Record<string, new (source: ScraperSource) => ScraperStrategy> = {
  default: DefaultStrategy,
};

export function resolveStrategy(name: string | undefined, source: ScraperSource): ScraperStrategy {
  const StrategyCtor = (name && strategyRegistry[name]) || DefaultStrategy;
  return new StrategyCtor(source);
}

// Placeholders for future platform strategies
export class WordPressStrategy extends DefaultStrategy {
  // TODO: implement WordPress-specific parsing heuristics
}

export class VisitStrategy extends DefaultStrategy {
  // TODO: implement Visit/VVV platform parsing heuristics
}

export { DefaultStrategy, createSpoofedFetch, generatePathFallbacks };
export type { RawEventCard, ScraperStrategy };
