import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

import { findVenueInRegistry, getVenueStats } from "./venueRegistry.ts";
import { transformGoogleHoursToSchema, validateOpeningHours } from "./openingHoursTransform.ts";
import type { 
  EnrichmentResult, 
  EnrichmentStatus,
  GooglePlaceResult,
  PriceRange,
  OpeningHours,
  Event
} from "./types.ts";
import { googlePriceLevelToRange, isValidE164, isValidUrl } from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Process Event Enrichment Worker
 * 
 * Enriches events with actionable metadata (phone, hours, location) using:
 * 1. Static Registry: Hardcoded data for ~50 major venues (0 API calls)
 * 2. Dynamic Worker: Google Places API for everything else
 * 
 * Trigger mechanisms:
 * - Scheduled cron job (recommended for production)
 * - Direct API call with event_id
 * - Batch processing mode
 * 
 * Environment variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin operations
 * - GOOGLE_PLACES_API_KEY: Google Places API key (optional for registry matches)
 * - MAX_ENRICHMENT_CALLS_PER_DAY: Daily API budget cap (default: 1000)
 * - ENRICHMENT_DRY_RUN: Set to "true" to skip database writes
 * 
 * Usage:
 * POST /functions/v1/process-event-enrichment
 * Body: { 
 *   "event_id": "uuid",           // Enrich single event
 *   "batch_size": 50,             // Or process a batch
 *   "dry_run": false,             // Override dry_run mode
 *   "stats_only": false           // Just return stats
 * }
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    const maxDailyApiCalls = parseInt(Deno.env.get("MAX_ENRICHMENT_CALLS_PER_DAY") || "1000");
    const isDryRun = Deno.env.get("ENRICHMENT_DRY_RUN") === "true";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase env vars");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { 
      event_id, 
      batch_size = 50, 
      dry_run = isDryRun,
      stats_only = false 
    } = body;

    // Stats-only mode: return venue registry and enrichment stats
    if (stats_only) {
      const venueStats = getVenueStats();
      
      // Query enrichment stats directly (no RPC needed)
      const todayStartForStats = new Date();
      todayStartForStats.setHours(0, 0, 0, 0);
      
      const { count: needsEnrichment } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .in("time_mode", ["window", "anytime"])
        .or("contact_phone.is.null,opening_hours.is.null")
        .is("enrichment_attempted_at", null);
      
      const { count: todaySuccesses } = await supabase
        .from("enrichment_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "success")
        .gte("created_at", todayStartForStats.toISOString());
      
      const { count: todayFailures } = await supabase
        .from("enrichment_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", todayStartForStats.toISOString());
      
      const { count: registryMatches } = await supabase
        .from("enrichment_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "registry_match")
        .gte("created_at", todayStartForStats.toISOString());
      
      return new Response(
        JSON.stringify({
          success: true,
          venue_registry: venueStats,
          enrichment_stats: {
            needs_enrichment: needsEnrichment || 0,
            today_successes: todaySuccesses || 0,
            today_failures: todayFailures || 0,
            today_registry_matches: registryMatches || 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check daily API budget
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count: todayApiCalls } = await supabase
      .from("enrichment_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .gt("api_calls_used", 0);

    const remainingBudget = maxDailyApiCalls - (todayApiCalls || 0);
    
    if (remainingBudget <= 0 && !dry_run) {
      console.log("Daily API budget reached, skipping enrichment");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Daily API budget exceeded",
          budget: { used: todayApiCalls, limit: maxDailyApiCalls },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single event enrichment
    if (event_id) {
      const result = await enrichSingleEvent(
        supabase, 
        event_id, 
        googleApiKey, 
        dry_run
      );
      
      return new Response(
        JSON.stringify({
          success: true,
          event_id,
          result,
          dry_run,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch enrichment
    const batchResult = await enrichBatch(
      supabase,
      googleApiKey,
      Math.min(batch_size, remainingBudget), // Don't exceed budget
      dry_run
    );

    return new Response(
      JSON.stringify({
        success: true,
        ...batchResult,
        dry_run,
        budget: { 
          remaining: remainingBudget - batchResult.apiCallsUsed,
          limit: maxDailyApiCalls 
        },
        duration_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in event enrichment:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Enrich a single event
 */
async function enrichSingleEvent(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  googleApiKey: string | undefined,
  dryRun: boolean
): Promise<EnrichmentResult> {
  // Fetch event
  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (fetchError || !event) {
    return {
      status: "failed",
      enrichedFields: [],
      apiCallsUsed: 0,
      error: fetchError?.message || "Event not found",
      source: "registry",
    };
  }

  // Skip fixed events (they don't need enrichment)
  if (event.time_mode === "fixed") {
    await logEnrichment(supabase, eventId, "skipped", 0, null, ["time_mode=fixed"], "registry", dryRun);
    return {
      status: "skipped",
      enrichedFields: [],
      apiCallsUsed: 0,
      error: "Fixed events do not require enrichment",
      source: "registry",
    };
  }

  // Check if already enriched recently (within 24 hours)
  if (event.enrichment_attempted_at) {
    const lastAttempt = new Date(event.enrichment_attempted_at);
    const hoursSinceAttempt = (Date.now() - lastAttempt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceAttempt < 24) {
      return {
        status: "skipped",
        enrichedFields: [],
        apiCallsUsed: 0,
        error: "Recently enriched (within 24 hours)",
        source: "registry",
      };
    }
  }

  // Step 1: Check VenueRegistry first (0 API calls)
  const registryMatch = findVenueInRegistry(event.title || event.venue_name || "");
  
  if (registryMatch && registryMatch.confidence > 0.8) {
    const result = await applyRegistryData(supabase, event, registryMatch.venue, dryRun);
    await logEnrichment(supabase, eventId, result.status, 0, null, result.enrichedFields, "registry", dryRun);
    return result;
  }

  // Step 2: Check if google_place_id already exists
  if (event.google_place_id) {
    if (!googleApiKey) {
      await logEnrichment(supabase, eventId, "failed", 0, "No Google API key", [], "google_places", dryRun);
      return {
        status: "failed",
        enrichedFields: [],
        apiCallsUsed: 0,
        error: "No Google API key configured",
        source: "google_places",
      };
    }
    
    const result = await enrichFromPlaceDetails(supabase, event, googleApiKey, dryRun);
    await logEnrichment(supabase, eventId, result.status, result.apiCallsUsed, result.error, result.enrichedFields, "google_places", dryRun);
    return result;
  }

  // Step 3: No place_id, need to search (Text Search API + Details API)
  if (!googleApiKey) {
    await logEnrichment(supabase, eventId, "failed", 0, "No Google API key", [], "google_places", dryRun);
    return {
      status: "failed",
      enrichedFields: [],
      apiCallsUsed: 0,
      error: "No Google API key configured",
      source: "google_places",
    };
  }

  const result = await enrichFromTextSearch(supabase, event, googleApiKey, dryRun);
  await logEnrichment(supabase, eventId, result.status, result.apiCallsUsed, result.error, result.enrichedFields, "google_places", dryRun);
  return result;
}

/**
 * Process a batch of events needing enrichment
 */
async function enrichBatch(
  supabase: ReturnType<typeof createClient>,
  googleApiKey: string | undefined,
  limit: number,
  dryRun: boolean
): Promise<{
  processed: number;
  registryMatches: number;
  apiEnrichments: number;
  failed: number;
  skipped: number;
  apiCallsUsed: number;
}> {
  // Get events needing enrichment
  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, venue_name, time_mode, google_place_id, enrichment_attempted_at")
    .or("contact_phone.is.null,opening_hours.is.null")
    .in("time_mode", ["window", "anytime"])
    .is("enrichment_attempted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !events) {
    console.error("Error fetching events for enrichment:", error);
    return {
      processed: 0,
      registryMatches: 0,
      apiEnrichments: 0,
      failed: 1,
      skipped: 0,
      apiCallsUsed: 0,
    };
  }

  if (events.length === 0) {
    return {
      processed: 0,
      registryMatches: 0,
      apiEnrichments: 0,
      failed: 0,
      skipped: 0,
      apiCallsUsed: 0,
    };
  }

  let registryMatches = 0;
  let apiEnrichments = 0;
  let failed = 0;
  let skipped = 0;
  let totalApiCalls = 0;

  for (const event of events) {
    try {
      const result = await enrichSingleEvent(supabase, event.id, googleApiKey, dryRun);
      
      totalApiCalls += result.apiCallsUsed;
      
      switch (result.status) {
        case "success":
        case "partial":
          if (result.source === "registry") {
            registryMatches++;
          } else {
            apiEnrichments++;
          }
          break;
        case "registry_match":
          registryMatches++;
          break;
        case "failed":
          failed++;
          break;
        case "skipped":
        case "budget_exceeded":
          skipped++;
          break;
      }

      // Small delay to avoid overwhelming the API
      if (result.apiCallsUsed > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Error enriching event ${event.id}:`, error);
      failed++;
    }
  }

  return {
    processed: events.length,
    registryMatches,
    apiEnrichments,
    failed,
    skipped,
    apiCallsUsed: totalApiCalls,
  };
}

/**
 * Apply data from VenueRegistry to event
 */
async function applyRegistryData(
  supabase: ReturnType<typeof createClient>,
  event: Partial<Event>,
  venue: {
    location: { lng: number; lat: number };
    google_place_id: string;
    contact_phone?: string;
    website_url?: string;
    opening_hours?: OpeningHours;
    price_range?: PriceRange;
  },
  dryRun: boolean
): Promise<EnrichmentResult> {
  const updates: Record<string, unknown> = {};
  const enrichedFields: string[] = [];

  // Apply venue data to event
  if (!event.google_place_id && venue.google_place_id) {
    updates.google_place_id = venue.google_place_id;
    enrichedFields.push("google_place_id");
  }

  if (!event.contact_phone && venue.contact_phone) {
    updates.contact_phone = venue.contact_phone;
    enrichedFields.push("contact_phone");
  }

  if (!event.website_url && venue.website_url) {
    updates.website_url = venue.website_url;
    enrichedFields.push("website_url");
  }

  if (!event.opening_hours && venue.opening_hours) {
    updates.opening_hours = venue.opening_hours;
    enrichedFields.push("opening_hours");
  }

  if (!event.price_range && venue.price_range) {
    updates.price_range = venue.price_range;
    enrichedFields.push("price_range");
  }

  // NOTE: Location updates require raw SQL for PostGIS geography type.
  // Supabase JS client doesn't natively support geography.
  // Location enrichment from registry is skipped - it should be handled 
  // by a dedicated RPC function if needed.
  // const hasLocation = event.location && event.location !== "POINT(0 0)";
  // if (!hasLocation) {
  //   // Would need: ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  //   enrichedFields.push("location");
  // }

  updates.enrichment_attempted_at = new Date().toISOString();

  if (enrichedFields.length === 0) {
    return {
      status: "skipped",
      enrichedFields: [],
      apiCallsUsed: 0,
      error: "No fields to enrich from registry",
      source: "registry",
    };
  }

  if (dryRun) {
    console.log("[DRY RUN] Would update event:", {
      eventId: event.id,
      updates,
      enrichedFields,
    });
  } else {
    const { error: updateError } = await supabase
      .from("events")
      .update(updates)
      .eq("id", event.id);

    if (updateError) {
      console.error("Error updating event from registry:", updateError);
      return {
        status: "failed",
        enrichedFields: [],
        apiCallsUsed: 0,
        error: updateError.message,
        source: "registry",
      };
    }
  }

  return {
    status: "registry_match",
    enrichedFields,
    apiCallsUsed: 0,
    source: "registry",
  };
}

/**
 * Enrich event from Google Place Details API
 */
async function enrichFromPlaceDetails(
  supabase: ReturnType<typeof createClient>,
  event: Partial<Event>,
  apiKey: string,
  dryRun: boolean
): Promise<EnrichmentResult> {
  if (!event.google_place_id) {
    return {
      status: "failed",
      enrichedFields: [],
      apiCallsUsed: 0,
      error: "No google_place_id to look up",
      source: "google_places",
    };
  }

  try {
    const placeDetails = await callGooglePlaceDetails(event.google_place_id, apiKey);
    return await applyGoogleData(supabase, event, placeDetails, 1, dryRun);
  } catch (error) {
    return {
      status: "failed",
      enrichedFields: [],
      apiCallsUsed: 1,
      error: error instanceof Error ? error.message : "API call failed",
      source: "google_places",
    };
  }
}

/**
 * Enrich event from Google Text Search + Place Details
 */
async function enrichFromTextSearch(
  supabase: ReturnType<typeof createClient>,
  event: Partial<Event>,
  apiKey: string,
  dryRun: boolean
): Promise<EnrichmentResult> {
  const searchQuery = `${event.title || event.venue_name || ""} Netherlands`;
  
  try {
    // Step 1: Text Search to find place_id
    const searchResult = await callGoogleTextSearch(searchQuery, apiKey);
    
    if (!searchResult || !searchResult.place_id) {
      return {
        status: "failed",
        enrichedFields: [],
        apiCallsUsed: 1,
        error: "No results from text search",
        source: "google_places",
      };
    }

    // Step 2: Place Details for full data
    const placeDetails = await callGooglePlaceDetails(searchResult.place_id, apiKey);
    
    return await applyGoogleData(supabase, event, placeDetails, 2, dryRun);
  } catch (error) {
    return {
      status: "failed",
      enrichedFields: [],
      apiCallsUsed: 1,
      error: error instanceof Error ? error.message : "API call failed",
      source: "google_places",
    };
  }
}

/**
 * Apply Google Places data to event
 */
async function applyGoogleData(
  supabase: ReturnType<typeof createClient>,
  event: Partial<Event>,
  placeData: GooglePlaceResult,
  apiCalls: number,
  dryRun: boolean
): Promise<EnrichmentResult> {
  const updates: Record<string, unknown> = {};
  const enrichedFields: string[] = [];

  // google_place_id
  if (!event.google_place_id && placeData.place_id) {
    updates.google_place_id = placeData.place_id;
    enrichedFields.push("google_place_id");
  }

  // contact_phone (prefer international format)
  if (!event.contact_phone) {
    const phone = placeData.international_phone_number || placeData.formatted_phone_number;
    if (phone) {
      // Clean to E.164 format:
      // 1. Remove all characters except digits and the leading plus
      // 2. Ensure plus sign is only at the start
      let cleaned = phone.trim();
      
      // If it starts with +, preserve it and clean the rest
      if (cleaned.startsWith('+')) {
        cleaned = '+' + cleaned.slice(1).replace(/\D/g, '');
      } else {
        // No plus sign - just keep digits (won't be valid E.164 without country code)
        cleaned = cleaned.replace(/\D/g, '');
      }
      
      if (isValidE164(cleaned)) {
        updates.contact_phone = cleaned;
        enrichedFields.push("contact_phone");
      }
    }
  }

  // website_url
  if (!event.website_url && placeData.website) {
    if (isValidUrl(placeData.website)) {
      updates.website_url = placeData.website;
      enrichedFields.push("website_url");
    }
  }

  // opening_hours
  if (!event.opening_hours && placeData.opening_hours) {
    const transformedHours = transformGoogleHoursToSchema(placeData.opening_hours);
    if (transformedHours && validateOpeningHours(transformedHours)) {
      updates.opening_hours = transformedHours;
      enrichedFields.push("opening_hours");
    }
  }

  // price_range
  if (!event.price_range && placeData.price_level !== undefined) {
    const priceRange = googlePriceLevelToRange(placeData.price_level);
    if (priceRange) {
      updates.price_range = priceRange;
      enrichedFields.push("price_range");
    }
  }

  updates.enrichment_attempted_at = new Date().toISOString();

  // Determine status
  const status: EnrichmentStatus = enrichedFields.length > 0 
    ? (enrichedFields.length >= 3 ? "success" : "partial")
    : "failed";

  if (dryRun) {
    console.log("[DRY RUN] Would update event:", {
      eventId: event.id,
      updates,
      enrichedFields,
    });
  } else if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("events")
      .update(updates)
      .eq("id", event.id);

    if (updateError) {
      console.error("Error updating event from Google:", updateError);
      return {
        status: "failed",
        enrichedFields: [],
        apiCallsUsed: apiCalls,
        error: updateError.message,
        source: "google_places",
      };
    }
  }

  return {
    status,
    enrichedFields,
    apiCallsUsed: apiCalls,
    source: "google_places",
  };
}

/**
 * Call Google Places Text Search API
 */
async function callGoogleTextSearch(
  query: string,
  apiKey: string,
  attempt = 1
): Promise<GooglePlaceResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);
  
  const response = await fetchWithRetry(url.toString(), attempt);
  const data = await response.json();
  
  if (data.status === "ZERO_RESULTS" || !data.results?.length) {
    return null;
  }
  
  if (data.status !== "OK") {
    throw new Error(`Google API error: ${data.status}`);
  }
  
  return data.results[0] as GooglePlaceResult;
}

/**
 * Call Google Places Details API
 */
async function callGooglePlaceDetails(
  placeId: string,
  apiKey: string,
  attempt = 1
): Promise<GooglePlaceResult> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,opening_hours,price_level,rating,user_ratings_total,geometry");
  url.searchParams.set("key", apiKey);
  
  const response = await fetchWithRetry(url.toString(), attempt);
  const data = await response.json();
  
  if (data.status !== "OK") {
    throw new Error(`Google API error: ${data.status}`);
  }
  
  return data.result as GooglePlaceResult;
}

/**
 * Fetch with exponential backoff retry
 */
async function fetchWithRetry(
  url: string,
  attempt = 1,
  maxAttempts = 3
): Promise<Response> {
  const response = await fetch(url);
  
  if (response.status === 429) { // Too Many Requests
    if (attempt >= maxAttempts) {
      throw new Error("Rate limit exceeded after retries");
    }
    
    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
    console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(url, attempt + 1, maxAttempts);
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response;
}

/**
 * Log enrichment attempt for observability
 */
async function logEnrichment(
  supabase: ReturnType<typeof createClient>,
  eventId: string,
  status: EnrichmentStatus,
  apiCalls: number,
  error: string | null | undefined,
  enrichedFields: string[],
  source: "registry" | "google_places",
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log("[DRY RUN] Would log enrichment:", {
      eventId,
      status,
      apiCalls,
      error,
      enrichedFields,
      source,
    });
    return;
  }

  try {
    await supabase.from("enrichment_logs").insert({
      event_id: eventId,
      status,
      api_calls_used: apiCalls,
      error_message: error || null,
      data_enriched: enrichedFields.length > 0 ? { fields: enrichedFields } : null,
      source,
    });
  } catch (err) {
    console.error("Failed to log enrichment:", err);
    // Don't throw - logging failure shouldn't break enrichment
  }
}
