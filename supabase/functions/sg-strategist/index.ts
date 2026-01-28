/**
 * SG Strategist - Stage 2: Analyzer
 * 
 * Social Graph Intelligence Pipeline - Strategic Analyzer
 * 
 * Responsibilities:
 * - Analyzes discovered URLs
 * - Determines optimal fetch strategy (static/playwright/browserless)
 * - Detects anti-bot protection
 * - Routes to appropriate fetcher
 * 
 * Trigger: Processes 'discovered' stage items
 * 
 * @module sg-strategist
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, validateEnv } from "../_shared/sgEnv.ts";
import type { FetchStrategy, StrategistResponse, QueueItem } from "../_shared/sgTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// STRATEGY DETECTION
// ============================================================================

interface DomainProfile {
  domain: string;
  fetcher: 'static' | 'playwright' | 'browserless';
  wait_for?: string;
  anti_bot: boolean;
}

// Known domain profiles
const KNOWN_DOMAINS: Record<string, Partial<DomainProfile>> = {
  'eventbrite.com': { fetcher: 'playwright', wait_for: '.event-card', anti_bot: false },
  'meetup.com': { fetcher: 'playwright', wait_for: '[data-event-id]', anti_bot: false },
  'facebook.com': { fetcher: 'browserless', anti_bot: true },
  'ticketmaster.nl': { fetcher: 'playwright', wait_for: '.event-listing', anti_bot: true },
  'uitagenda.nl': { fetcher: 'static', anti_bot: false },
  'ontdekeindhoven.nl': { fetcher: 'static', anti_bot: false },
  'vvv': { fetcher: 'static', anti_bot: false },
};

/**
 * Detect if URL requires JavaScript rendering
 */
function detectsJsRequired(html: string): boolean {
  const jsSignals = [
    /__NEXT_DATA__/,
    /react-root/,
    /ng-app/,
    /data-reactid/,
    /window\.__INITIAL_STATE__/,
    /window\.Webflow/,
    /<noscript>.*enable JavaScript/i,
  ];
  
  return jsSignals.some(pattern => pattern.test(html));
}

/**
 * Detect anti-bot protection
 */
function detectsAntiBot(html: string, headers: Headers): boolean {
  // Header signals
  if (headers.get('cf-ray')) return true; // Cloudflare
  if (headers.get('x-akamai-transformed')) return true;
  
  // Content signals
  const antiBotSignals = [
    /captcha/i,
    /cloudflare/i,
    /challenge-form/i,
    /turnstile/i,
    /recaptcha/i,
    /hcaptcha/i,
    /Are you a robot/i,
    /Checking your browser/i,
  ];
  
  return antiBotSignals.some(pattern => pattern.test(html));
}

/**
 * Analyze URL and determine fetch strategy
 */
async function analyzeUrl(url: string): Promise<FetchStrategy> {
  // Check known domains first
  for (const [pattern, profile] of Object.entries(KNOWN_DOMAINS)) {
    if (url.includes(pattern)) {
      return {
        fetcher: profile.fetcher || 'static',
        wait_for: profile.wait_for,
        anti_bot: profile.anti_bot || false,
        timeout_ms: 30000,
      };
    }
  }

  // Default strategy - try static first
  const defaultStrategy: FetchStrategy = {
    fetcher: 'static',
    anti_bot: false,
    timeout_ms: 15000,
  };

  try {
    // Quick HEAD request to check headers
    const headResponse = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LCL-Local/3.2; +https://lcl-local.app)',
      },
      redirect: 'follow',
    });

    // Check for anti-bot in headers
    if (detectsAntiBot('', headResponse.headers)) {
      return {
        ...defaultStrategy,
        fetcher: 'browserless',
        anti_bot: true,
      };
    }

    // Check content type
    const contentType = headResponse.headers.get('content-type');
    if (contentType && !contentType.includes('text/html')) {
      // Not HTML, mark for skip
      return {
        ...defaultStrategy,
        fetcher: 'static',
      };
    }

    // Quick GET to check for JS requirement
    const getResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LCL-Local/3.2; +https://lcl-local.app)',
      },
      redirect: 'follow',
    });

    const html = await getResponse.text();

    if (detectsAntiBot(html, getResponse.headers)) {
      return {
        ...defaultStrategy,
        fetcher: 'browserless',
        anti_bot: true,
      };
    }

    if (detectsJsRequired(html)) {
      return {
        ...defaultStrategy,
        fetcher: 'playwright',
      };
    }

    // Static is fine
    return defaultStrategy;

  } catch (error) {
    console.warn(`[Strategist] Failed to analyze ${url}:`, error);
    // Default to playwright as fallback
    return {
      ...defaultStrategy,
      fetcher: 'playwright',
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface StrategistPayload {
  limit?: number;
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
    let payload: StrategistPayload = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const { limit = 50, worker_id } = payload;
    const workerId = worker_id || crypto.randomUUID();

    console.log(`[SG Strategist] Processing up to ${limit} items`);

    const response: StrategistResponse = {
      success: true,
      items_analyzed: 0,
      items_ready: 0,
      errors: [],
    };

    // Claim items from 'discovered' stage
    const { data: claimed, error: claimError } = await supabase
      .rpc('sg_claim_for_stage', {
        p_stage: 'discovered',
        p_worker_id: workerId,
        p_limit: limit,
      });

    if (claimError) {
      throw new Error(`Failed to claim items: ${claimError.message}`);
    }

    if (!claimed || claimed.length === 0) {
      console.log('[SG Strategist] No items to process');
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SG Strategist] Claimed ${claimed.length} items`);

    // Analyze each URL
    for (const item of claimed) {
      try {
        const strategy = await analyzeUrl(item.source_url);
        response.items_analyzed++;

        // Update source with strategy
        await supabase
          .from('sg_sources')
          .update({
            fetch_strategy: strategy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.source_id);

        // Advance to next stage
        await supabase.rpc('sg_advance_stage', {
          p_item_id: item.id,
          p_next_stage: 'awaiting_fetch',
        });

        response.items_ready++;
        console.log(`[SG Strategist] ${item.source_url} -> ${strategy.fetcher}`);

      } catch (error) {
        console.error(`[SG Strategist] Failed to analyze ${item.source_url}:`, error);
        
        await supabase.rpc('sg_record_failure', {
          p_item_id: item.id,
          p_failure_level: 'transient',
          p_error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        response.errors.push(`${item.source_url}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SG Strategist] Completed in ${elapsed}ms: ${response.items_ready}/${response.items_analyzed} ready`);

    return new Response(
      JSON.stringify({
        ...response,
        duration_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SG Strategist] Fatal error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        items_analyzed: 0,
        items_ready: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
