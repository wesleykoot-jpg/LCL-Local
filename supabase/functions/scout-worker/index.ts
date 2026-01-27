/**
 * Scout Worker - AI-Powered Scraper Architect
 * 
 * This Edge Function implements the "Scout" tier of the Scout-Execute-Self-Heal architecture.
 * It uses GLM-4.7 (or compatible high-reasoning models) to analyze website HTML structure
 * and generate deterministic extraction recipes that the Executor can use cheaply.
 * 
 * Triggered when:
 * - New source is added (scout_status = 'pending_scout')
 * - Extraction fails repeatedly (scout_status = 'needs_re_scout')
 * 
 * @module scout-worker
 */

// @ts-expect-error: Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, glmApiKey, openAiApiKey } from "../_shared/env.ts";
import { generateExtractionRecipe, ExtractionRecipe, callGLM, callOpenAI } from "../_shared/aiParsing.ts";
import { StaticPageFetcher } from "../_shared/strategies.ts";
import { logError, logInfo } from "../_shared/errorLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoutResult {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'failed';
  recipe?: ExtractionRecipe;
  error?: string;
  executionTimeMs: number;
}

/**
 * Gets population tier based on city size.
 * Tier 1: >100k (major cities like Amsterdam, Rotterdam)
 * Tier 2: 20k-100k (medium cities like Zwolle, Meppel)
 * Tier 3: <20k (small towns)
 */
function getPopulationTier(population?: number): 1 | 2 | 3 {
  if (!population) return 3;
  if (population > 100000) return 1;
  if (population > 20000) return 2;
  return 3;
}

/**
 * Extracts city name from source URL or name.
 */
function extractCityName(sourceName: string, sourceUrl: string): string | undefined {
  // Try to extract from common patterns
  const urlMatch = sourceUrl.match(/ontdek(\w+)|beleef(\w+)|visit(\w+)|uit(\w+)|(\w+)\.nl/i);
  if (urlMatch) {
    const city = urlMatch[1] || urlMatch[2] || urlMatch[3] || urlMatch[4] || urlMatch[5];
    if (city && city.length > 2) {
      return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    }
  }
  
  // Try to extract from source name
  const nameMatch = sourceName.match(/(?:Ontdek|Beleef|Visit|Uit)\s*(\w+)/i);
  if (nameMatch) {
    return nameMatch[1];
  }
  
  return undefined;
}

/**
 * Processes a single source: fetches HTML, generates recipe, saves to database.
 */
async function scoutSource(
  supabase: ReturnType<typeof createClient>,
  source: {
    id: string;
    name: string;
    url: string;
    city_population_tier?: number;
    location_name?: string;
  },
  aiApiKey: string
): Promise<ScoutResult> {
  const startTime = Date.now();
  const sourceId = source.id;
  const sourceName = source.name;
  
  console.log(`[Scout] Starting analysis of ${sourceName} (${source.url})`);
  
  try {
    // 1. Fetch the source HTML
    const fetcher = new StaticPageFetcher();
    const { html, statusCode } = await fetcher.fetchPage(source.url);
    
    if (statusCode >= 400) {
      throw new Error(`HTTP ${statusCode} fetching source`);
    }
    
    if (!html || html.length < 500) {
      throw new Error('HTML too short or empty');
    }
    
    console.log(`[Scout] Fetched ${html.length} bytes from ${sourceName}`);
    
    // 2. Prepare context for recipe generation
    const cityName = source.location_name || extractCityName(sourceName, source.url);
    const tier = (source.city_population_tier || 3) as 1 | 2 | 3;
    
    const sourceContext = {
      cityName,
      tier,
      sourceUrl: source.url,
      sourceName,
    };
    
    // 3. Generate extraction recipe using AI
    console.log(`[Scout] Generating recipe for ${sourceName} (Tier ${tier})`);
    const recipe = await generateExtractionRecipe(aiApiKey, html, sourceContext);
    
    if (!recipe) {
      throw new Error('Failed to generate extraction recipe');
    }
    
    console.log(`[Scout] Recipe generated for ${sourceName}:`, {
      mode: recipe.mode,
      container: recipe.config.container,
      item: recipe.config.item,
      requiresRender: recipe.requires_render,
    });
    
    // 4. Save recipe to database using RPC
    const { error: activateError } = await supabase.rpc('activate_scout', {
      p_source_id: sourceId,
      p_recipe: recipe,
    });
    
    if (activateError) {
      throw new Error(`Failed to save recipe: ${activateError.message}`);
    }
    
    // 5. Update tier if we detected one
    if (tier !== 3) {
      await supabase
        .from('scraper_sources')
        .update({ city_population_tier: tier })
        .eq('id', sourceId);
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    await logInfo('scout-worker', 'scoutSource', `Recipe generated for ${sourceName}`, {
      source_id: sourceId,
      source_name: sourceName,
      mode: recipe.mode,
      requires_render: recipe.requires_render,
      execution_time_ms: executionTimeMs,
    });
    
    return {
      sourceId,
      sourceName,
      status: 'success',
      recipe,
      executionTimeMs,
    };
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    console.error(`[Scout] Failed for ${sourceName}:`, errorMsg);
    
    // Mark source back to pending for retry (with a delay)
    await supabase
      .from('scraper_sources')
      .update({
        scout_status: 'pending_scout', // Will be retried later
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId);
    
    await logError({
      level: 'error',
      source: 'scout-worker',
      function_name: 'scoutSource',
      message: `Scout failed for ${sourceName}: ${errorMsg}`,
      error_type: 'scout_failure',
      stack_trace: error instanceof Error ? error.stack : undefined,
      context: {
        source_id: sourceId,
        source_name: sourceName,
        source_url: source.url,
        execution_time_ms: executionTimeMs,
      },
    });
    
    return {
      sourceId,
      sourceName,
      status: 'failed',
      error: errorMsg,
      executionTimeMs,
    };
  }
}

/**
 * Main handler for the Scout Worker.
 */
export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  
  try {
    // Get AI API key (prefer GLM, fallback to OpenAI)
    const aiApiKey = glmApiKey || openAiApiKey;
    
    if (!aiApiKey) {
      throw new Error("Missing AI API key (GLM_API_KEY or OPENAI_API_KEY)");
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Parse optional payload
    let targetSourceId: string | undefined;
    let batchSize = 3; // Default batch size
    
    if (req.method === "POST") {
      try {
        const payload = await req.json();
        targetSourceId = payload.sourceId;
        batchSize = payload.batchSize || batchSize;
      } catch {
        // Ignore empty body
      }
    }
    
    let sourcesToScout: Array<{
      id: string;
      name: string;
      url: string;
      city_population_tier?: number;
      location_name?: string;
    }> = [];
    
    if (targetSourceId) {
      // Single source mode
      const { data: source, error } = await supabase
        .from('scraper_sources')
        .select('id, name, url, city_population_tier, location_name')
        .eq('id', targetSourceId)
        .single();
      
      if (error || !source) {
        throw new Error(`Source ${targetSourceId} not found`);
      }
      
      // Update status to scouting
      await supabase
        .from('scraper_sources')
        .update({ scout_status: 'scouting', updated_at: new Date().toISOString() })
        .eq('id', targetSourceId);
      
      sourcesToScout = [source];
    } else {
      // Batch mode - claim sources atomically
      const { data: claimed, error } = await supabase.rpc('claim_sources_for_scouting', {
        p_limit: batchSize,
      });
      
      if (error) {
        console.error('Failed to claim sources:', error);
        return new Response(
          JSON.stringify({ message: 'Failed to claim sources', error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      sourcesToScout = claimed || [];
    }
    
    if (sourcesToScout.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No sources need scouting' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[Scout] Processing ${sourcesToScout.length} sources`);
    
    // Process sources sequentially to avoid rate limits
    const results: ScoutResult[] = [];
    for (const source of sourcesToScout) {
      const result = await scoutSource(supabase, source, aiApiKey);
      results.push(result);
      
      // Small delay between sources to be polite
      if (sourcesToScout.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'failed').length;
    const totalTimeMs = Date.now() - startTime;
    
    console.log(`[Scout] Completed: ${successCount} success, ${failCount} failed in ${totalTimeMs}ms`);
    
    return new Response(
      JSON.stringify({
        message: 'Scout run complete',
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        totalTimeMs,
        results: results.map(r => ({
          sourceId: r.sourceId,
          sourceName: r.sourceName,
          status: r.status,
          executionTimeMs: r.executionTimeMs,
          error: r.error,
          recipeMode: r.recipe?.mode,
          requiresRender: r.recipe?.requires_render,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Scout] Critical error:', errorMsg);
    
    await logError({
      level: 'fatal',
      source: 'scout-worker',
      function_name: 'handler',
      message: `Scout critical error: ${errorMsg}`,
      error_type: 'critical_failure',
      stack_trace: err instanceof Error ? err.stack : undefined,
    });
    
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

if (import.meta.main) {
  serve(handler);
} else {
  console.log("Scout Worker imported as module");
}
