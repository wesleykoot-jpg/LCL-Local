
import type { RawEventCard } from "../types.ts";

export type ExtractionStrategy = "hydration" | "json_ld" | "feed" | "dom" | "ai_fallback";

export interface ExtractionResult {
  success: boolean;
  events: RawEventCard[];
  strategy: ExtractionStrategy;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface ExtractionContext {
  url: string;
  html: string;
  preferredMethod?: string;
  detectedCms?: string;
  enableFeedDiscovery?: boolean;
}

export interface Extractor {
  name: ExtractionStrategy;
  extract(context: ExtractionContext): Promise<ExtractionResult>;
}
