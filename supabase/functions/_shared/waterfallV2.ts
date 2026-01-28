/**
 * Waterfall Intelligence v2 - Module Exports
 * 
 * Central export file for all Waterfall Intelligence v2 components.
 * Import from this file for clean access to all AI agents and services.
 * 
 * @module _shared/waterfallV2
 */

// ============================================================================
// SOCIAL FIVE SCHEMA
// ============================================================================

export {
  SOCIAL_FIVE_SCHEMA,
  type SocialFiveEvent,
  type EnrichmentHints,
  type EnrichmentResult,
  calculateSocialFiveScore,
  isSocialFiveComplete,
  getMissingSocialFiveFields,
  buildStructuredAddress
} from "./socialFiveSchema.ts";

// ============================================================================
// ENRICHMENT SERVICE (AI Injection Point: "Enrichment Engine")
// ============================================================================

export {
  enrichWithSocialFive,
  batchEnrichWithSocialFive,
  type EnrichmentOptions,
  type BatchEnrichmentItem,
  type BatchEnrichmentResult
} from "./enrichmentService.ts";

// ============================================================================
// LANGUAGE DETECTION
// ============================================================================

export {
  detectLanguage,
  analyzeLanguage,
  hasExplicitEnglishMarker,
  isExpatFriendly,
  getLanguageProfileForDB,
  type LanguageProfile,
  type LanguageDetectionResult
} from "./languageDetection.ts";

// ============================================================================
// VIBE CLASSIFIER (AI Injection Point: "Vibe Classifier")
// ============================================================================

export {
  classifyVibe,
  classifyVibeFromCategory,
  classifyVibeWithAI,
  inferPersonaTags,
  type InteractionMode,
  type VibeClassification,
  type AIVibeClassificationOptions
} from "./vibeClassifier.ts";

// ============================================================================
// ANALYZER AGENT (AI Injection Point: "The Analyzer")
// ============================================================================

export {
  analyzeSource,
  isJsHeavy,
  needsAntiBot,
  canUseStatic,
  upgradeFetcher,
  downgradeFetcher,
  FETCHER_COST_ORDER,
  type FetcherType,
  type AnalyzerResult,
  type AnalyzerSignal,
  type SourceHistory
} from "./analyzerAgent.ts";

// ============================================================================
// SELECTOR HEALER (AI Injection Point: "The Healer")
// ============================================================================

export {
  healSelectors,
  batchHealSelectors,
  generateSelectorUpdateSQL,
  createHealingAuditEntry,
  type SelectorConfig,
  type HealingRequest,
  type HealingResult,
  type ValidationResult
} from "./selectorHealer.ts";

// ============================================================================
// MARKDOWN UTILITIES
// ============================================================================

export {
  htmlToMarkdown,
  extractMainContent,
  normalizeText,
  extractBySelector,
  type HtmlToMarkdownOptions
} from "./markdownUtils.ts";

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

import { analyzeSource, type FetcherType } from "./analyzerAgent.ts";
import { enrichWithSocialFive, type EnrichmentOptions } from "./enrichmentService.ts";
import { healSelectors, type HealingRequest } from "./selectorHealer.ts";
import { classifyVibe } from "./vibeClassifier.ts";
import { detectLanguage } from "./languageDetection.ts";

/**
 * Full pipeline processing for a single event
 * 
 * This combines all Waterfall v2 components into a single processing flow:
 * 1. Analyze HTML for optimal fetcher routing
 * 2. Enrich with Social Five data
 * 3. Classify vibe/interaction mode
 * 4. Detect language profile
 */
export async function processEventWithWaterfallV2(
  apiKey: string,
  options: {
    detailHtml: string;
    baseUrl: string;
    title: string;
    category?: string;
    location?: string;
    date?: string;
  },
  fetcher: typeof fetch = fetch
): Promise<{
  enrichment: Awaited<ReturnType<typeof enrichWithSocialFive>>;
  vibe: ReturnType<typeof classifyVibe>;
  language: ReturnType<typeof detectLanguage>;
  fetcherAnalysis: ReturnType<typeof analyzeSource>;
}> {
  const { detailHtml, baseUrl, title, category = '', location = '', date = '' } = options;
  
  // Parallel processing
  const [enrichmentResult, fetcherAnalysis] = await Promise.all([
    enrichWithSocialFive(apiKey, {
      detailHtml,
      baseUrl,
      hints: { title, location, date }
    }, fetcher),
    Promise.resolve(analyzeSource(detailHtml))
  ]);
  
  // Sequential (depends on enrichment result)
  const description = enrichmentResult.event?.description || title;
  const vibe = classifyVibe(category, description);
  const language = detectLanguage(description);
  
  return {
    enrichment: enrichmentResult,
    vibe,
    language,
    fetcherAnalysis
  };
}

/**
 * Self-healing check and repair for a source
 * 
 * Call this when a source returns 0 events unexpectedly.
 */
export async function checkAndHealSource(
  apiKey: string,
  request: HealingRequest,
  fetcher: typeof fetch = fetch
): Promise<{
  needsHealing: boolean;
  healingResult?: Awaited<ReturnType<typeof healSelectors>>;
  fetcherUpgrade?: FetcherType;
}> {
  // First check if it's a fetcher issue
  const fetcherAnalysis = analyzeSource(request.html);
  
  if (fetcherAnalysis.should_upgrade) {
    return {
      needsHealing: false,
      fetcherUpgrade: fetcherAnalysis.recommended_fetcher
    };
  }
  
  // Try to heal selectors
  const healingResult = await healSelectors(apiKey, request, fetcher);
  
  return {
    needsHealing: !healingResult.success,
    healingResult
  };
}

// ============================================================================
// VERSION INFO
// ============================================================================

export const WATERFALL_V2_VERSION = "2.0.0";

export const WATERFALL_V2_FEATURES = [
  "Social Five Schema (doors_open, language, interaction_mode, structured_address)",
  "Dutch Tier Classification (nl_tier 1-3)",
  "Health Score Tracking (0-100)",
  "AI Enrichment Engine with OpenAI Structured Outputs",
  "Rules-based Language Detection (NL/EN/Mixed)",
  "Vibe Classifier with Persona Tags",
  "Fetcher Type Analyzer (static → puppeteer → scrapingbee)",
  "LLM-based Selector Healer for Self-Healing"
];
