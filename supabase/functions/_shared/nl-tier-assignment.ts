/**
 * NL Tier Assignment: Automatic Dutch municipality tier classification
 * 
 * Tiers:
 * - tier1_g4: Amsterdam, Rotterdam, Den Haag, Utrecht (4 largest cities)
 * - tier2_centrum: Cities with 50,000+ population
 * - tier3_village: Smaller municipalities
 * 
 * This module automatically assigns tiers based on:
 * 1. Domain matching (visitamsterdam.nl → tier1_g4)
 * 2. Population lookup from dutch_municipalities table
 * 3. Coordinates for default geocoding
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
export type NlTier = 'tier1_g4' | 'tier2_centrum' | 'tier3_village';

export interface TierAssignment {
  tier: NlTier;
  municipality: string | null;
  province: string | null;
  population: number | null;
  coordinates: { lat: number; lng: number } | null;
  matchedBy: 'domain' | 'explicit' | 'default';
}

export interface TierConfig {
  maxConcurrency: number;
  rateLimit: number;
  aiPriority: 'high' | 'medium' | 'low';
  enrichmentDepth: 'full' | 'basic' | 'minimal';
}

// G4 cities (always tier 1)
const G4_CITIES = ['amsterdam', 'rotterdam', 'den haag', 'utrecht'];

// Domain patterns for Dutch event sites
const DOMAIN_PATTERNS = [
  { pattern: /visit(\w+)\.nl/i, extract: 1 },          // visitamsterdam.nl
  { pattern: /uit(\w+)\.nl/i, extract: 1 },            // uitamsterdam.nl
  { pattern: /ontdek(\w+)\.nl/i, extract: 1 },         // ontdekgroningen.nl
  { pattern: /beleef(\w+)\.nl/i, extract: 1 },         // beleefdelft.nl
  { pattern: /agenda\.(\w+)\.nl/i, extract: 1 },       // agenda.amsterdam.nl
  { pattern: /(\w+)\.nu/i, extract: 1 },               // zwolle.nu
  { pattern: /(\w+)marketing\.nl/i, extract: 1 },      // zwollemarking.nl
];

/**
 * Extract city name from domain
 */
export function extractCityFromDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    for (const { pattern, extract } of DOMAIN_PATTERNS) {
      const match = hostname.match(pattern);
      if (match && match[extract]) {
        return match[extract].toLowerCase();
      }
    }

    // Try splitting domain parts
    const parts = hostname.replace('.nl', '').replace('.nu', '').split('.');
    for (const part of parts) {
      // Skip common prefixes
      if (!['www', 'agenda', 'events', 'tickets'].includes(part)) {
        return part;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Determine tier from population
 */
export function tierFromPopulation(population: number, cityName: string): NlTier {
  // G4 cities are always tier 1
  if (G4_CITIES.includes(cityName.toLowerCase())) {
    return 'tier1_g4';
  }

  // 50k+ is tier 2
  if (population >= 50000) {
    return 'tier2_centrum';
  }

  // Everything else is tier 3
  return 'tier3_village';
}

/**
 * Look up municipality in database
 */
export async function lookupMunicipality(
  supabase: ReturnType<typeof createClient>,
  cityName: string
): Promise<TierAssignment | null> {
  // Try exact match first
  const { data: exact } = await supabase
    .from('dutch_municipalities')
    .select('name, province, population, lat, lng, nl_tier')
    .ilike('name', cityName)
    .limit(1)
    .single();

  if (exact) {
    return {
      tier: exact.nl_tier,
      municipality: exact.name,
      province: exact.province,
      population: exact.population,
      coordinates: exact.lat && exact.lng ? { lat: exact.lat, lng: exact.lng } : null,
      matchedBy: 'domain',
    };
  }

  // Try fuzzy match with trigram similarity
  const { data: fuzzy } = await supabase
    .from('dutch_municipalities')
    .select('name, province, population, lat, lng, nl_tier')
    .textSearch('name', cityName, { type: 'websearch' })
    .limit(1)
    .single();

  if (fuzzy) {
    return {
      tier: fuzzy.nl_tier,
      municipality: fuzzy.name,
      province: fuzzy.province,
      population: fuzzy.population,
      coordinates: fuzzy.lat && fuzzy.lng ? { lat: fuzzy.lat, lng: fuzzy.lng } : null,
      matchedBy: 'domain',
    };
  }

  return null;
}

/**
 * Main function to determine NL tier for a source
 */
export async function determineNlTier(
  supabase: ReturnType<typeof createClient>,
  url: string,
  population?: number
): Promise<TierAssignment> {
  // Try to extract city from domain
  const cityName = extractCityFromDomain(url);

  if (cityName) {
    // Look up in municipality database
    const lookup = await lookupMunicipality(supabase, cityName);
    if (lookup) {
      return lookup;
    }
  }

  // If population provided, use that
  if (population !== undefined) {
    const tier = tierFromPopulation(population, cityName || '');
    return {
      tier,
      municipality: cityName,
      province: null,
      population,
      coordinates: null,
      matchedBy: 'explicit',
    };
  }

  // Default to tier 3
  return {
    tier: 'tier3_village',
    municipality: cityName,
    province: null,
    population: null,
    coordinates: null,
    matchedBy: 'default',
  };
}

/**
 * Get tier-specific configuration
 */
export function getTierExtractionConfig(tier: NlTier): TierConfig {
  switch (tier) {
    case 'tier1_g4':
      return {
        maxConcurrency: 5,
        rateLimit: 1000,           // 1 second between requests
        aiPriority: 'high',
        enrichmentDepth: 'full',   // All Social Five + vibe classification
      };

    case 'tier2_centrum':
      return {
        maxConcurrency: 3,
        rateLimit: 2000,           // 2 seconds between requests
        aiPriority: 'medium',
        enrichmentDepth: 'full',
      };

    case 'tier3_village':
      return {
        maxConcurrency: 2,
        rateLimit: 3000,           // 3 seconds between requests
        aiPriority: 'low',
        enrichmentDepth: 'basic',  // Only essential Social Five
      };

    default:
      return {
        maxConcurrency: 2,
        rateLimit: 3000,
        aiPriority: 'low',
        enrichmentDepth: 'basic',
      };
  }
}

/**
 * Get tier priority for job queue (lower = higher priority)
 */
export function getTierPriority(tier: NlTier): number {
  switch (tier) {
    case 'tier1_g4': return 10;
    case 'tier2_centrum': return 50;
    case 'tier3_village': return 100;
    default: return 100;
  }
}

/**
 * Batch assign tiers to multiple sources
 */
export async function batchAssignTiers(
  supabase: ReturnType<typeof createClient>,
  sourceIds: string[]
): Promise<Map<string, TierAssignment>> {
  const results = new Map<string, TierAssignment>();

  // Get sources
  const { data: sources } = await supabase
    .from('scraper_sources')
    .select('id, url')
    .in('id', sourceIds);

  if (!sources) return results;

  // Process each source
  for (const source of sources) {
    const assignment = await determineNlTier(supabase, source.url);
    results.set(source.id, assignment);

    // Update source in database
    await supabase
      .from('scraper_sources')
      .update({
        nl_tier: assignment.tier,
        default_coordinates: assignment.coordinates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);
  }

  return results;
}

/**
 * Get sources by tier for batch processing
 */
export async function getSourcesByTier(
  supabase: ReturnType<typeof createClient>,
  tier: NlTier,
  limit: number = 10,
  enabledOnly: boolean = true
): Promise<Array<{ id: string; url: string; name: string }>> {
  let query = supabase
    .from('scraper_sources')
    .select('id, url, name')
    .eq('nl_tier', tier)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (enabledOnly) {
    query = query.eq('enabled', true).is('quarantined_at', null);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get tier statistics
 */
export async function getTierStats(
  supabase: ReturnType<typeof createClient>
): Promise<Record<NlTier, { count: number; healthy: number; quarantined: number }>> {
  const { data, error } = await supabase
    .from('scraper_sources')
    .select('nl_tier, enabled, quarantined_at');

  if (error) throw error;

  const stats: Record<NlTier, { count: number; healthy: number; quarantined: number }> = {
    tier1_g4: { count: 0, healthy: 0, quarantined: 0 },
    tier2_centrum: { count: 0, healthy: 0, quarantined: 0 },
    tier3_village: { count: 0, healthy: 0, quarantined: 0 },
  };

  for (const source of data || []) {
    const tier = source.nl_tier as NlTier;
    if (!stats[tier]) continue;

    stats[tier].count++;
    if (source.quarantined_at) {
      stats[tier].quarantined++;
    } else if (source.enabled) {
      stats[tier].healthy++;
    }
  }

  return stats;
}
