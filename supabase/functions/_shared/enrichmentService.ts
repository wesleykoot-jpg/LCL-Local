/**
 * Enrichment Service - Extracts "Social Five" data using OpenAI Structured Outputs
 * 
 * AI Injection Point: "Enrichment Engine" (Curator role)
 * 
 * This service is the core of Pass 2 (Enrichment) in the two-pass execution model.
 * It processes detail page HTML to extract high-fidelity social event data.
 * 
 * @module _shared/enrichmentService
 */

import { 
  SOCIAL_FIVE_SCHEMA, 
  SocialFiveEvent, 
  EnrichmentHints,
  EnrichmentResult,
  calculateSocialFiveScore,
  isSocialFiveComplete
} from "./socialFiveSchema.ts";
import { htmlToMarkdown } from "./markdownUtils.ts";
import { detectLanguage } from "./languageDetection.ts";
import { classifyVibeFromCategory } from "./vibeClassifier.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_MARKDOWN_LENGTH = 8000;
const MAX_RETRIES = 2;

// ============================================================================
// ENRICHMENT OPTIONS
// ============================================================================

export interface EnrichmentOptions {
  /** Raw HTML of the detail page */
  detailHtml: string;
  /** Base URL for resolving relative URLs */
  baseUrl: string;
  /** Hints from Pass 1 discovery */
  hints: EnrichmentHints;
  /** Target year for date validation */
  targetYear?: number;
  /** OpenAI model to use */
  model?: string;
  /** Skip AI and use rules-only (for cost saving) */
  rulesOnly?: boolean;
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

/**
 * Extract Social Five data from event detail page using OpenAI Structured Outputs.
 * Falls back to rules-based extraction if AI fails.
 */
export async function enrichWithSocialFive(
  apiKey: string,
  options: EnrichmentOptions,
  fetcher: typeof fetch = fetch
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const { detailHtml, baseUrl, hints, targetYear = new Date().getFullYear(), model = DEFAULT_MODEL, rulesOnly = false } = options;
  
  // Quick extraction for rules-only mode
  if (rulesOnly) {
    const rulesResult = extractWithRules(detailHtml, baseUrl, hints);
    return {
      success: rulesResult !== null,
      event: rulesResult,
      socialFiveScore: rulesResult ? calculateSocialFiveScore(rulesResult) : 0,
      confidence: 0.5,
      processingTimeMs: Date.now() - startTime
    };
  }
  
  // Convert HTML to Markdown for cleaner AI processing
  const markdown = htmlToMarkdown(detailHtml, { baseUrl, maxLength: MAX_MARKDOWN_LENGTH });
  
  // Detect language from content (fallback for AI)
  const detectedLanguage = detectLanguage(markdown);
  
  // Build prompts
  const systemPrompt = buildSystemPrompt(targetYear);
  const userPrompt = buildUserPrompt(baseUrl, hints, markdown);
  
  // Call OpenAI with Structured Outputs
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetcher(OPENAI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: {
            type: "json_schema",
            json_schema: SOCIAL_FIVE_SCHEMA
          },
          temperature: 0.1,
          max_tokens: 1024
        })
      });

      if (response.status === 429) {
        // Rate limited - wait and retry
        const retryAfter = parseInt(response.headers.get("retry-after") || "5");
        console.warn(`OpenAI rate limit, waiting ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI error ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.error("Empty response from OpenAI enrichment");
        continue;
      }

      const event = JSON.parse(content) as SocialFiveEvent;
      
      // Validate and enhance
      const validatedEvent = validateAndEnhance(event, detectedLanguage, hints);
      const score = calculateSocialFiveScore(validatedEvent);
      
      return {
        success: true,
        event: validatedEvent,
        socialFiveScore: score,
        confidence: score / 5,
        processingTimeMs: Date.now() - startTime
      };
      
    } catch (error) {
      console.error(`Enrichment attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES) {
        // Fall back to rules-based extraction
        const rulesResult = extractWithRules(detailHtml, baseUrl, hints);
        return {
          success: rulesResult !== null,
          event: rulesResult,
          socialFiveScore: rulesResult ? calculateSocialFiveScore(rulesResult) : 0,
          confidence: 0.3,
          processingTimeMs: Date.now() - startTime,
          error: `AI failed after ${MAX_RETRIES + 1} attempts, used rules fallback`
        };
      }
    }
  }
  
  return {
    success: false,
    event: null,
    socialFiveScore: 0,
    confidence: 0,
    processingTimeMs: Date.now() - startTime,
    error: "All enrichment attempts failed"
  };
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildSystemPrompt(targetYear: number): string {
  return `You are a precise event data extraction agent for a Dutch social events platform.

Your task is to extract the "Social Five" data points from event pages:

1. **Start Time & Doors Open**: Distinguish between when doors/entry opens vs. when the main event starts
2. **Precise Location**: Extract venue name AND full street address (must be map-ready)
3. **Duration/End Time**: When the event ends or estimated duration in minutes
4. **Language Profile**: NL=Dutch, EN=English, Mixed=both, Other=neither
5. **Interaction Mode**: 
   - high = workshops, networking events, meetups (lots of talking to strangers)
   - medium = concerts, markets, festivals (some interaction)
   - low = talks, lectures, presentations (mostly listening)
   - passive = movies, exhibitions, theater (no interaction expected)

Rules:
- Only extract events in ${targetYear} or later
- Use 24-hour time format (HH:MM)
- If end_time unknown, estimate duration_minutes based on event type
- Detect language from event description and any "English spoken" indicators
- Always return valid JSON matching the schema exactly`;
}

function buildUserPrompt(baseUrl: string, hints: EnrichmentHints, markdown: string): string {
  const today = new Date().toISOString().split("T")[0];
  
  return `Today's date: ${today}
Event page URL: ${baseUrl}

Hints from listing page:
- Title: ${hints.title || 'Unknown'}
- Date hint: ${hints.date || 'Unknown'}
- Location hint: ${hints.location || 'Unknown'}

Page content (Markdown):
${markdown}

Extract the Social Five data. If a field cannot be determined, use your best inference based on context.`;
}

// ============================================================================
// VALIDATION & ENHANCEMENT
// ============================================================================

function validateAndEnhance(
  event: SocialFiveEvent, 
  detectedLanguage: string,
  hints: EnrichmentHints
): SocialFiveEvent {
  // Use detected language if AI didn't provide one
  if (!event.language_profile || event.language_profile === 'Other') {
    event.language_profile = detectedLanguage as SocialFiveEvent['language_profile'];
  }
  
  // Validate time formats
  if (event.start_time && !event.start_time.match(/^\d{2}:\d{2}$/)) {
    // Try to fix common formats
    const match = event.start_time.match(/(\d{1,2})[:\.](\d{2})/);
    if (match) {
      event.start_time = `${match[1].padStart(2, '0')}:${match[2]}`;
    }
  }
  
  if (event.doors_open_time && !event.doors_open_time.match(/^\d{2}:\d{2}$/)) {
    const match = event.doors_open_time.match(/(\d{1,2})[:\.](\d{2})/);
    if (match) {
      event.doors_open_time = `${match[1].padStart(2, '0')}:${match[2]}`;
    } else {
      event.doors_open_time = null;
    }
  }
  
  // Validate date format
  if (event.event_date && !event.event_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Try to parse from hints
    if (hints.date) {
      const parsed = parseLooseDate(hints.date);
      if (parsed) event.event_date = parsed;
    }
  }
  
  // Ensure persona_tags is an array
  if (!event.persona_tags) {
    event.persona_tags = [];
  }
  
  // Add ExpatFriendly tag if English
  if (event.language_profile === 'EN' || event.language_profile === 'Mixed') {
    if (!event.persona_tags.includes('ExpatFriendly')) {
      event.persona_tags.push('ExpatFriendly');
    }
  }
  
  return event;
}

// ============================================================================
// RULES-BASED FALLBACK
// ============================================================================

function extractWithRules(
  html: string, 
  baseUrl: string, 
  hints: EnrichmentHints
): SocialFiveEvent | null {
  try {
    // Basic extraction using regex patterns
    const title = hints.title || extractTitle(html) || 'Unknown Event';
    const date = hints.date ? parseLooseDate(hints.date) : null;
    const time = extractTime(html);
    const venue = hints.location || extractVenue(html);
    const description = extractDescription(html);
    const language = detectLanguage(description || title);
    
    // Infer interaction mode from category hints
    const vibeResult = classifyVibeFromCategory('CULTURE', description || '');
    
    if (!date) return null;
    
    return {
      title,
      description: description?.slice(0, 500),
      event_date: date,
      start_time: time || '20:00', // Default evening start
      venue_name: venue || 'TBD',
      language_profile: language as SocialFiveEvent['language_profile'],
      interaction_mode: vibeResult.interaction_mode,
      category: 'CULTURE',
      persona_tags: vibeResult.persona_tags
    };
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractTitle(html: string): string | null {
  // Try og:title first
  const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];
  
  // Try <title>
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) return titleMatch[1].split('|')[0].trim();
  
  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  
  return null;
}

function extractTime(html: string): string | null {
  // Common Dutch time patterns
  const patterns = [
    /(\d{2}):(\d{2})\s*(?:uur|u\.?)?/i,
    /aanvang[:\s]*(\d{1,2})[:\.](\d{2})/i,
    /start[:\s]*(\d{1,2})[:\.](\d{2})/i,
    /begint?[:\s]*(\d{1,2})[:\.](\d{2})/i,
    /doors?[:\s]*(\d{1,2})[:\.](\d{2})/i
  ];
  
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
  }
  
  return null;
}

function extractVenue(html: string): string | null {
  // Try structured data
  const ldMatch = html.match(/"location"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i);
  if (ldMatch) return ldMatch[1];
  
  // Try common venue class patterns
  const venueMatch = html.match(/class=["'][^"']*venue[^"']*["'][^>]*>([^<]+)/i);
  if (venueMatch) return venueMatch[1].trim();
  
  return null;
}

function extractDescription(html: string): string | null {
  // Try og:description
  const ogMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (ogMatch) return ogMatch[1];
  
  // Try meta description
  const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (metaMatch) return metaMatch[1];
  
  return null;
}

function parseLooseDate(dateStr: string): string | null {
  // Try various date formats
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return dateStr;
  
  // Dutch format: 15 januari 2026
  const dutchMonths: Record<string, string> = {
    januari: '01', februari: '02', maart: '03', april: '04',
    mei: '05', juni: '06', juli: '07', augustus: '08',
    september: '09', oktober: '10', november: '11', december: '12'
  };
  
  const dutchMatch = dateStr.toLowerCase().match(/(\d{1,2})\s*(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s*(\d{4})/);
  if (dutchMatch) {
    const day = dutchMatch[1].padStart(2, '0');
    const month = dutchMonths[dutchMatch[2]];
    const year = dutchMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

// ============================================================================
// BATCH ENRICHMENT
// ============================================================================

export interface BatchEnrichmentItem {
  id: string;
  detailHtml: string;
  baseUrl: string;
  hints: EnrichmentHints;
}

export interface BatchEnrichmentResult {
  id: string;
  result: EnrichmentResult;
}

/**
 * Enrich multiple events in parallel with rate limiting
 */
export async function batchEnrichWithSocialFive(
  apiKey: string,
  items: BatchEnrichmentItem[],
  options: { concurrency?: number; rulesOnly?: boolean } = {},
  fetcher: typeof fetch = fetch
): Promise<BatchEnrichmentResult[]> {
  const { concurrency = 3, rulesOnly = false } = options;
  const results: BatchEnrichmentResult[] = [];
  
  // Process in batches to respect rate limits
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (item) => {
      const result = await enrichWithSocialFive(apiKey, {
        detailHtml: item.detailHtml,
        baseUrl: item.baseUrl,
        hints: item.hints,
        rulesOnly
      }, fetcher);
      
      return { id: item.id, result };
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches
    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  return results;
}
