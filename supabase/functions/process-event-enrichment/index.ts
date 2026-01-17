/**
 * Process Event Enrichment Worker
 * 
 * This Supabase Edge Function enriches events with missing data:
 * - Venue coordinates from the local registry
 * - Google Places data as fallback (contact, website, opening hours)
 * 
 * Triggered by:
 * - INSERT on events table (via trigger or direct call)
 * - Batch job for events missing essential fields
 * 
 * Enrichment Priority:
 * 1. Local venue registry (fast, no API cost)
 * 2. Google Places API (rate-limited, cached)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { lookupVenue, lookupVenueByPlaceId, type VenueRegistryEntry } from "../_shared/venueRegistry.ts";

// CORS headers for the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const MAX_BATCH_SIZE = 50;
const GOOGLE_PLACES_RATE_LIMIT_MS = 100; // 10 requests per second max

interface EnrichmentRequest {
  event_id?: string;
  batch?: boolean;
  limit?: number;
  dry_run?: boolean;
}

interface EnrichmentResult {
  event_id: string;
  success: boolean;
  source: 'registry' | 'google' | 'none';
  fields_updated: string[];
  error?: string;
}

interface EventRow {
  id: string;
  title: string;
  venue_name: string;
  location: unknown;
  google_place_id: string | null;
  contact_phone: string | null;
  website_url: string | null;
  opening_hours: unknown;
  enrichment_source: string | null;
}

/**
 * Extract city from venue_name if possible
 * Handles formats like "Venue Name, City" or "Venue Name - City"
 */
function extractCity(venueName: string): string | undefined {
  if (!venueName) return undefined;
  
  // Try comma separator
  const commaParts = venueName.split(',');
  if (commaParts.length > 1) {
    return commaParts[commaParts.length - 1].trim();
  }
  
  // Try dash separator
  const dashParts = venueName.split('-');
  if (dashParts.length > 1) {
    return dashParts[dashParts.length - 1].trim();
  }
  
  return undefined;
}

/**
 * Normalize venue name for matching
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if an event needs enrichment
 */
function needsEnrichment(event: EventRow): boolean {
  // Already enriched
  if (event.enrichment_source) return false;
  
  // Check for missing essential fields
  const missingLocation = !event.location || event.location === 'POINT(0 0)';
  const missingContact = !event.contact_phone;
  const missingWebsite = !event.website_url;
  const missingGoogleId = !event.google_place_id;
  
  return missingLocation || (missingContact && missingWebsite && missingGoogleId);
}

/**
 * Build update payload from registry entry
 */
function buildRegistryUpdate(entry: VenueRegistryEntry): Partial<EventRow> & { enrichment_source: string } {
  const update: Partial<EventRow> & { enrichment_source: string } = {
    enrichment_source: 'registry',
  };
  
  // Always update location if we have coordinates
  // PostGIS format: POINT(lng lat)
  if (entry.lat && entry.lng) {
    update.location = `SRID=4326;POINT(${entry.lng} ${entry.lat})` as unknown;
  }
  
  if (entry.google_place_id) {
    update.google_place_id = entry.google_place_id;
  }
  
  if (entry.contact_phone) {
    update.contact_phone = entry.contact_phone;
  }
  
  if (entry.website_url) {
    update.website_url = entry.website_url;
  }
  
  return update;
}

/**
 * Call Google Places API for venue enrichment
 * Returns enrichment data or null if not found/error
 */
async function enrichFromGoogle(
  venueName: string,
  city?: string,
  apiKey?: string
): Promise<{
  google_place_id?: string;
  contact_phone?: string;
  website_url?: string;
  location?: string;
  opening_hours?: Record<string, string[]>;
  address?: string;
} | null> {
  if (!apiKey) {
    console.log('[Enrichment] Google API key not configured, skipping Google enrichment');
    return null;
  }
  
  try {
    // Build search query
    const query = city ? `${venueName} ${city}` : venueName;
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    searchUrl.searchParams.set('input', query);
    searchUrl.searchParams.set('inputtype', 'textquery');
    searchUrl.searchParams.set('fields', 'place_id,name,geometry,formatted_address');
    searchUrl.searchParams.set('key', apiKey);
    
    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();
    
    if (searchData.status !== 'OK' || !searchData.candidates?.length) {
      console.log(`[Enrichment] No Google results for: ${query}`);
      return null;
    }
    
    const placeId = searchData.candidates[0].place_id;
    const geometry = searchData.candidates[0].geometry?.location;
    
    // Get place details for phone, website, opening hours
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', placeId);
    detailsUrl.searchParams.set('fields', 'formatted_phone_number,international_phone_number,website,opening_hours');
    detailsUrl.searchParams.set('key', apiKey);
    
    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();
    
    if (detailsData.status !== 'OK') {
      // Return at least the place_id and location from search
      return geometry ? {
        google_place_id: placeId,
        location: `SRID=4326;POINT(${geometry.lng} ${geometry.lat})`,
        address: searchData.candidates[0].formatted_address,
      } : null;
    }
    
    const details = detailsData.result;
    
    // Parse opening hours into our canonical format
    let opening_hours: Record<string, string[]> | undefined;
    if (details.opening_hours?.periods) {
      opening_hours = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      for (const period of details.opening_hours.periods) {
        if (period.open && period.close) {
          const dayName = dayNames[period.open.day];
          const openTime = `${period.open.time.substring(0, 2)}:${period.open.time.substring(2)}`;
          const closeTime = `${period.close.time.substring(0, 2)}:${period.close.time.substring(2)}`;
          
          if (!opening_hours[dayName]) {
            opening_hours[dayName] = [];
          }
          opening_hours[dayName].push(`${openTime}-${closeTime}`);
        }
      }
    }
    
    return {
      google_place_id: placeId,
      contact_phone: details.international_phone_number || details.formatted_phone_number,
      website_url: details.website,
      location: geometry ? `SRID=4326;POINT(${geometry.lng} ${geometry.lat})` : undefined,
      opening_hours,
      address: searchData.candidates[0].formatted_address,
    };
    
  } catch (error) {
    console.error('[Enrichment] Google API error:', error);
    return null;
  }
}

/**
 * Record enrichment failure to DLQ
 */
async function recordFailure(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  errorMessage: string,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    // Check if failure already exists
    const { data: existing } = await supabase
      .from('enrichment_failures')
      .select('id, attempts')
      .eq('event_id', eventId)
      .eq('resolved', false)
      .single();
    
    if (existing) {
      // Update existing failure
      await supabase
        .from('enrichment_failures')
        .update({
          attempts: (existing.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          error_message: errorMessage,
          payload,
        })
        .eq('id', existing.id);
    } else {
      // Insert new failure
      await supabase
        .from('enrichment_failures')
        .insert({
          event_id: eventId,
          error_message: errorMessage,
          payload,
        });
    }
  } catch (err) {
    console.error('[Enrichment] Failed to record failure:', err);
  }
}

/**
 * Enrich a single event
 */
async function enrichEvent(
  supabase: ReturnType<typeof createClient>,
  event: EventRow,
  googleApiKey?: string,
  dryRun = false
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    event_id: event.id,
    success: false,
    source: 'none',
    fields_updated: [],
  };
  
  try {
    // Step 1: Try local registry lookup
    const city = extractCity(event.venue_name);
    const registryMatch = lookupVenue(event.venue_name, city) || 
                          lookupVenue(event.title, city) ||
                          (event.google_place_id ? lookupVenueByPlaceId(event.google_place_id) : null);
    
    if (registryMatch) {
      console.log(`[Enrichment] Registry hit for event ${event.id}: ${registryMatch.name}`);
      
      const update = buildRegistryUpdate(registryMatch);
      result.source = 'registry';
      result.fields_updated = Object.keys(update).filter(k => k !== 'enrichment_source');
      
      if (!dryRun) {
        const { error } = await supabase
          .from('events')
          .update(update)
          .eq('id', event.id);
        
        if (error) {
          throw new Error(`Database update failed: ${error.message}`);
        }
      }
      
      result.success = true;
      return result;
    }
    
    // Step 2: Try Google Places API
    const googleResult = await enrichFromGoogle(event.venue_name, city, googleApiKey);
    
    if (googleResult) {
      console.log(`[Enrichment] Google hit for event ${event.id}`);
      
      const update: Record<string, unknown> = {
        enrichment_source: 'google',
      };
      
      if (googleResult.google_place_id) update.google_place_id = googleResult.google_place_id;
      if (googleResult.contact_phone) update.contact_phone = googleResult.contact_phone;
      if (googleResult.website_url) update.website_url = googleResult.website_url;
      if (googleResult.location) update.location = googleResult.location;
      if (googleResult.opening_hours) update.opening_hours = googleResult.opening_hours;
      
      result.source = 'google';
      result.fields_updated = Object.keys(update).filter(k => k !== 'enrichment_source');
      
      if (!dryRun) {
        const { error } = await supabase
          .from('events')
          .update(update)
          .eq('id', event.id);
        
        if (error) {
          throw new Error(`Database update failed: ${error.message}`);
        }
        
        // Rate limiting for Google API
        await new Promise(resolve => setTimeout(resolve, GOOGLE_PLACES_RATE_LIMIT_MS));
      }
      
      result.success = true;
      return result;
    }
    
    // Step 3: No enrichment source found
    console.log(`[Enrichment] No enrichment found for event ${event.id}`);
    result.source = 'none';
    result.success = true; // Not an error, just no data available
    
    // Mark as checked to avoid re-processing
    if (!dryRun) {
      await supabase
        .from('events')
        .update({ enrichment_source: 'none' })
        .eq('id', event.id);
    }
    
    return result;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.error = errorMessage;
    
    if (!dryRun) {
      await recordFailure(supabase, event.id, errorMessage, { venue_name: event.venue_name });
    }
    
    return result;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Parse request
    const requestBody: EnrichmentRequest = req.method === 'POST' 
      ? await req.json() 
      : {};
    
    const { event_id, batch = false, limit = MAX_BATCH_SIZE, dry_run = false } = requestBody;
    
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const results: EnrichmentResult[] = [];
    
    if (event_id) {
      // Single event enrichment
      const { data: event, error } = await supabase
        .from('events')
        .select('id, title, venue_name, location, google_place_id, contact_phone, website_url, opening_hours, enrichment_source')
        .eq('id', event_id)
        .single();
      
      if (error || !event) {
        throw new Error(`Event not found: ${event_id}`);
      }
      
      const result = await enrichEvent(supabase, event as EventRow, googleApiKey, dry_run);
      results.push(result);
      
    } else if (batch) {
      // Batch enrichment - find events needing enrichment
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, venue_name, location, google_place_id, contact_phone, website_url, opening_hours, enrichment_source')
        .is('enrichment_source', null)
        .limit(Math.min(limit, MAX_BATCH_SIZE));
      
      if (error) {
        throw new Error(`Failed to fetch events: ${error.message}`);
      }
      
      if (!events || events.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No events need enrichment', results: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[Enrichment] Processing ${events.length} events in batch mode`);
      
      for (const event of events) {
        const result = await enrichEvent(supabase, event as EventRow, googleApiKey, dry_run);
        results.push(result);
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Must provide event_id or batch=true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Summary metrics
    const summary = {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      registry_hits: results.filter(r => r.source === 'registry').length,
      google_hits: results.filter(r => r.source === 'google').length,
      no_data: results.filter(r => r.source === 'none' && r.success).length,
      dry_run,
    };
    
    console.log('[Enrichment] Summary:', JSON.stringify(summary));
    
    return new Response(
      JSON.stringify({ summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Enrichment] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
