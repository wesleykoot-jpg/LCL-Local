/**
 * Social Graph Intelligence Pipeline - Nominatim Geocoding Service
 * 
 * Handles geocoding with:
 * - Rate limiting (1 req/sec)
 * - Database caching (180 days)
 * - Fallback logic
 * - Retry with exponential backoff
 * 
 * @module _shared/sgGeocode
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, NOMINATIM_RATE_LIMIT_MS } from "./sgEnv.ts";
import type { GeocodeResult } from "./sgTypes.ts";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "LCL-Local/3.2 (contact@lcl-local.app)";

// In-memory rate limiter
let lastNominatimRequest = 0;

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enforce Nominatim rate limit
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastNominatimRequest;
  
  if (elapsed < NOMINATIM_RATE_LIMIT_MS) {
    await sleep(NOMINATIM_RATE_LIMIT_MS - elapsed);
  }
  
  lastNominatimRequest = Date.now();
}

/**
 * Normalize address for cache key
 */
export function normalizeAddressKey(
  venue?: string,
  street?: string,
  postal?: string,
  city?: string,
  country?: string
): string {
  return [
    venue || '',
    street || '',
    postal || '',
    city || '',
    country || 'NL'
  ].map(s => s.toLowerCase().trim()).join('|');
}

/**
 * Check geocode cache in database
 */
async function checkCache(
  supabase: ReturnType<typeof createClient>,
  addressKey: string
): Promise<GeocodeResult | null> {
  const { data, error } = await supabase
    .from('sg_geocode_cache')
    .select('lat, lng, display_name, place_type, importance, raw_response')
    .eq('address_key', addressKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;

  // Update hit count
  await supabase
    .from('sg_geocode_cache')
    .update({ 
      hit_count: data.hit_count + 1,
      last_hit_at: new Date().toISOString()
    })
    .eq('address_key', addressKey);

  return {
    lat: data.lat,
    lng: data.lng,
    display_name: data.display_name || '',
    place_type: data.place_type || '',
    importance: data.importance || 0,
    raw_response: data.raw_response || {},
    cached: true
  };
}

/**
 * Save geocode result to cache
 */
async function saveToCache(
  supabase: ReturnType<typeof createClient>,
  addressKey: string,
  query: string,
  result: GeocodeResult
): Promise<void> {
  await supabase
    .from('sg_geocode_cache')
    .upsert({
      address_key: addressKey,
      original_query: query,
      lat: result.lat,
      lng: result.lng,
      display_name: result.display_name,
      place_type: result.place_type,
      importance: result.importance,
      raw_response: result.raw_response,
      expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      hit_count: 0,
      last_hit_at: new Date().toISOString()
    }, {
      onConflict: 'address_key'
    });
}

/**
 * Call Nominatim API
 */
async function callNominatim(query: string): Promise<GeocodeResult | null> {
  await enforceRateLimit();

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
    console.warn(`[Nominatim] Rate limited, waiting ${waitMs}ms`);
    await sleep(waitMs);
    return null; // Return null to trigger retry
  }

  if (!response.ok) {
    console.error(`[Nominatim] HTTP ${response.status}: ${response.statusText}`);
    return null;
  }

  const results = await response.json();
  
  if (!results || results.length === 0) {
    console.warn(`[Nominatim] No results for: ${query}`);
    return null;
  }

  const first = results[0];
  
  return {
    lat: parseFloat(first.lat),
    lng: parseFloat(first.lon),
    display_name: first.display_name || '',
    place_type: first.type || '',
    importance: parseFloat(first.importance) || 0,
    raw_response: first,
    cached: false
  };
}

/**
 * Build search query from address components
 */
function buildQuery(
  venue?: string,
  street?: string,
  postal?: string,
  city?: string,
  country?: string
): string {
  const parts = [venue, street, postal, city, country]
    .filter(Boolean)
    .map(s => s!.trim());
  
  return parts.join(', ');
}

/**
 * Main geocoding function with caching and retry
 */
export async function geocodeAddress(
  venue?: string,
  street?: string,
  postal?: string,
  city?: string,
  country: string = 'NL'
): Promise<GeocodeResult | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const addressKey = normalizeAddressKey(venue, street, postal, city, country);
  const query = buildQuery(venue, street, postal, city, country);

  if (!query || query.length < 3) {
    console.warn('[Geocode] Query too short, skipping');
    return null;
  }

  // 1. Check cache first
  const cached = await checkCache(supabase, addressKey);
  if (cached) {
    console.log(`[Geocode] Cache hit for: ${query.substring(0, 50)}...`);
    return cached;
  }

  // 2. Try Nominatim with retry
  let result: GeocodeResult | null = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (!result && attempts < maxAttempts) {
    attempts++;
    
    try {
      result = await callNominatim(query);
      
      if (result) {
        // Save to cache
        await saveToCache(supabase, addressKey, query, result);
        console.log(`[Geocode] Success: ${query.substring(0, 50)}... -> (${result.lat}, ${result.lng})`);
      }
    } catch (error) {
      console.error(`[Geocode] Attempt ${attempts} failed:`, error);
      
      if (attempts < maxAttempts) {
        // Exponential backoff
        const backoffMs = 1000 * Math.pow(2, attempts - 1);
        await sleep(backoffMs);
      }
    }
  }

  // 3. Try fallback queries if main query failed
  if (!result && city) {
    // Try with just venue + city
    const fallbackQuery = buildQuery(venue, undefined, undefined, city, country);
    if (fallbackQuery !== query) {
      console.log(`[Geocode] Trying fallback: ${fallbackQuery}`);
      result = await callNominatim(fallbackQuery);
      
      if (result) {
        await saveToCache(supabase, addressKey, query, result);
      }
    }
  }

  if (!result) {
    console.warn(`[Geocode] All attempts failed for: ${query}`);
  }

  return result;
}

/**
 * Batch geocode multiple addresses (with rate limiting)
 */
export async function batchGeocodeAddresses(
  addresses: Array<{
    venue?: string;
    street?: string;
    postal?: string;
    city?: string;
    country?: string;
  }>
): Promise<Map<string, GeocodeResult | null>> {
  const results = new Map<string, GeocodeResult | null>();

  for (const addr of addresses) {
    const key = normalizeAddressKey(
      addr.venue, addr.street, addr.postal, addr.city, addr.country
    );
    
    const result = await geocodeAddress(
      addr.venue, addr.street, addr.postal, addr.city, addr.country || 'NL'
    );
    
    results.set(key, result);
  }

  return results;
}
