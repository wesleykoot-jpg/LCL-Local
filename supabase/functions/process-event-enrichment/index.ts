import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { findVenueInRegistry, type RegisteredVenue } from './venueRegistry.ts';
import type { DayOfWeek, OpeningHours, OpeningPeriod } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_NAMES: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const MAX_RETRY_COUNT = 3;
const GOOGLE_FIELDS = [
  'place_id',
  'international_phone_number',
  'website',
  'opening_hours',
  'geometry',
  'price_level',
  'name',
].join(',');

type PriceRange = 'free' | '€' | '€€' | '€€€' | '€€€€';

type EnrichmentStatus = 'success' | 'partial' | 'failed' | 'registry_match' | 'budget_exceeded' | 'skipped';

interface EventRow {
  id: string;
  title: string;
  venue_name: string;
  time_mode: 'fixed' | 'window' | 'anytime';
  google_place_id: string | null;
  opening_hours: OpeningHours | null;
  contact_phone: string | null;
  website_url: string | null;
  price_range: PriceRange | null;
  enrichment_attempted_at: string | null;
  enrichment_retry_count: number | null;
}

interface GooglePlaceDetailsResponse {
  status: string;
  result?: {
    place_id?: string;
    name?: string;
    international_phone_number?: string;
    website?: string;
    opening_hours?: {
      periods?: Array<{
        open: { day: number; time: string };
        close?: { day: number; time: string };
      }>;
    };
    geometry?: {
      location?: { lat: number; lng: number };
    };
    price_level?: number;
  };
}

interface GoogleTextSearchResponse {
  status: string;
  results?: Array<{ place_id?: string }>;
}

interface EnrichmentResult {
  eventId: string;
  status: EnrichmentStatus;
  apiCallsUsed: number;
  enrichedFields: string[];
  error?: string;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl ?? '', supabaseServiceKey ?? '', {
  auth: { persistSession: false },
});

const isDryRun = Deno.env.get('ENRICHMENT_DRY_RUN') === 'true';
const maxDailyCalls = Number(Deno.env.get('MAX_ENRICHMENT_CALLS_PER_DAY') ?? 0);
let cachedDailyCalls: number | null = null;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const eventId = await extractEventId(req);
    if (eventId) {
      const result = await enrichEvent(eventId);
      return jsonResponse(result);
    }

    const events = await fetchEventsNeedingEnrichment();
    const results: EnrichmentResult[] = [];

    for (const event of events) {
      results.push(await enrichEvent(event.id));
    }

    return jsonResponse({ processed: results.length, results });
  } catch (error) {
    console.error('Enrichment worker failed:', error);
    return jsonResponse(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
});

async function extractEventId(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const queryId = url.searchParams.get('eventId');
  if (queryId) return queryId;

  if (req.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await req.json();
      if (body && typeof body.eventId === 'string') {
        return body.eventId;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

async function fetchEventsNeedingEnrichment(): Promise<EventRow[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('events')
    .select(
      'id,title,venue_name,time_mode,google_place_id,opening_hours,contact_phone,website_url,price_range,enrichment_attempted_at,enrichment_retry_count'
    )
    .in('time_mode', ['window', 'anytime'])
    .or('contact_phone.is.null,opening_hours.is.null,location.is.null')
    .is('enrichment_attempted_at', null)
    .gte('created_at', since)
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? []) as EventRow[];
}

async function enrichEvent(eventId: string): Promise<EnrichmentResult> {
  const event = await fetchEvent(eventId);
  if (!event) {
    return { eventId, status: 'failed', apiCallsUsed: 0, enrichedFields: [], error: 'Event not found' };
  }

  if (event.time_mode === 'fixed') {
    return { eventId, status: 'skipped', apiCallsUsed: 0, enrichedFields: [] };
  }

  if ((event.enrichment_retry_count ?? 0) >= MAX_RETRY_COUNT) {
    return { eventId, status: 'failed', apiCallsUsed: 0, enrichedFields: [], error: 'Retry limit reached' };
  }

  const registryMatch = findVenueInRegistry(event.venue_name || event.title);
  if (registryMatch) {
    return await applyRegistryData(event, registryMatch);
  }

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) {
    return { eventId, status: 'failed', apiCallsUsed: 0, enrichedFields: [], error: 'Missing Google API key' };
  }

  if (event.google_place_id) {
    return await enrichFromPlaceDetails(event, event.google_place_id, apiKey);
  }

  return await enrichFromTextSearch(event, apiKey);
}

async function fetchEvent(eventId: string): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id,title,venue_name,time_mode,google_place_id,opening_hours,contact_phone,website_url,price_range,enrichment_attempted_at,enrichment_retry_count'
    )
    .eq('id', eventId)
    .single();

  if (error) {
    console.error('Failed to load event:', error);
    return null;
  }

  return data as EventRow;
}

async function applyRegistryData(event: EventRow, venue: RegisteredVenue): Promise<EnrichmentResult> {
  const updateData: Record<string, unknown> = {
    google_place_id: venue.google_place_id,
    contact_phone: venue.contact_phone ?? event.contact_phone,
    website_url: venue.website_url ?? event.website_url,
    location: toPostgisPoint(venue.location),
    opening_hours: venue.opening_hours ?? event.opening_hours,
    enrichment_attempted_at: new Date().toISOString(),
    enrichment_retry_count: 0,
  };

  const enrichedFields = Object.keys(updateData).filter((field) => updateData[field] !== null);

  if (isDryRun) {
    console.log('[DRY RUN] Would apply registry match', { eventId: event.id, updateData });
    return { eventId: event.id, status: 'registry_match', apiCallsUsed: 0, enrichedFields };
  }

  const { error } = await supabase.from('events').update(updateData).eq('id', event.id);
  if (error) {
    await logEnrichment(event.id, 'failed', 0, error, enrichedFields);
    return { eventId: event.id, status: 'failed', apiCallsUsed: 0, enrichedFields, error: error.message };
  }

  await logEnrichment(event.id, 'registry_match', 0, undefined, enrichedFields);
  return { eventId: event.id, status: 'registry_match', apiCallsUsed: 0, enrichedFields };
}

async function enrichFromPlaceDetails(event: EventRow, placeId: string, apiKey: string): Promise<EnrichmentResult> {
  const budgetOk = await reserveApiBudget(1);
  if (!budgetOk) {
    await logEnrichment(event.id, 'budget_exceeded', 0, undefined, []);
    return { eventId: event.id, status: 'budget_exceeded', apiCallsUsed: 0, enrichedFields: [] };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${GOOGLE_FIELDS}&key=${apiKey}`;
    const response = await callGoogleAPI(url);
    const data = (await response.json()) as GooglePlaceDetailsResponse;

    if (data.status !== 'OK' || !data.result) {
      throw new Error(`Place details failed: ${data.status}`);
    }

    const updateData = buildUpdateDataFromGoogle(data.result, placeId);
    const { status, enrichedFields } = await applyEventUpdates(event.id, updateData, 1);
    return { eventId: event.id, status, apiCallsUsed: 1, enrichedFields };
  } catch (error) {
    await handleEnrichmentFailure(event.id, error as Error, 1);
    return { eventId: event.id, status: 'failed', apiCallsUsed: 1, enrichedFields: [], error: (error as Error).message };
  }
}

async function enrichFromTextSearch(event: EventRow, apiKey: string): Promise<EnrichmentResult> {
  const budgetOk = await reserveApiBudget(2);
  if (!budgetOk) {
    await logEnrichment(event.id, 'budget_exceeded', 0, undefined, []);
    return { eventId: event.id, status: 'budget_exceeded', apiCallsUsed: 0, enrichedFields: [] };
  }

  try {
    const query = `${event.venue_name || event.title} Netherlands`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
    const searchResponse = await callGoogleAPI(searchUrl);
    const searchData = (await searchResponse.json()) as GoogleTextSearchResponse;

    if (searchData.status !== 'OK' || !searchData.results?.length || !searchData.results[0].place_id) {
      throw new Error(`Text search failed: ${searchData.status}`);
    }

    const placeId = searchData.results[0].place_id;
    const detailsResult = await enrichFromPlaceDetails(event, placeId, apiKey);
    return { ...detailsResult, apiCallsUsed: 2 };
  } catch (error) {
    await handleEnrichmentFailure(event.id, error as Error, 2);
    return { eventId: event.id, status: 'failed', apiCallsUsed: 2, enrichedFields: [], error: (error as Error).message };
  }
}

function buildUpdateDataFromGoogle(result: NonNullable<GooglePlaceDetailsResponse['result']>, placeId: string) {
  const updateData: Record<string, unknown> = {
    google_place_id: placeId,
    enrichment_attempted_at: new Date().toISOString(),
    enrichment_retry_count: 0,
  };

  if (result.international_phone_number) {
    updateData.contact_phone = result.international_phone_number;
  }

  if (result.website) {
    updateData.website_url = result.website;
  }

  if (result.geometry?.location) {
    updateData.location = toPostgisPoint(result.geometry.location);
  }

  if (typeof result.price_level === 'number') {
    updateData.price_range = mapPriceRange(result.price_level);
  }

  if (result.opening_hours?.periods) {
    const transformed = transformGoogleHoursToSchema({ periods: result.opening_hours.periods });
    if (validateOpeningHours(transformed)) {
      updateData.opening_hours = transformed;
    }
  }

  return updateData;
}

async function applyEventUpdates(
  eventId: string,
  updateData: Record<string, unknown>,
  apiCallsUsed: number
): Promise<{ status: EnrichmentStatus; enrichedFields: string[] }> {
  const enrichedFields = Object.keys(updateData).filter((field) => field !== 'enrichment_retry_count');
  const requiredFields = ['contact_phone', 'location', 'opening_hours'];
  const hasAllRequired = requiredFields.every((field) => updateData[field]);
  const status: EnrichmentStatus = enrichedFields.length === 0 ? 'failed' : hasAllRequired ? 'success' : 'partial';

  if (isDryRun) {
    console.log('[DRY RUN] Would update event', { eventId, updateData });
    return { status, enrichedFields };
  }

  const { error } = await supabase.from('events').update(updateData).eq('id', eventId);
  if (error) {
    await logEnrichment(eventId, 'failed', apiCallsUsed, error, enrichedFields);
    throw error;
  }

  await logEnrichment(eventId, status, apiCallsUsed, undefined, enrichedFields);
  return { status, enrichedFields };
}

async function handleEnrichmentFailure(eventId: string, error: Error, apiCallsUsed: number) {
  if (!isDryRun) {
    await supabase
      .from('events')
      .update({
        enrichment_attempted_at: new Date().toISOString(),
        enrichment_retry_count: supabase.rpc ? undefined : undefined,
      })
      .eq('id', eventId);
  }

  await logEnrichment(eventId, 'failed', apiCallsUsed, error, []);
}

async function reserveApiBudget(callsNeeded: number): Promise<boolean> {
  if (!maxDailyCalls) return true;

  if (cachedDailyCalls === null) {
    cachedDailyCalls = await getDailyApiCallCount();
  }

  if (cachedDailyCalls + callsNeeded > maxDailyCalls) {
    return false;
  }

  cachedDailyCalls += callsNeeded;
  return true;
}

async function getDailyApiCallCount(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('enrichment_logs')
    .select('api_calls_used')
    .gte('created_at', today.toISOString());

  if (error) {
    console.error('Failed to fetch daily API call count:', error);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + (row.api_calls_used ?? 0), 0);
}

async function logEnrichment(
  eventId: string,
  status: EnrichmentStatus,
  apiCalls: number,
  error?: { message: string },
  enrichedFields?: string[]
) {
  if (isDryRun) return;

  await supabase.from('enrichment_logs').insert({
    event_id: eventId,
    status,
    api_calls_used: apiCalls,
    error_message: error?.message,
    data_enriched: enrichedFields ? { fields: enrichedFields } : null,
  });
}

async function callGoogleAPI(url: string, attempt = 1): Promise<Response> {
  const response = await fetch(url);

  if (response.status === 429) {
    const delay = Math.pow(2, attempt) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (attempt < 4) return callGoogleAPI(url, attempt + 1);
    throw new Error('Rate limit exceeded after retries');
  }

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  return response;
}

function mapPriceRange(level: number): PriceRange | null {
  switch (level) {
    case 0:
      return 'free';
    case 1:
      return '€';
    case 2:
      return '€€';
    case 3:
      return '€€€';
    case 4:
      return '€€€€';
    default:
      return null;
  }
}

function toPostgisPoint(coords: { lng: number; lat: number }): string {
  return `POINT(${coords.lng} ${coords.lat})`;
}

function formatGoogleTime(value: string): string | null {
  const padded = value.padStart(4, '0');
  if (!/^\d{4}$/.test(padded)) return null;
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function parseTimeToMinutes(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function transformGoogleHoursToSchema(googleHours: { periods?: Array<{ open: { day: number; time: string }; close?: { day: number; time: string } }> }): OpeningHours {
  const periods = googleHours.periods ?? [];
  if (periods.length === 0) {
    return { always_open: true };
  }

  const result: OpeningHours = {
    monday: 'closed',
    tuesday: 'closed',
    wednesday: 'closed',
    thursday: 'closed',
    friday: 'closed',
    saturday: 'closed',
    sunday: 'closed',
  };

  for (const period of periods) {
    const openDay = DAY_NAMES[period.open.day];
    if (!openDay) continue;

    const openTime = formatGoogleTime(period.open.time);
    const closeTime = period.close ? formatGoogleTime(period.close.time) : null;
    if (!openTime || !closeTime) continue;

    const closesNextDay = period.close?.day !== period.open.day;
    const schedule = result[openDay];
    const list = Array.isArray(schedule) ? schedule : [];

    list.push({
      open: openTime,
      close: closeTime,
      ...(closesNextDay ? { closes_next_day: true } : {}),
    });

    result[openDay] = list;
  }

  return result;
}

function validateOpeningHours(hours: OpeningHours): boolean {
  if (hours.always_open) return true;

  for (const day of DAY_NAMES) {
    const schedule = hours[day];
    if (!schedule || schedule === 'closed') continue;

    const ranges = schedule
      .map((period) => {
        const openMinutes = parseTimeToMinutes(period.open);
        const closeMinutes = parseTimeToMinutes(period.close);
        if (openMinutes === null || closeMinutes === null) return null;
        if (!period.closes_next_day && closeMinutes <= openMinutes) return null;
        const end = period.closes_next_day ? closeMinutes + 24 * 60 : closeMinutes;
        return { start: openMinutes, end };
      })
      .filter((range): range is { start: number; end: number } => Boolean(range));

    ranges.sort((a, b) => a.start - b.start);

    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i].start < ranges[i - 1].end) {
        return false;
      }
    }
  }

  return true;
}
