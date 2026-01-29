/**
 * SG Curator - Stage 3: Extraction & Enrichment
 * 
 * Social Graph Intelligence Pipeline - The Curator
 * 
 * Responsibilities:
 * - Fetches page content (static/playwright/browserless)
 * - Cleans HTML to Markdown
 * - Extracts "Social Five" using AI
 * - Validates extracted data
 * - Enriches with geocoding
 * - Deduplicates
 * 
 * This is the most complex stage - handles substages 3a-3f
 * 
 * @module sg-curator
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { 
  supabaseUrl, 
  supabaseServiceRoleKey, 
  openAiApiKey,
  browserlessApiKey,
  browserlessEndpoint,
  validateEnv 
} from "../_shared/sgEnv.ts";
import { geocodeHybrid, extractCoordsFromHtml } from "../_shared/sgGeocodeHybrid.ts";
import { htmlToMarkdown } from "../_shared/markdownUtils.ts";
import type { CuratorResponse, SocialEvent, QueueItem, FetchStrategy } from "../_shared/sgTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// FETCHERS
// ============================================================================

async function fetchStatic(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

async function fetchWithBrowserless(url: string, waitFor?: string): Promise<string> {
  if (!browserlessApiKey) {
    console.warn('[Curator] No Browserless API key, falling back to static');
    return fetchStatic(url);
  }

  const response = await fetch(`${browserlessEndpoint}/content?token=${browserlessApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      waitFor: waitFor || 'body',
      timeout: 30000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Browserless error: ${response.status}`);
  }

  return response.text();
}

async function fetchPage(url: string, strategy: FetchStrategy): Promise<string> {
  switch (strategy.fetcher) {
    case 'browserless':
      return fetchWithBrowserless(url, strategy.wait_for);
    case 'playwright':
      // For now, treat playwright same as browserless
      // In production, you'd have a separate Playwright service
      return browserlessApiKey ? fetchWithBrowserless(url, strategy.wait_for) : fetchStatic(url);
    default:
      return fetchStatic(url);
  }
}

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /HTTP\s+(401|403|429|503)/i.test(error.message) || /forbidden|too many requests|captcha/i.test(error.message);
}

// ============================================================================
// SELF-HEALING TRIGGER
// ============================================================================

const HEALING_THRESHOLD = 3; // Trigger healing after this many consecutive failures

/**
 * Check if a source needs healing and trigger it if threshold is met.
 * Does not block the main flow - just queues the healer.
 */
async function maybeQueueHealing(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  failureReason: string
): Promise<void> {
  try {
    // Get current failure count
    const { data: source } = await supabase
      .from('sg_sources')
      .select('consecutive_failures, quarantined, name')
      .eq('id', sourceId)
      .single();

    if (!source) return;

    const failures = (source.consecutive_failures || 0) + 1;

    // Update failure count
    await supabase
      .from('sg_sources')
      .update({ consecutive_failures: failures })
      .eq('id', sourceId);

    // Trigger healing if threshold reached and not already quarantined
    if (failures >= HEALING_THRESHOLD && !source.quarantined) {
      console.log(`[SG Curator] Source ${source.name} hit ${failures} failures, triggering healer`);
      
      // Fire-and-forget healer invocation
      fetch(`${supabaseUrl}/functions/v1/sg-healer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'repair',
          source_id: sourceId,
        }),
      }).catch(err => {
        console.warn(`[SG Curator] Failed to invoke healer: ${err.message}`);
      });
    }
  } catch (err) {
    console.warn(`[SG Curator] Error checking healing status: ${err}`);
  }
}

// ============================================================================
// IMAGE FALLBACKS
// ============================================================================

function resolveUrl(baseUrl: string, maybeUrl: string): string {
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return maybeUrl;
  }
}

function isLikelyTrackingUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  return (
    lowered.includes('facebook.com/tr') ||
    lowered.includes('doubleclick') ||
    lowered.includes('googletagmanager') ||
    lowered.includes('google-analytics') ||
    lowered.includes('analytics') ||
    lowered.includes('pixel') ||
    lowered.includes('adsystem')
  );
}

function isLikelyImageUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  if (isLikelyTrackingUrl(lowered)) return false;
  return (
    lowered.endsWith('.jpg') ||
    lowered.endsWith('.jpeg') ||
    lowered.endsWith('.png') ||
    lowered.endsWith('.webp') ||
    lowered.endsWith('.gif') ||
    lowered.includes('image') ||
    lowered.includes('img')
  );
}

function extractImageUrlFromHtml(html: string, sourceUrl: string): string | null {
  const metaMatches = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["'][^>]*>/i,
  ];

  for (const regex of metaMatches) {
    const match = html.match(regex);
    if (match?.[1]) {
      const candidate = resolveUrl(sourceUrl, match[1]);
      if (isLikelyImageUrl(candidate)) {
        return candidate;
      }
    }
  }

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch?.[1]) {
    const candidate = resolveUrl(sourceUrl, imgMatch[1]);
    return isLikelyImageUrl(candidate) ? candidate : null;
  }

  return null;
}

// ============================================================================
// AI EXTRACTION
// ============================================================================

const SOCIAL_FIVE_SYSTEM_PROMPT = `You are an expert event data extractor. Extract structured event information from the provided webpage content.

CRITICAL RULES:
1. NEVER hallucinate dates, times, or locations. If not clearly stated, return null.
2. Dates must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS).
3. Locations must include actual venue names and addresses from the content.
4. Confidence scores should reflect how clearly the data was stated.

Return a JSON object matching this schema exactly:
{
  "what": {
    "title": "Event title (required)",
    "description": "Brief description",
    "category": "One of: cinema, crafts, sports, gaming, market, food, music, wellness, family, outdoor, nightlife, cultural, community",
    "tags": ["relevant", "tags"]
  },
  "when": {
    "start_datetime": "ISO 8601 datetime or null",
    "end_datetime": "ISO 8601 datetime or null",
    "is_recurring": boolean,
    "timezone": "Europe/Amsterdam"
  },
  "where": {
    "venue_name": "Venue name or null",
    "address": "Street address or null",
    "city": "City name",
    "country_code": "NL",
    "postal_code": "Postal code or null"
  },
  "who": {
    "organizer_name": "Organizer or null",
    "expected_attendance": number or null,
    "target_audience": ["audience", "types"]
  },
  "vibe": {
    "interaction_mode": "active|passive|mixed",
    "energy_level": "chill|moderate|high",
    "social_context": ["dating-friendly", "family-friendly", etc.],
    "expat_friendly": boolean,
    "language": "nl" or "en"
  },
  "image_url": "URL or null",
  "ticket_url": "URL or null",
  "price_info": "Price text or null",
  "is_free": boolean,
  "extraction_confidence": 0.0-1.0,
  "data_completeness": 0.0-1.0
}`;

async function extractWithAI(markdown: string, sourceUrl: string): Promise<SocialEvent | null> {
  const truncatedMarkdown = markdown.slice(0, 12000); // Token limit safety

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SOCIAL_FIVE_SYSTEM_PROMPT },
          { role: 'user', content: `Extract event data from this webpage:\n\nURL: ${sourceUrl}\n\nContent:\n${truncatedMarkdown}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const parsed = JSON.parse(content);
    
    // Add source URL
    parsed.source_url = sourceUrl;
    
    return parsed as SocialEvent;

  } catch (error) {
    console.error('[Curator] AI extraction failed:', error);
    return null;
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Check if a URL is a listing/main page rather than an event detail page
 */
function isListingPage(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    
    // Known listing page patterns
    const listingPatterns = [
      /^\/?(en|nl)?\/?(agenda|events|calendar|programma|concerten)?\/?$/,
      /\/b\/netherlands/,  // Eventbrite listing pages
      /\/metro-areas\//,   // Songkick metro areas
      /\/concerten-en-tickets\/?$/,
      /\/live-music-calendar\/?$/,
    ];
    
    if (listingPatterns.some(p => p.test(path))) {
      return true;
    }
    
    // If path is very short (just /en, /nl, /agenda/) it's likely a listing page
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length <= 2 && !path.includes('-20') && !/\d{2}-\d{2}-\d{2,4}/.test(path)) {
      // Short paths without dates are likely listing pages
      const eventIndicators = ['event', 'ticket', 'concert', 'show', 'workshop'];
      if (!eventIndicators.some(i => path.includes(i)) || pathParts.length < 2) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if an image URL is valid (not a tracking pixel or site logo)
 */
function isValidEventImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return false;
  
  const lowered = imageUrl.toLowerCase();
  
  // Reject tracking pixels and common invalid patterns
  const invalidPatterns = [
    'facebook.com/tr',
    'google-analytics',
    'googletagmanager',
    'doubleclick',
    '/pixel',
    '/logo',
    'logo.svg',
    'logo.png',
    'og-image',
    'share-',
    'favicon',
    '1x1',
    'spacer',
  ];
  
  if (invalidPatterns.some(p => lowered.includes(p))) {
    return false;
  }
  
  // Check for reasonable image extensions or CDN patterns
  const validPatterns = [
    /\.(jpg|jpeg|png|webp|gif)/i,
    /assets\./,
    /images\//,
    /media\//,
    /cdn\./,
    /cloudfront/,
  ];
  
  return validPatterns.some(p => p.test(imageUrl));
}

function validateExtractedData(data: SocialEvent | null, sourceUrl: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!data) {
    result.valid = false;
    result.errors.push('No data extracted');
    return result;
  }

  // Check if we extracted from a listing page
  if (isListingPage(sourceUrl)) {
    result.valid = false;
    result.errors.push('Extracted from listing page, not event detail');
    return result;
  }

  // Required fields
  if (!data.what?.title) {
    result.valid = false;
    result.errors.push('Missing event title');
  }

  // Check for generic titles that suggest listing page extraction
  const genericTitlePatterns = [
    /^concerten in/i,
    /^events? in/i,
    /^agenda/i,
    /^calendar/i,
    /^upcoming events/i,
  ];
  if (data.what?.title && genericTitlePatterns.some(p => p.test(data.what.title))) {
    result.valid = false;
    result.errors.push('Generic listing page title detected');
  }

  if (!data.where?.city) {
    result.valid = false;
    result.errors.push('Missing city');
  }

  // Validate dates
  if (data.when?.start_datetime) {
    const startDate = new Date(data.when.start_datetime);
    if (isNaN(startDate.getTime())) {
      result.valid = false;
      result.errors.push('Invalid start datetime');
    } else if (startDate < new Date()) {
      result.warnings.push('Event is in the past');
    }
  } else {
    result.warnings.push('No start datetime');
  }

  // Validate description quality
  const descLength = data.what?.description?.length || 0;
  if (descLength < 20) {
    result.warnings.push(`Short description (${descLength} chars)`);
  }
  if (descLength === 0) {
    result.warnings.push('Empty description');
  }

  // Validate image quality
  if (!isValidEventImage(data.image_url)) {
    result.warnings.push('Invalid or missing event image');
  }

  // Check confidence
  if (data.extraction_confidence && data.extraction_confidence < 0.3) {
    result.warnings.push(`Low extraction confidence: ${data.extraction_confidence}`);
  }

  // Check data completeness
  if (data.data_completeness && data.data_completeness < 0.4) {
    result.warnings.push(`Low data completeness: ${data.data_completeness}`);
  }

  return result;
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function generateContentHash(data: SocialEvent): string {
  const hashInput = [
    data.what?.title?.toLowerCase().trim(),
    data.when?.start_datetime,
    data.where?.venue_name?.toLowerCase().trim(),
    data.where?.city?.toLowerCase().trim(),
  ].filter(Boolean).join('|');

  // Simple hash (in production, use proper hashing)
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface CuratorPayload {
  limit?: number;
  stage?: 'awaiting_fetch' | 'extracting' | 'enriching';
  worker_id?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate environment
  const envCheck = validateEnv();
  if (!envCheck.valid) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables", missing: envCheck.missing }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const startTime = Date.now();

  try {
    // Parse payload
    let payload: CuratorPayload = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const { 
      limit = 20, 
      stage = 'awaiting_fetch',
      worker_id 
    } = payload;
    const workerId = worker_id || crypto.randomUUID();

    console.log(`[SG Curator] Processing up to ${limit} items at stage: ${stage}`);

    const response: CuratorResponse = {
      success: true,
      items_processed: 0,
      items_enriched: 0,
      items_failed: 0,
      geo_incomplete: 0,
      errors: [],
    };

    // Claim items from specified stage
    const { data: claimed, error: claimError } = await supabase
      .rpc('sg_claim_for_stage', {
        p_stage: stage,
        p_worker_id: workerId,
        p_limit: limit,
      });

    if (claimError) {
      throw new Error(`Failed to claim items: ${claimError.message}`);
    }

    if (!claimed || claimed.length === 0) {
      console.log('[SG Curator] No items to process');
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SG Curator] Claimed ${claimed.length} items`);

    // Process each item through the substages
    for (const item of claimed) {
      response.items_processed++;

      try {
        // Get source strategy
        const { data: source } = await supabase
          .from('sg_sources')
          .select('fetch_strategy, extraction_config')
          .eq('id', item.source_id)
          .single();

        const strategy: FetchStrategy = source?.fetch_strategy || { fetcher: 'static' };

        // STAGE 3a: RENDER - Fetch the page
        const fetchUrl = item.detail_url || item.source_url;
        console.log(`[SG Curator] 3a. Fetching: ${fetchUrl}`);
        let html: string;
        try {
          html = await fetchPage(fetchUrl, strategy);
        } catch (error) {
          if (strategy.fetcher !== 'browserless' && browserlessApiKey && isRetryableFetchError(error)) {
            console.warn(`[SG Curator] Retry with browserless for: ${fetchUrl}`);
            html = await fetchWithBrowserless(fetchUrl, strategy.wait_for);
          } else {
            throw error;
          }
        }

        // Update with raw HTML
        await supabase
          .from('sg_pipeline_queue')
          .update({
            raw_html: html.slice(0, 100000), // Limit storage
            fetched_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        // STAGE 3b: CLEAN - Convert to Markdown
        console.log(`[SG Curator] 3b. Cleaning: ${fetchUrl}`);
        const markdown = htmlToMarkdown(html);

        await supabase
          .from('sg_pipeline_queue')
          .update({
            cleaned_markdown: markdown.slice(0, 50000),
          })
          .eq('id', item.id);

        // STAGE 3c: EXTRACT - AI extraction
        console.log(`[SG Curator] 3c. Extracting: ${fetchUrl}`);
        const extracted = await extractWithAI(markdown, fetchUrl);

        if (extracted) {
          const needsFallback = !extracted.image_url || isLikelyTrackingUrl(extracted.image_url);
          if (needsFallback) {
            const fallbackImage = extractImageUrlFromHtml(html, fetchUrl);
            if (fallbackImage) {
              extracted.image_url = fallbackImage;
            }
          }
        }

        // STAGE 3d: VALIDATE
        console.log(`[SG Curator] 3d. Validating: ${fetchUrl}`);
        const validation = validateExtractedData(extracted, fetchUrl);

        if (!validation.valid || !extracted) {
          console.warn(`[SG Curator] Validation failed: ${validation.errors.join(', ')}`);
          
          await supabase.rpc('sg_record_failure', {
            p_item_id: item.id,
            p_failure_level: 'transient',
            p_error_message: `Validation failed: ${validation.errors.join(', ')}`,
          });

          // Trigger self-healing if source has repeated failures
          await maybeQueueHealing(supabase, item.source_id, validation.errors.join(', '));

          response.items_failed++;
          continue;
        }

        // Log validation warnings for observability
        if (validation.warnings.length > 0) {
          console.log(`[SG Curator] Validation warnings for ${fetchUrl}: ${validation.warnings.join(', ')}`);
        }

        // STAGE 3e: ENRICH - Hybrid Geocoding (extract from HTML first, then multi-provider)
        console.log(`[SG Curator] 3e. Enriching (hybrid geocoding): ${fetchUrl}`);
        let lat: number | undefined;
        let lng: number | undefined;

        if (extracted.where) {
          // Try hybrid geocoding: HTML extraction → fuzzy cache → multi-provider
          const geoResult = await geocodeHybrid(
            extracted.where.venue_name,
            extracted.where.address,
            extracted.where.postal_code,
            extracted.where.city,
            extracted.where.country_code || 'NL',
            html // Pass raw HTML for coordinate extraction
          );

          if (geoResult) {
            lat = geoResult.lat;
            lng = geoResult.lng;
            extracted.where.lat = lat;
            extracted.where.lng = lng;
            console.log(`[SG Curator] Geocoded: (${lat}, ${lng}) via ${geoResult.cached ? 'cache' : geoResult.place_type}`);
          }
        }

        // STAGE 3f: DEDUPLICATE
        console.log(`[SG Curator] 3f. Deduplicating: ${fetchUrl}`);
        const contentHash = generateContentHash(extracted);

        // Check for existing hash
        const { data: duplicate } = await supabase
          .from('sg_pipeline_queue')
          .select('id')
          .eq('content_hash', contentHash)
          .eq('stage', 'indexed')
          .single();

        if (duplicate) {
          console.log(`[SG Curator] Duplicate found, marking: ${fetchUrl}`);
          
          await supabase
            .from('sg_pipeline_queue')
            .update({
              duplicate_of: duplicate.id,
              stage: 'failed',
              last_failure_reason: 'Duplicate detected',
            })
            .eq('id', item.id);

          response.items_failed++;
          continue;
        }

        // Determine next stage
        const nextStage = (lat && lng) ? 'ready_to_persist' : 'geo_incomplete';

        if (nextStage === 'geo_incomplete') {
          response.geo_incomplete++;
        }

        // Update queue item
        await supabase.rpc('sg_advance_stage', {
          p_item_id: item.id,
          p_next_stage: nextStage,
          p_extracted_data: extracted,
          p_lat: lat,
          p_lng: lng,
        });

        await supabase
          .from('sg_pipeline_queue')
          .update({
            content_hash: contentHash,
            geocode_status: (lat && lng) ? 'success' : 'failed',
            geocode_attempts: 1,
          })
          .eq('id', item.id);

        // Update source health
        await supabase
          .from('sg_sources')
          .update({
            consecutive_failures: 0,
            reliability_score: 1.0,
            total_events_extracted: supabase.rpc('increment', { x: 1 }),
            last_successful_scrape: new Date().toISOString(),
          })
          .eq('id', item.source_id);

        response.items_enriched++;
        console.log(`[SG Curator] ✓ Completed: ${extracted.what?.title || fetchUrl}`);

      } catch (error) {
        console.error(`[SG Curator] Failed processing ${item.source_url}:`, error);
        
        await supabase.rpc('sg_record_failure', {
          p_item_id: item.id,
          p_failure_level: 'transient',
          p_error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        // Trigger self-healing if source has repeated failures
        await maybeQueueHealing(
          supabase, 
          item.source_id, 
          error instanceof Error ? error.message : 'Unknown error'
        );

        response.items_failed++;
        response.errors.push(`${item.source_url}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SG Curator] Completed in ${elapsed}ms: ${response.items_enriched}/${response.items_processed} enriched`);

    return new Response(
      JSON.stringify({
        ...response,
        duration_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SG Curator] Fatal error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        items_processed: 0,
        items_enriched: 0,
        items_failed: 0,
        geo_incomplete: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
