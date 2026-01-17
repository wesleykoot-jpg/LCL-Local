/**
 * Type Definitions for Event Enrichment Engine
 * 
 * These types define the schema for the Social Utility Engine,
 * matching the database schema from migration 20260120_social_utility_engine.sql
 * 
 * @module types
 */

// ============================================================================
// TIME MODE & OPENING HOURS
// ============================================================================

/**
 * Temporal physics modes for events
 * - fixed: Events with hard start/end times (concerts, sports, films)
 * - window: Venues with recurring opening hours (restaurants, museums)
 * - anytime: Locations available 24/7 (parks, monuments)
 */
export type TimeMode = 'fixed' | 'window' | 'anytime';

/**
 * Single time range within a day
 */
export interface TimeRange {
  open: string;  // "HH:MM" format (24-hour)
  close: string; // "HH:MM" format (24-hour)
  closes_next_day?: boolean; // true for overnight hours (e.g., 23:00-02:00)
}

/**
 * Opening hours structure (Option A: Nested by day)
 * 
 * Design rationale:
 * - O(1) day lookup for "is venue open now?"
 * - Natural iteration for UI display
 * - closes_next_day flag handles overnight periods
 * - Missing days are implicitly closed
 * 
 * Examples:
 * - Restaurant: { monday: [{open: "12:00", close: "22:00"}], tuesday: "closed" }
 * - Nightclub: { friday: [{open: "23:00", close: "04:00", closes_next_day: true}] }
 * - Park: { always_open: true }
 */
export interface OpeningHours {
  monday?: TimeRange[] | 'closed';
  tuesday?: TimeRange[] | 'closed';
  wednesday?: TimeRange[] | 'closed';
  thursday?: TimeRange[] | 'closed';
  friday?: TimeRange[] | 'closed';
  saturday?: TimeRange[] | 'closed';
  sunday?: TimeRange[] | 'closed';
  always_open?: boolean; // true for 24/7 venues
}

// ============================================================================
// PRICE & EVENT TYPES
// ============================================================================

/**
 * Price range indicators
 * - free: No cost
 * - €: Budget-friendly
 * - €€: Moderate pricing
 * - €€€: Upscale
 * - €€€€: Luxury/premium
 */
export type PriceRange = 'free' | '€' | '€€' | '€€€' | '€€€€';

/**
 * Sidecar Event Model types
 * - anchor: Official/scraped events (cinema screenings, festivals, concerts)
 * - fork: User meetups attached to anchors (pre-movie drinks, post-game hangout)
 * - signal: Standalone user events (gaming sessions, casual meetups)
 */
export type EventType = 'anchor' | 'fork' | 'signal';

// ============================================================================
// SOCIAL LINKS
// ============================================================================

/**
 * Social media handles/identifiers
 * Store handles only, not full URLs (app constructs URLs as needed)
 */
export interface SocialLinks {
  instagram?: string;  // Username without @
  facebook?: string;   // Page ID or username
  tiktok?: string;     // Username with or without @
  twitter?: string;    // Handle without @
  youtube?: string;    // Channel ID or username
  website?: string;    // Additional website (different from main website_url)
}

// ============================================================================
// PROPOSAL & VOTING
// ============================================================================

/**
 * Proposal status in the collaborative planning workflow
 * - draft: Initial creation, not yet shared
 * - voting: Open for group voting
 * - confirmed: Finalized with agreed time
 * - cancelled: Abandoned proposal
 */
export type ProposalStatus = 'draft' | 'voting' | 'confirmed' | 'cancelled';

/**
 * Vote options for proposals
 * - yes: Will attend
 * - no: Cannot attend
 * - maybe: Tentative/uncertain
 */
export type VoteType = 'yes' | 'no' | 'maybe';

/**
 * Proposal for group meetup planning
 */
export interface Proposal {
  id: string;
  event_id: string | null;         // Reference to parent event
  venue_place_id: string | null;   // Google Place ID for venue-based proposals
  proposed_by: string;             // Profile ID of proposer
  proposed_time: string | null;    // Single proposed time (ISO 8601)
  proposed_times?: string[];       // Multiple time options (legacy)
  title?: string;                  // Optional title
  description?: string;            // Optional description
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Individual vote on a proposal
 */
export interface ProposalVote {
  id: string;
  proposal_id: string;
  user_id: string;                 // Profile ID of voter
  vote: VoteType;
  created_at: string;
}

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Enrichment attempt status
 * - success: All requested fields enriched
 * - partial: Some fields enriched, others failed
 * - failed: Enrichment completely failed
 * - registry_match: Data from VenueRegistry (0 API calls)
 * - budget_exceeded: Daily API budget reached
 * - skipped: Event type not eligible (e.g., fixed events)
 */
export type EnrichmentStatus = 
  | 'success' 
  | 'partial' 
  | 'failed' 
  | 'registry_match' 
  | 'budget_exceeded' 
  | 'skipped';

/**
 * Source of enrichment data
 */
export type EnrichmentSource = 'registry' | 'google_places' | 'manual';

/**
 * Enrichment log entry for observability
 */
export interface EnrichmentLog {
  id: string;
  event_id: string | null;
  status: EnrichmentStatus;
  api_calls_used: number;
  error_message?: string;
  data_enriched?: { fields: string[] };
  source?: EnrichmentSource;
  created_at: string;
}

/**
 * Result of an enrichment operation
 */
export interface EnrichmentResult {
  status: EnrichmentStatus;
  enrichedFields: string[];
  apiCallsUsed: number;
  error?: string;
  source: EnrichmentSource;
}

// ============================================================================
// EVENT (EXTENDED)
// ============================================================================

/**
 * Extended Event interface with Social Utility Engine fields
 * 
 * This extends the base event schema with:
 * - Temporal physics (time_mode, start_time, end_time, opening_hours)
 * - Actionable metadata (website_url, ticket_url, contact_phone, social_links)
 * - Geospatial intelligence (google_place_id)
 * - Enrichment tracking (enrichment_attempted_at)
 */
export interface Event {
  id: string;
  title: string;
  description: string | null;
  category: string;
  
  // Temporal physics
  time_mode: TimeMode;
  event_date: string | null;       // Legacy: Date string
  event_time: string;              // Legacy: Time string
  start_time: string | null;       // New: Precise start (ISO 8601)
  end_time: string | null;         // New: Precise end (ISO 8601)
  opening_hours: OpeningHours | null;
  
  // Sidecar model
  event_type: EventType;
  parent_event_id: string | null;
  
  // Location
  venue_name: string;
  location: string;                // PostGIS geography (WKT in JSON)
  google_place_id: string | null;
  
  // Actionable metadata
  website_url: string | null;
  ticket_url: string | null;
  contact_phone: string | null;    // E.164 format
  social_links: SocialLinks | null;
  price_range: PriceRange | null;
  
  // Media & display
  image_url: string | null;
  match_percentage: number | null;
  max_attendees: number | null;
  
  // Enrichment tracking
  enrichment_attempted_at: string | null;
  
  // Metadata
  created_by: string | null;
  source_id: string | null;
  event_fingerprint: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================================================
// GOOGLE PLACES API TYPES
// ============================================================================

/**
 * Google Places API opening hours period
 */
export interface GooglePeriod {
  open: {
    day: number;  // 0-6 (Sunday-Saturday)
    time: string; // "HHMM" format
  };
  close?: {
    day: number;
    time: string;
  };
}

/**
 * Google Places API opening hours response
 */
export interface GoogleOpeningHours {
  open_now?: boolean;
  periods?: GooglePeriod[];
  weekday_text?: string[];
}

/**
 * Google Places API result (simplified)
 */
export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  opening_hours?: GoogleOpeningHours;
  price_level?: number; // 0-4
  rating?: number;
  user_ratings_total?: number;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a time falls within a time range
 */
export function isTimeInRange(
  currentTime: string,  // "HH:MM" format
  range: TimeRange
): boolean {
  const current = timeToMinutes(currentTime);
  const open = timeToMinutes(range.open);
  const close = timeToMinutes(range.close);
  
  if (range.closes_next_day) {
    // Overnight hours: open 23:00, close 02:00
    // Valid if current >= open OR current < close
    return current >= open || current < close;
  }
  
  // Normal hours: current must be between open and close
  return current >= open && current < close;
}

/**
 * Convert "HH:MM" to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get day name from Date object (lowercase)
 */
export function getDayName(date: Date): keyof Omit<OpeningHours, 'always_open'> {
  const days: (keyof Omit<OpeningHours, 'always_open'>)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  return days[date.getDay()];
}

/**
 * Check if a venue is open at a given time
 */
export function isVenueOpen(
  hours: OpeningHours | null,
  checkTime: Date = new Date()
): boolean {
  if (!hours) return false;
  
  // 24/7 venues
  if (hours.always_open) return true;
  
  const dayName = getDayName(checkTime);
  const dayHours = hours[dayName];
  
  // Closed on this day
  if (!dayHours || dayHours === 'closed') return false;
  
  // Check each time range
  const currentTimeStr = checkTime.toTimeString().slice(0, 5); // "HH:MM"
  
  for (const range of dayHours) {
    if (isTimeInRange(currentTimeStr, range)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate E.164 phone number format
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Validate URL format (HTTP/HTTPS)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Convert Google price_level (0-4) to our PriceRange
 */
export function googlePriceLevelToRange(level: number | undefined): PriceRange | null {
  switch (level) {
    case 0: return 'free';
    case 1: return '€';
    case 2: return '€€';
    case 3: return '€€€';
    case 4: return '€€€€';
    default: return null;
  }
}
