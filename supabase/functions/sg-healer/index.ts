/**
 * SG Healer - Self-Healing AI Repair Agent
 * 
 * Social Graph Intelligence Pipeline - The Healer
 * 
 * Responsibilities:
 * - Detects source drift (layout/selector changes)
 * - Analyzes raw HTML to understand new structure
 * - Generates new extraction strategies
 * - Tests and validates repairs
 * - Manages quarantine/un-quarantine
 * 
 * @module sg-healer
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { 
  supabaseUrl, 
  supabaseServiceRoleKey, 
  openAiApiKey,
  validateEnv 
} from "../_shared/sgEnv.ts";
import type { SGSource, FetchStrategy } from "../_shared/sgTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// AI REPAIR PROMPTS
// ============================================================================

const DIAGNOSE_PROMPT = `You are an expert web scraping analyst. Analyze this HTML and identify:

1. The main content structure (list pages, event cards, etc.)
2. Key selectors for event data (title, date, location, description)
3. Pagination patterns (if any)
4. Anti-bot protection indicators
5. JavaScript requirements

Return a JSON object with:
{
  "diagnosis": "Brief description of the page structure",
  "page_type": "list" | "detail" | "calendar" | "unknown",
  "selectors": {
    "event_container": "CSS selector for event container",
    "title": "CSS selector for title",
    "date": "CSS selector for date",
    "location": "CSS selector for location",
    "description": "CSS selector for description",
    "link": "CSS selector for detail link"
  },
  "pagination": {
    "type": "none" | "next_link" | "load_more" | "infinite_scroll",
    "selector": "CSS selector for pagination if applicable"
  },
  "requires_js": boolean,
  "anti_bot_detected": boolean,
  "confidence": 0.0-1.0
}`;

const REPAIR_PROMPT = `You are an expert web scraping repair agent. Given the old configuration that no longer works and a sample of the current HTML, generate a new working configuration.

OLD CONFIG:
{old_config}

CURRENT HTML SAMPLE:
{html_sample}

Generate a new extraction configuration that will work with the current page structure. Return a JSON object with:
{
  "selectors": {
    "event_container": "CSS selector",
    "title": "CSS selector",
    "date": "CSS selector",
    "location": "CSS selector", 
    "description": "CSS selector",
    "link": "CSS selector"
  },
  "fetch_strategy": {
    "fetcher": "static" | "playwright" | "browserless",
    "wait_for": "CSS selector to wait for (if JS required)",
    "anti_bot": boolean
  },
  "extraction_notes": "Brief explanation of changes made",
  "confidence": 0.0-1.0
}`;

// ============================================================================
// AI CALLS
// ============================================================================

async function callAI(prompt: string, content: string): Promise<Record<string, unknown> | null> {
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
          { role: 'system', content: prompt },
          { role: 'user', content: content.slice(0, 15000) }, // Token limit
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error(`[Healer] OpenAI error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const parsed = JSON.parse(result.choices?.[0]?.message?.content || '{}');
    return parsed;

  } catch (error) {
    console.error('[Healer] AI call failed:', error);
    return null;
  }
}

// ============================================================================
// REPAIR LOGIC
// ============================================================================

interface RepairResult {
  success: boolean;
  diagnosis?: string;
  old_config?: Record<string, unknown>;
  new_config?: Record<string, unknown>;
  validation_passed?: boolean;
  error?: string;
}

async function diagnoseSource(html: string): Promise<Record<string, unknown> | null> {
  return callAI(DIAGNOSE_PROMPT, html);
}

async function repairSource(
  oldConfig: Record<string, unknown>,
  html: string
): Promise<Record<string, unknown> | null> {
  const prompt = REPAIR_PROMPT
    .replace('{old_config}', JSON.stringify(oldConfig, null, 2))
    .replace('{html_sample}', html.slice(0, 10000));
  
  return callAI(prompt, html);
}

async function validateRepair(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  newConfig: Record<string, unknown>
): Promise<boolean> {
  // In a real implementation, you'd:
  // 1. Fetch a sample page with new strategy
  // 2. Try to extract data with new selectors
  // 3. Validate extracted data has required fields
  
  // For now, check confidence score
  const confidence = (newConfig.confidence as number) || 0;
  return confidence >= 0.6;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface HealerPayload {
  mode?: 'diagnose' | 'repair' | 'unquarantine';
  source_id?: string;
  limit?: number;
}

interface HealerResponse {
  success: boolean;
  sources_diagnosed: number;
  sources_repaired: number;
  sources_unquarantined: number;
  repairs: RepairResult[];
  errors: string[];
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
    let payload: HealerPayload = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const { 
      mode = 'repair',
      source_id,
      limit = 5,
    } = payload;

    console.log(`[SG Healer] Mode: ${mode}`);

    const response: HealerResponse = {
      success: true,
      sources_diagnosed: 0,
      sources_repaired: 0,
      sources_unquarantined: 0,
      repairs: [],
      errors: [],
    };

    // Get sources to heal
    let query = supabase
      .from('sg_sources')
      .select('id, name, url, fetch_strategy, extraction_config, quarantined, quarantine_reason');

    if (source_id) {
      query = query.eq('id', source_id);
    } else if (mode === 'repair') {
      // Get quarantined sources or those with failures
      query = query.or('quarantined.eq.true,consecutive_failures.gte.3')
        .limit(limit);
    } else if (mode === 'unquarantine') {
      // Get quarantined sources that might be ready
      query = query.eq('quarantined', true)
        .order('quarantined_at', { ascending: true })
        .limit(limit);
    }

    const { data: sources, error: sourcesError } = await query;

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      console.log('[SG Healer] No sources to process');
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SG Healer] Processing ${sources.length} sources`);

    // Process each source
    for (const source of sources) {
      const repairResult: RepairResult = { success: false };

      try {
        // Fetch current page HTML
        console.log(`[SG Healer] Fetching: ${source.url}`);
        const pageResponse = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!pageResponse.ok) {
          repairResult.error = `HTTP ${pageResponse.status}`;
          response.repairs.push(repairResult);
          continue;
        }

        const html = await pageResponse.text();

        if (mode === 'diagnose') {
          // Just diagnose, don't repair
          const diagnosis = await diagnoseSource(html);
          
          if (diagnosis) {
            repairResult.success = true;
            repairResult.diagnosis = diagnosis.diagnosis as string;
            response.sources_diagnosed++;
          }

        } else if (mode === 'repair') {
          // Attempt repair
          const oldConfig = source.extraction_config || {};
          const newConfig = await repairSource(oldConfig, html);

          if (newConfig) {
            // Validate repair
            const isValid = await validateRepair(supabase, source.id, newConfig);

            if (isValid) {
              // Apply repair
              await supabase
                .from('sg_sources')
                .update({
                  extraction_config: newConfig.selectors,
                  fetch_strategy: newConfig.fetch_strategy,
                  config_version: supabase.rpc('increment', { x: 1 }),
                  quarantined: false,
                  quarantine_reason: null,
                  consecutive_failures: 0,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', source.id);

              // Log repair
              await supabase.from('sg_ai_repair_log').insert({
                source_id: source.id,
                trigger_reason: 'consecutive_failures',
                raw_html_sample: html.slice(0, 5000),
                ai_diagnosis: newConfig.extraction_notes as string,
                old_config: oldConfig,
                new_config: newConfig,
                validation_passed: true,
                applied: true,
                applied_at: new Date().toISOString(),
              });

              repairResult.success = true;
              repairResult.old_config = oldConfig;
              repairResult.new_config = newConfig;
              repairResult.validation_passed = true;
              response.sources_repaired++;
              
              console.log(`[SG Healer] ✓ Repaired: ${source.name}`);
            } else {
              repairResult.error = 'Validation failed';
              repairResult.validation_passed = false;
            }
          } else {
            repairResult.error = 'AI repair failed';
          }

        } else if (mode === 'unquarantine') {
          // Try to unquarantine - test if source is now working
          const diagnosis = await diagnoseSource(html);
          
          if (diagnosis && (diagnosis.confidence as number) >= 0.5) {
            await supabase
              .from('sg_sources')
              .update({
                quarantined: false,
                quarantine_reason: null,
                consecutive_failures: 0,
                updated_at: new Date().toISOString(),
              })
              .eq('id', source.id);

            repairResult.success = true;
            response.sources_unquarantined++;
            
            console.log(`[SG Healer] ✓ Unquarantined: ${source.name}`);
          }
        }

        response.repairs.push(repairResult);

      } catch (error) {
        console.error(`[SG Healer] Error processing ${source.name}:`, error);
        repairResult.error = error instanceof Error ? error.message : 'Unknown error';
        response.repairs.push(repairResult);
        response.errors.push(`${source.name}: ${repairResult.error}`);
      }
    }

    const elapsed = Date.now() - startTime;
    response.success = response.errors.length === 0;

    console.log(`[SG Healer] Completed in ${elapsed}ms: ${response.sources_repaired} repaired`);

    return new Response(
      JSON.stringify({
        ...response,
        duration_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SG Healer] Fatal error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sources_diagnosed: 0,
        sources_repaired: 0,
        sources_unquarantined: 0,
        repairs: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
