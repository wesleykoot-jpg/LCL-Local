/**
 * Social Graph Intelligence Pipeline - Serper Discovery Service
 * 
 * Uses Serper.dev (Google Search API) to discover event sources.
 * 
 * Features:
 * - Query templates for different event types
 * - Source validation and deduplication
 * - Rate limit tracking
 * 
 * @module _shared/sgSerper
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, serperApiKey } from "./sgEnv.ts";
import type { SerperResult, TargetURL, SourceTier } from "./sgTypes.ts";

const SERPER_ENDPOINT = "https://google.serper.dev/search";

// ============================================================================
// QUERY TEMPLATES
// ============================================================================

export const QUERY_TEMPLATES = {
  general: [
    "{city} events calendar",
    "{city} evenementen agenda",
    "{city} uitagenda",
    "{city} what's on",
  ],
  music: [
    "{city} live music events",
    "{city} jazz nights",
    "{city} concerts",
    "{city} concerten",
  ],
  cultural: [
    "{city} cultural events",
    "{city} museum exhibitions",
    "{city} theater tickets",
    "{city} kunst cultuur",
  ],
  community: [
    "{city} community center events",
    "{city} buurtcentrum activiteiten",
    "{city} library events",
    "{city} bibliotheek programma",
  ],
  nightlife: [
    "{city} nightlife events",
    "{city} club nights",
    "{city} party agenda",
  ],
  markets: [
    "{city} markets fairs",
    "{city} markten braderie",
    "{city} food festivals",
  ],
  sports: [
    "{city} sports events",
    "{city} running events",
    "{city} yoga classes",
  ],
  platforms: [
    "site:eventbrite.com {city} events",
    "site:meetup.com {city} events",
    "site:facebook.com/events {city}",
  ],
};

// Domain blocklist - skip these
const BLOCKED_DOMAINS = new Set([
  'google.com',
  'facebook.com', // Main site, not events
  'twitter.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'wikipedia.org',
  'tripadvisor.com',
  'yelp.com',
  'booking.com',
  'hotels.com',
]);

// ============================================================================
// SERPER API
// ============================================================================

interface SerperResponse {
  organic: SerperResult[];
  searchParameters: {
    q: string;
    num: number;
  };
  credits: number;
}

/**
 * Call Serper.dev search API
 */
async function callSerper(query: string, num: number = 10): Promise<SerperResponse | null> {
  const startTime = Date.now();

  try {
    const response = await fetch(SERPER_ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-KEY": serperApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num,
        gl: "nl", // Netherlands
        hl: "nl", // Dutch
      }),
    });

    if (!response.ok) {
      console.error(`[Serper] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const elapsed = Date.now() - startTime;
    
    console.log(`[Serper] Query "${query}" returned ${data.organic?.length || 0} results in ${elapsed}ms`);
    
    return data;
  } catch (error) {
    console.error("[Serper] API call failed:", error);
    return null;
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Check if URL looks like an event source
 */
function isEventLikeUrl(url: string, snippet: string): boolean {
  const urlLower = url.toLowerCase();
  const snippetLower = snippet.toLowerCase();
  
  // Positive signals
  const eventSignals = [
    /event/i, /agenda/i, /calendar/i, /programma/i,
    /tickets/i, /concerten/i, /festival/i, /theater/i,
    /uitagenda/i, /evenement/i, /activiteit/i,
  ];
  
  const hasEventSignal = eventSignals.some(
    pattern => pattern.test(urlLower) || pattern.test(snippetLower)
  );
  
  // Date-like patterns in snippet
  const hasDatePattern = /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}\s+(jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)/i.test(snippetLower);
  
  return hasEventSignal || hasDatePattern;
}

/**
 * Determine source tier from domain/URL
 */
function inferSourceTier(domain: string, url: string): SourceTier {
  // Tier 1: Major platforms
  if (/eventbrite|meetup|ticketmaster|viagogo/i.test(domain)) {
    return 'tier_1_metropolis';
  }
  
  // Tier 2: Regional aggregators
  if (/uitagenda|indebuurt|vvv|bezoek|ontdek|beleef/i.test(domain)) {
    return 'tier_2_regional';
  }
  
  // Tier 3: Everything else (hyperlocal)
  return 'tier_3_hyperlocal';
}

/**
 * Log query to database
 */
async function logQuery(
  supabase: ReturnType<typeof createClient>,
  query: string,
  city: string,
  category: string,
  results: SerperResult[],
  sourcesCreated: number,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await supabase.from('sg_serper_queries').insert({
    query_text: query,
    city,
    category,
    template: query.replace(city, '{city}'),
    result_count: results.length,
    urls_discovered: results.map(r => r.link),
    sources_created: sourcesCreated,
    executed_at: new Date().toISOString(),
    success,
    error_message: errorMessage,
  });
}

// ============================================================================
// MAIN DISCOVERY FUNCTION
// ============================================================================

export interface DiscoveryOptions {
  city: string;
  categories?: Array<keyof typeof QUERY_TEMPLATES>;
  maxQueriesPerCategory?: number;
  skipExisting?: boolean;
}

export interface DiscoveryResult {
  urls: TargetURL[];
  sourcesCreated: number;
  queriesUsed: number;
  errors: string[];
}

/**
 * Discover event sources for a city using Serper
 */
export async function discoverSources(options: DiscoveryOptions): Promise<DiscoveryResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { 
    city, 
    categories = ['general', 'music', 'cultural', 'community'],
    maxQueriesPerCategory = 2,
    skipExisting = true
  } = options;

  const result: DiscoveryResult = {
    urls: [],
    sourcesCreated: 0,
    queriesUsed: 0,
    errors: [],
  };

  // Get existing domains to skip duplicates
  const existingDomains = new Set<string>();
  if (skipExisting) {
    const { data: existingSources } = await supabase
      .from('sg_sources')
      .select('domain');
    
    existingSources?.forEach(s => existingDomains.add(s.domain));
  }

  // Process each category
  for (const category of categories) {
    const templates = QUERY_TEMPLATES[category] || [];
    const queriesToRun = templates.slice(0, maxQueriesPerCategory);

    for (const template of queriesToRun) {
      const query = template.replace('{city}', city);
      result.queriesUsed++;

      const serperResult = await callSerper(query);
      
      if (!serperResult) {
        result.errors.push(`Query failed: ${query}`);
        await logQuery(supabase, query, city, category, [], 0, false, 'API call failed');
        continue;
      }

      const validUrls: TargetURL[] = [];

      for (const item of serperResult.organic || []) {
        const domain = extractDomain(item.link);
        
        // Skip blocked domains
        if (BLOCKED_DOMAINS.has(domain)) continue;
        
        // Skip already known domains
        if (existingDomains.has(domain)) continue;
        
        // Check if URL looks like an event source
        if (!isEventLikeUrl(item.link, item.snippet)) continue;

        const targetUrl: TargetURL = {
          url: item.link,
          source_tier: inferSourceTier(domain, item.link),
          discovered_at: new Date().toISOString(),
          discovery_method: 'serper_search',
          priority: 50 + (10 - item.position), // Higher position = higher priority
          city,
          serper_query: query,
        };

        validUrls.push(targetUrl);
        existingDomains.add(domain); // Prevent duplicates within this run
      }

      // Create sources for valid URLs
      let sourcesCreated = 0;
      for (const url of validUrls) {
        try {
          const { error } = await supabase.from('sg_sources').insert({
            name: extractDomain(url.url),
            url: url.url,
            tier: url.source_tier,
            discovery_method: url.discovery_method,
            city: url.city,
            country_code: 'NL',
            enabled: true,
            serper_query: url.serper_query,
            serper_discovered_at: url.discovered_at,
          });

          if (!error) {
            sourcesCreated++;
            result.urls.push(url);
          }
        } catch (e) {
          // Likely duplicate URL constraint violation
          console.warn(`[Serper] Could not create source for ${url.url}:`, e);
        }
      }

      result.sourcesCreated += sourcesCreated;
      await logQuery(supabase, query, city, category, serperResult.organic || [], sourcesCreated, true);
    }
  }

  console.log(`[Serper] Discovery complete for ${city}: ${result.sourcesCreated} sources created, ${result.queriesUsed} queries used`);
  
  return result;
}

/**
 * Batch discover sources for multiple cities
 */
export async function batchDiscoverSources(
  cities: string[],
  options?: Omit<DiscoveryOptions, 'city'>
): Promise<Map<string, DiscoveryResult>> {
  const results = new Map<string, DiscoveryResult>();

  for (const city of cities) {
    const result = await discoverSources({ city, ...options });
    results.set(city, result);
    
    // Small delay between cities to be polite
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}
