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
  maxUrlsPerSource?: number;
  maxSourcesToCrawl?: number;
  mode?: 'discovery' | 'crawl_existing' | 'full';
}

function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const params = new URLSearchParams(u.search);
    // Strip common tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach((p) => {
      params.delete(p);
    });
    u.search = params.toString();
    return u.toString();
  } catch {
    return url;
  }
}

function extractCandidateEventUrls(html: string, baseUrl: string, maxUrls: number): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  let baseDomain = '';
  try {
    baseDomain = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch {
    baseDomain = '';
  }

  const keywordHints = [
    'event', 'events', 'agenda', 'calendar', 'programma', 'activiteiten',
    'ticket', 'tickets', 'concert', 'festival', 'workshop', 'meetup',
    'theater', 'film', 'cinema', 'uitagenda', 'show', 'wedstrijd', 'sport'
  ];

  const excludeHints = ['privacy', 'terms', 'voorwaarden', 'contact', 'about', 'over-ons', 'cookies'];

  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) && results.length < maxUrls) {
    const rawHref = match[1];
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }

    let absoluteUrl = rawHref;
    try {
      absoluteUrl = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }

    const cleaned = sanitizeUrl(absoluteUrl);

    try {
      const urlObj = new URL(cleaned);
      const domain = urlObj.hostname.replace(/^www\./, '');
      if (baseDomain && domain !== baseDomain) {
        continue;
      }

      const path = `${urlObj.pathname}${urlObj.search}`.toLowerCase();
      if (excludeHints.some((h) => path.includes(h))) {
        continue;
      }

      const hasKeyword = keywordHints.some((k) => path.includes(k));
      const hasDate = /(\b20\d{2}\b|\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b)/.test(path);

      if (!hasKeyword && !hasDate) {
        continue;
      }

      if (!seen.has(cleaned)) {
        seen.add(cleaned);
        results.push(cleaned);
      }
    } catch {
      continue;
    }
  }

  return results.slice(0, maxUrls);
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
      maxUrlsPerSource = 100,
      maxSourcesToCrawl = 20,
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
        .limit(maxSourcesToCrawl);

      if (sourcesError) {
        response.errors.push(`Failed to fetch sources: ${sourcesError.message}`);
      } else if (sources) {
        for (const source of sources) {
          try {
            const html = await fetch(source.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LCL-Local/3.2; +https://lcl-local.app)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              redirect: 'follow',
            }).then((r) => r.text());

            const candidateUrls = extractCandidateEventUrls(html, source.url, maxUrlsPerSource);

            if (candidateUrls.length === 0) {
              // Fallback: queue source URL if no details found
              const { error: queueError } = await supabase
                .from('sg_pipeline_queue')
                .insert({
                  source_id: source.id,
                  source_url: source.url,
                  detail_url: null,
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
              continue;
            }

            const { data: existing } = await supabase
              .from('sg_pipeline_queue')
              .select('detail_url')
              .eq('source_id', source.id)
              .in('detail_url', candidateUrls);

            const existingSet = new Set((existing || []).map((e) => e.detail_url).filter(Boolean));
            const toInsert = candidateUrls.filter((u) => !existingSet.has(u));

            const rows = toInsert.map((detailUrl) => ({
              source_id: source.id,
              source_url: source.url,
              detail_url: detailUrl,
              stage: 'discovered',
              discovery_method: 'internal_link',
              priority: source.tier === 'tier_1_metropolis' ? 80 : 
                       source.tier === 'tier_2_regional' ? 60 : 40,
            }));

            if (rows.length > 0) {
              const chunkSize = 50;
              for (let i = 0; i < rows.length; i += chunkSize) {
                const chunk = rows.slice(i, i + chunkSize);
                const { error: insertError } = await supabase
                  .from('sg_pipeline_queue')
                  .insert(chunk);
                if (!insertError) {
                  response.urls_discovered += chunk.length;
                }
              }
            }
          } catch (error) {
            response.errors.push(`${source.url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
