/**
 * Selector Healer Agent - LLM-based CSS Selector Self-Healing
 * 
 * AI Injection Point: "The Healer"
 * 
 * When a CSS selector stops working (source redesign), this agent:
 * 1. Analyzes the current HTML structure
 * 2. Uses LLM to infer the correct new selector
 * 3. Validates the proposed selector
 * 4. Updates the source configuration
 * 
 * Self-healing triggers:
 * - 0 events extracted when source previously worked
 * - Selector returns empty/null consistently
 * - Manual trigger via scraper insights
 * 
 * @module _shared/selectorHealer
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SelectorConfig {
  eventCard: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  link: string;
  description?: string;
  image?: string;
  price?: string;
}

export interface HealingRequest {
  /** URL of the source page */
  sourceUrl: string;
  /** Current (broken) selector configuration */
  currentSelectors: SelectorConfig;
  /** Raw HTML of the page */
  html: string;
  /** Expected event count (from history) */
  expectedEventCount?: number;
  /** Sample event titles from previous successful scrapes */
  previousTitles?: string[];
}

export interface HealingResult {
  success: boolean;
  newSelectors?: SelectorConfig;
  confidence: number;
  validationResults: ValidationResult[];
  reasoning: string;
  /** Number of events the new selectors would find */
  potentialEventCount: number;
}

export interface ValidationResult {
  selector: string;
  field: string;
  matchCount: number;
  sampleValues: string[];
  isValid: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MIN_CONFIDENCE_THRESHOLD = 0.7;

// ============================================================================
// MAIN HEALING FUNCTION
// ============================================================================

/**
 * Attempt to heal broken CSS selectors using LLM analysis
 */
export async function healSelectors(
  apiKey: string,
  request: HealingRequest,
  fetcher: typeof fetch = fetch
): Promise<HealingResult> {
  const { html, currentSelectors, sourceUrl, previousTitles = [] } = request;
  
  // Step 1: Analyze current HTML structure
  const structureAnalysis = analyzeHtmlStructure(html);
  
  // Step 2: Test current selectors
  const currentValidation = validateSelectors(html, currentSelectors);
  const currentEventCount = currentValidation.find(v => v.field === 'eventCard')?.matchCount || 0;
  
  // If current selectors work, no healing needed
  if (currentEventCount > 0) {
    return {
      success: true,
      newSelectors: currentSelectors,
      confidence: 1.0,
      validationResults: currentValidation,
      reasoning: 'Current selectors still working',
      potentialEventCount: currentEventCount
    };
  }
  
  // Step 3: Use LLM to propose new selectors
  const proposedSelectors = await proposeSelectorsWithLLM(
    apiKey,
    html,
    sourceUrl,
    currentSelectors,
    previousTitles,
    structureAnalysis,
    fetcher
  );
  
  if (!proposedSelectors) {
    return {
      success: false,
      confidence: 0,
      validationResults: currentValidation,
      reasoning: 'LLM could not propose new selectors',
      potentialEventCount: 0
    };
  }
  
  // Step 4: Validate proposed selectors
  const newValidation = validateSelectors(html, proposedSelectors);
  const newEventCount = newValidation.find(v => v.field === 'eventCard')?.matchCount || 0;
  
  // Step 5: Calculate confidence
  const confidence = calculateHealingConfidence(
    newValidation,
    newEventCount,
    request.expectedEventCount,
    previousTitles
  );
  
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return {
      success: false,
      newSelectors: proposedSelectors,
      confidence,
      validationResults: newValidation,
      reasoning: `Low confidence (${(confidence * 100).toFixed(0)}%) - manual review recommended`,
      potentialEventCount: newEventCount
    };
  }
  
  return {
    success: true,
    newSelectors: proposedSelectors,
    confidence,
    validationResults: newValidation,
    reasoning: `Healed with ${(confidence * 100).toFixed(0)}% confidence. Found ${newEventCount} events.`,
    potentialEventCount: newEventCount
  };
}

// ============================================================================
// LLM SELECTOR PROPOSAL
// ============================================================================

async function proposeSelectorsWithLLM(
  apiKey: string,
  html: string,
  sourceUrl: string,
  currentSelectors: SelectorConfig,
  previousTitles: string[],
  structureAnalysis: StructureAnalysis,
  fetcher: typeof fetch
): Promise<SelectorConfig | null> {
  // Truncate HTML for LLM context
  const truncatedHtml = truncateHtmlForLLM(html, 12000);
  
  const systemPrompt = `You are an expert at CSS selectors for web scraping. Your task is to analyze HTML and propose CSS selectors to extract event listings.

Rules:
1. Prefer class-based selectors over ID (more stable)
2. Avoid nth-child or positional selectors (brittle)
3. Use data-* attributes when available (most stable)
4. Prefer semantic class names (event, card, item) over generated ones (css-1234)
5. Validate by counting how many elements would match

Return ONLY valid JSON with this structure:
{
  "eventCard": "CSS selector for the event container/card element",
  "title": "CSS selector for event title (relative to card)",
  "date": "CSS selector for date (relative to card)",
  "time": "CSS selector for time if separate from date (relative to card)",
  "location": "CSS selector for venue/location (relative to card)",
  "link": "CSS selector for link to event details (relative to card)",
  "description": "CSS selector for description if available (relative to card)",
  "image": "CSS selector for image if available (relative to card)"
}`;

  const userPrompt = `Source URL: ${sourceUrl}

Previous working selectors (now broken):
${JSON.stringify(currentSelectors, null, 2)}

${previousTitles.length > 0 ? `Known event titles from this source:\n${previousTitles.slice(0, 5).map(t => `- ${t}`).join('\n')}\n` : ''}

HTML structure analysis:
- Common container classes: ${structureAnalysis.containerClasses.slice(0, 10).join(', ')}
- Common link patterns: ${structureAnalysis.linkPatterns.slice(0, 5).join(', ')}
- Detected event-like elements: ${structureAnalysis.eventIndicators.join(', ')}

HTML content (truncated):
${truncatedHtml}

Analyze this HTML and propose new CSS selectors to extract event listings. The eventCard selector should match the repeating container for each event.`;

  try {
    const response = await fetcher(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      console.error(`LLM healing request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in LLM response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as SelectorConfig;
    
    // Validate required fields
    if (!parsed.eventCard || !parsed.title || !parsed.link) {
      console.error('Missing required selector fields');
      return null;
    }

    return parsed;
    
  } catch (error) {
    console.error('LLM selector healing error:', error);
    return null;
  }
}

// ============================================================================
// HTML STRUCTURE ANALYSIS
// ============================================================================

interface StructureAnalysis {
  containerClasses: string[];
  linkPatterns: string[];
  eventIndicators: string[];
  repeatingPatterns: string[];
}

function analyzeHtmlStructure(html: string): StructureAnalysis {
  const containerClasses: string[] = [];
  const linkPatterns: string[] = [];
  const eventIndicators: string[] = [];
  const repeatingPatterns: string[] = [];
  
  // Extract class names
  const classMatches = html.matchAll(/class=["']([^"']+)["']/gi);
  const classCounts = new Map<string, number>();
  
  for (const match of classMatches) {
    const classes = match[1].split(/\s+/);
    for (const cls of classes) {
      if (cls.length > 2 && !cls.match(/^(css-|_|sc-)/)) {
        classCounts.set(cls, (classCounts.get(cls) || 0) + 1);
      }
    }
  }
  
  // Find repeating classes (likely event cards)
  for (const [cls, count] of classCounts) {
    if (count >= 3 && count <= 50) {
      repeatingPatterns.push(cls);
    }
  }
  
  // Find event-related classes
  const eventPatterns = /event|card|item|article|listing|agenda|programma|activiteit|voorstelling/i;
  for (const cls of classCounts.keys()) {
    if (eventPatterns.test(cls)) {
      eventIndicators.push(cls);
    }
  }
  
  // Find container-like classes
  const containerPatterns = /container|wrapper|list|grid|row|col/i;
  for (const cls of classCounts.keys()) {
    if (containerPatterns.test(cls)) {
      containerClasses.push(cls);
    }
  }
  
  // Extract link patterns
  const linkMatches = html.matchAll(/href=["']([^"']+)["']/gi);
  const linkDomains = new Set<string>();
  
  for (const match of linkMatches) {
    try {
      const url = new URL(match[1], 'https://example.com');
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        linkPatterns.push(`/${pathParts[0]}/*`);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  
  return {
    containerClasses: containerClasses.slice(0, 20),
    linkPatterns: [...new Set(linkPatterns)].slice(0, 10),
    eventIndicators: eventIndicators.slice(0, 10),
    repeatingPatterns: repeatingPatterns.slice(0, 10)
  };
}

// ============================================================================
// SELECTOR VALIDATION
// ============================================================================

function validateSelectors(
  html: string,
  selectors: SelectorConfig
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  // We can't use document.querySelectorAll in Deno, so use regex-based estimation
  for (const [field, selector] of Object.entries(selectors)) {
    if (!selector) continue;
    
    const validation = estimateSelectorMatch(html, selector);
    results.push({
      selector,
      field,
      matchCount: validation.count,
      sampleValues: validation.samples,
      isValid: validation.count > 0
    });
  }
  
  return results;
}

function estimateSelectorMatch(
  html: string,
  selector: string
): { count: number; samples: string[] } {
  // Extract class or tag from selector
  const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/);
  const tagMatch = selector.match(/^([a-z]+)/i);
  
  if (classMatch) {
    const className = classMatch[1];
    const regex = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, 'gi');
    const matches = html.match(regex) || [];
    return {
      count: matches.length,
      samples: matches.slice(0, 3)
    };
  }
  
  if (tagMatch) {
    const tagName = tagMatch[1].toLowerCase();
    const regex = new RegExp(`<${tagName}[^>]*>`, 'gi');
    const matches = html.match(regex) || [];
    return {
      count: matches.length,
      samples: matches.slice(0, 3)
    };
  }
  
  return { count: 0, samples: [] };
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

function calculateHealingConfidence(
  validationResults: ValidationResult[],
  eventCount: number,
  expectedCount?: number,
  previousTitles?: string[]
): number {
  let confidence = 0.5; // Base confidence
  
  // Event count factor
  if (eventCount > 0) {
    confidence += 0.2;
    
    // Closer to expected count = higher confidence
    if (expectedCount && expectedCount > 0) {
      const ratio = Math.min(eventCount, expectedCount) / Math.max(eventCount, expectedCount);
      confidence += ratio * 0.15;
    }
  }
  
  // Required fields validation
  const requiredFields = ['eventCard', 'title', 'link'];
  const validRequiredCount = validationResults
    .filter(v => requiredFields.includes(v.field) && v.isValid)
    .length;
  
  confidence += (validRequiredCount / requiredFields.length) * 0.15;
  
  // Title match (if we have previous titles)
  // This would require extracting titles and comparing
  // For now, we'll skip this check
  
  return Math.min(confidence, 1.0);
}

// ============================================================================
// UTILITIES
// ============================================================================

function truncateHtmlForLLM(html: string, maxLength: number): string {
  // Remove scripts, styles, comments
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  
  // Try to find main content area
  const mainMatch = cleaned.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch && mainMatch[1].length > 1000) {
    cleaned = mainMatch[1];
  }
  
  // Truncate if still too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + '\n<!-- truncated -->';
  }
  
  return cleaned;
}

// ============================================================================
// BATCH HEALING
// ============================================================================

export interface BatchHealingRequest {
  sourceId: string;
  request: HealingRequest;
}

export interface BatchHealingResult {
  sourceId: string;
  result: HealingResult;
}

/**
 * Heal multiple sources in sequence
 */
export async function batchHealSelectors(
  apiKey: string,
  requests: BatchHealingRequest[],
  fetcher: typeof fetch = fetch
): Promise<BatchHealingResult[]> {
  const results: BatchHealingResult[] = [];
  
  for (const { sourceId, request } of requests) {
    const result = await healSelectors(apiKey, request, fetcher);
    results.push({ sourceId, result });
    
    // Rate limit between requests
    await new Promise(r => setTimeout(r, 500));
  }
  
  return results;
}

// ============================================================================
// SELECTOR MIGRATION
// ============================================================================

/**
 * Generate SQL to update source selectors
 */
export function generateSelectorUpdateSQL(
  sourceId: string,
  newSelectors: SelectorConfig
): string {
  const configJson = JSON.stringify({ selectors: newSelectors });
  
  return `
UPDATE scraper_sources
SET 
  config = config || '${configJson}'::jsonb,
  updated_at = NOW()
WHERE id = '${sourceId}';
  `.trim();
}

/**
 * Create a healing audit log entry
 */
export function createHealingAuditEntry(
  sourceId: string,
  result: HealingResult
): Record<string, unknown> {
  return {
    source_id: sourceId,
    healed_at: new Date().toISOString(),
    success: result.success,
    confidence: result.confidence,
    old_event_count: 0,
    new_event_count: result.potentialEventCount,
    reasoning: result.reasoning,
    new_selectors: result.newSelectors
  };
}
