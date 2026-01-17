/**
 * Social Utility Engine Types
 * 
 * Type definitions for the enhanced event system with:
 * - Temporal physics (time_mode, opening hours)
 * - Actionable metadata (contact info, URLs, pricing)
 * - Social negotiation (proposals, voting)
 * 
 * These types supplement the auto-generated Supabase types.
 * 
 * @module socialUtilityTypes
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
 * Single time range within a day (structured format)
 * New format that supports overnight hours and more complex schedules
 */
export interface StructuredTimeRange {
  open: string;  // "HH:MM" format (24-hour)
  close: string; // "HH:MM" format (24-hour)
  closes_next_day?: boolean; // true for overnight hours (e.g., 23:00-02:00)
}

/**
 * Opening hours in the structured format
 * Supports:
 * - Day-by-day schedules with multiple time ranges
 * - Overnight hours (closes_next_day flag)
 * - Explicit closed days
 * - 24/7 venues (always_open flag)
 */
export interface StructuredOpeningHours {
  monday?: StructuredTimeRange[] | 'closed';
  tuesday?: StructuredTimeRange[] | 'closed';
  wednesday?: StructuredTimeRange[] | 'closed';
  thursday?: StructuredTimeRange[] | 'closed';
  friday?: StructuredTimeRange[] | 'closed';
  saturday?: StructuredTimeRange[] | 'closed';
  sunday?: StructuredTimeRange[] | 'closed';
  always_open?: boolean;
}

/**
 * Legacy opening hours format (string ranges like "09:00-17:00")
 * Still supported for backward compatibility
 */
export type LegacyTimeRange = string; // Format: "HH:MM-HH:MM"
export type LegacyOpeningHours = Partial<Record<DayOfWeek, LegacyTimeRange[]>>;

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * Union type for opening hours (supports both formats)
 */
export type OpeningHours = StructuredOpeningHours | LegacyOpeningHours;

// ============================================================================
// PRICE & EVENT TYPES
// ============================================================================

/**
 * Price range indicators
 */
export type PriceRange = 'free' | '€' | '€€' | '€€€' | '€€€€';

/**
 * Sidecar Event Model types
 */
export type EventType = 'anchor' | 'fork' | 'signal';

// ============================================================================
// SOCIAL LINKS
// ============================================================================

/**
 * Social media handles/identifiers
 */
export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;
  youtube?: string;
  website?: string;
}

// ============================================================================
// PROPOSAL & VOTING
// ============================================================================

/**
 * Extended proposal status (includes voting phase)
 */
export type ProposalStatus = 'draft' | 'voting' | 'confirmed' | 'cancelled';

/**
 * Vote options for proposals
 */
export type VoteType = 'yes' | 'no' | 'maybe';

/**
 * Vote on a proposal
 */
export interface ProposalVote {
  id: string;
  proposal_id: string;
  user_id: string;
  vote: VoteType;
  created_at: string;
}

/**
 * Extended proposal interface with new fields
 */
export interface ExtendedProposal {
  id: string;
  event_id: string | null;
  venue_place_id: string | null;
  creator_id: string;
  proposed_time: string | null;
  proposed_times: string[];
  title: string | null;
  description: string | null;
  status: ProposalStatus;
  created_at: string;
  updated_at: string;
  votes?: ProposalVote[];
}

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Enrichment attempt status
 */
export type EnrichmentStatus = 
  | 'success' 
  | 'partial' 
  | 'failed' 
  | 'registry_match' 
  | 'budget_exceeded' 
  | 'skipped';

/**
 * Enrichment log entry
 */
export interface EnrichmentLog {
  id: string;
  event_id: string | null;
  status: EnrichmentStatus;
  api_calls_used: number;
  error_message: string | null;
  data_enriched: { fields: string[] } | null;
  source: 'registry' | 'google_places' | 'manual' | null;
  created_at: string;
}

// ============================================================================
// EXTENDED EVENT
// ============================================================================

/**
 * Extended event interface with Social Utility Engine fields
 * 
 * This extends the base event type with new columns from the migration.
 * Use this type when you need access to the enrichment fields.
 */
export interface EnrichedEvent {
  // Base fields
  id: string;
  title: string;
  description: string | null;
  category: string;
  
  // Temporal physics
  time_mode: TimeMode | null;
  event_date: string | null;
  event_time: string;
  start_time: string | null;
  end_time: string | null;
  opening_hours: OpeningHours | null;
  
  // Sidecar model
  event_type: EventType;
  parent_event_id: string | null;
  
  // Location
  venue_name: string;
  location: unknown; // PostGIS geography
  google_place_id: string | null;
  
  // Actionable metadata
  website_url: string | null;
  ticket_url: string | null;
  contact_phone: string | null;
  social_links: SocialLinks | null;
  price_range: PriceRange | null;
  
  // Media & display
  image_url: string | null;
  match_percentage: number | null;
  max_attendees: number | null;
  is_private: boolean;
  
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if opening hours are in structured format
 */
export function isStructuredOpeningHours(hours: OpeningHours): hours is StructuredOpeningHours {
  if (!hours) return false;
  
  // Check for always_open flag (only in structured)
  if ('always_open' in hours) return true;
  
  // Check if any day's value is an array of objects with 'open' property
  for (const day of Object.keys(hours)) {
    const dayHours = hours[day as DayOfWeek];
    if (Array.isArray(dayHours) && dayHours.length > 0) {
      const first = dayHours[0];
      if (typeof first === 'object' && first !== null && 'open' in first) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Convert legacy opening hours to structured format
 */
export function convertToStructuredHours(legacy: LegacyOpeningHours): StructuredOpeningHours {
  const result: StructuredOpeningHours = {};
  
  for (const [day, ranges] of Object.entries(legacy)) {
    if (!ranges || ranges.length === 0) continue;
    
    const structuredRanges: StructuredTimeRange[] = [];
    
    for (const range of ranges) {
      const [open, close] = range.split('-');
      if (open && close) {
        structuredRanges.push({ open: open.trim(), close: close.trim() });
      }
    }
    
    if (structuredRanges.length > 0) {
      result[day as DayOfWeek] = structuredRanges;
    }
  }
  
  return result;
}

/**
 * Validate E.164 phone number format
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

/**
 * Validate URL format
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
 * Get price range label for display
 */
export function getPriceRangeLabel(range: PriceRange | null): string {
  switch (range) {
    case 'free': return 'Free';
    case '€': return 'Budget';
    case '€€': return 'Moderate';
    case '€€€': return 'Upscale';
    case '€€€€': return 'Luxury';
    default: return 'Price not available';
  }
}
