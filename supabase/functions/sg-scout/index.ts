/**
 * SG Scout - Stage 1: Discovery
 * 
 * Social Graph Intelligence Pipeline - Global Scout
 * 
 * Responsibilities:
 * - Discovers new event sources using Serper.dev
 * - Adds URLs to the pipeline queue
 * - Tracks source quality and reliability
 * 
 * Trigger: Scheduled (daily) or manual invocation
 * 
 * @module sg-scout
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, validateEnv } from "../_shared/sgEnv.ts";
import { discoverSources, batchDiscoverSources, QUERY_TEMPLATES } from "../_shared/sgSerper.ts";
import type { ScoutResponse, TargetURL } from "../_shared/sgTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default cities to scout (Netherlands focus)
const DEFAULT_CITIES = [
  'Amsterdam',
  'Rotterdam',
  'Utrecht',
  'Den Haag',
  'Eindhoven',
  'Groningen',
  'Maastricht',
  'Arnhem',
  'Nijmegen',
  'Leiden',
  'Delft',
  'Haarlem',
  'Zwolle',
  'Enschede',
  'Breda',
];

interface ScoutPayload {
  cities?: string[];
  categories?: Array<keyof typeof QUERY_TEMPLATES>;
  maxQueriesPerCategory?: number;
  mode?: 'discovery' | 'crawl_existing' | 'full';
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
    let payload: ScoutPayload = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const {
      cities = DEFAULT_CITIES.slice(0, 5), // Limit to 5 cities by default
      categories = ['general', 'music', 'cultural', 'community'],
      maxQueriesPerCategory = 2,
      mode = 'discovery',
    } = payload;

    console.log(`[SG Scout] Starting ${mode} mode for ${cities.length} cities`);

    const response: ScoutResponse = {
      success: true,
      urls_discovered: 0,
      sources_created: 0,
      queries_used: 0,
      errors: [],
    };

    if (mode === 'discovery' || mode === 'full') {
      // Discover new sources via Serper
      const discoveryResults = await batchDiscoverSources(cities, {
        categories,
        maxQueriesPerCategory,
        skipExisting: true,
      });

      for (const [city, result] of discoveryResults) {
        response.urls_discovered += result.urls.length;
        response.sources_created += result.sourcesCreated;
        response.queries_used += result.queriesUsed;
        response.errors.push(...result.errors.map(e => `${city}: ${e}`));
      }

      console.log(`[SG Scout] Discovery: ${response.sources_created} new sources`);
    }

    if (mode === 'crawl_existing' || mode === 'full') {
      // Crawl existing sources for new event URLs
      const { data: sources, error: sourcesError } = await supabase
        .from('sg_sources')
        .select('id, url, name, tier, city')
        .eq('enabled', true)
        .eq('quarantined', false)
        .order('last_successful_scrape', { ascending: true, nullsFirst: true })
        .limit(20);

      if (sourcesError) {
        response.errors.push(`Failed to fetch sources: ${sourcesError.message}`);
      } else if (sources) {
        for (const source of sources) {
          // Add source URL to pipeline queue for processing
          const { error: queueError } = await supabase
            .from('sg_pipeline_queue')
            .insert({
              source_id: source.id,
              source_url: source.url,
              stage: 'discovered',
              discovery_method: 'seed_list',
              priority: source.tier === 'tier_1_metropolis' ? 80 : 
                       source.tier === 'tier_2_regional' ? 60 : 40,
            })
            .select('id')
            .single();

          if (!queueError) {
            response.urls_discovered++;
          }
        }

        console.log(`[SG Scout] Queued ${response.urls_discovered} URLs from existing sources`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SG Scout] Completed in ${elapsed}ms`);

    return new Response(
      JSON.stringify({
        ...response,
        duration_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SG Scout] Fatal error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        urls_discovered: 0,
        sources_created: 0,
        queries_used: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
