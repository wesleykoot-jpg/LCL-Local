/**
 * Social Five Schema for OpenAI Structured Outputs
 * 
 * Defines the strict JSON schema for extracting the 5 key social data points
 * using OpenAI's Structured Outputs API (response_format: json_schema).
 * 
 * The "Social Five" are:
 * 1. Start Time & Doors Open - Distinguish "Doors" from "Performance Start"
 * 2. Precise Location - Venue name + full street address (Map-ready)
 * 3. Duration/End Time - For filling user itinerary gaps
 * 4. Language Profile - Auto-tag as NL, EN, or Mixed
 * 5. Interaction Mode - AI-inferred energy level
 * 
 * @module _shared/socialFiveSchema
 */

// ============================================================================
// OPENAI STRUCTURED OUTPUT SCHEMA
// ============================================================================

export const SOCIAL_FIVE_SCHEMA = {
  name: "social_event_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      // ========== Core Event Info ==========
      title: {
        type: "string",
        description: "Clean event title without venue name or date"
      },
      description: {
        type: "string",
        description: "Event description (max 500 chars, preserve key details)"
      },
      event_date: {
        type: "string",
        description: "Event date in YYYY-MM-DD format"
      },
      
      // ========== Social Five #1: Start Time & Doors Open ==========
      start_time: {
        type: "string",
        description: "Event start time in HH:MM format (24-hour). When the main activity begins."
      },
      doors_open_time: {
        type: ["string", "null"],
        description: "When doors/entry opens if different from start_time. HH:MM format or null."
      },
      
      // ========== Social Five #2: Precise Location ==========
      venue_name: {
        type: "string",
        description: "Name of the venue (e.g., 'Paradiso', 'De Balie')"
      },
      street_address: {
        type: ["string", "null"],
        description: "Full street address (e.g., 'Weteringschans 6-8')"
      },
      city: {
        type: ["string", "null"],
        description: "City name (e.g., 'Amsterdam')"
      },
      postal_code: {
        type: ["string", "null"],
        description: "Postal code (e.g., '1017 SG')"
      },
      
      // ========== Social Five #3: Duration/End Time ==========
      end_time: {
        type: ["string", "null"],
        description: "Event end time in HH:MM format (24-hour) or null if unknown."
      },
      estimated_duration_minutes: {
        type: ["integer", "null"],
        description: "Estimated duration in minutes if end_time is unknown (e.g., 120 for 2 hours)"
      },
      
      // ========== Social Five #4: Language Profile ==========
      language_profile: {
        type: "string",
        enum: ["NL", "EN", "Mixed", "Other"],
        description: "Primary language: NL=Dutch, EN=English, Mixed=both languages used"
      },
      
      // ========== Social Five #5: Interaction Mode ==========
      interaction_mode: {
        type: "string",
        enum: ["high", "medium", "low", "passive"],
        description: "Social interaction level: high=workshops/networking, medium=concerts/markets, low=talks/lectures, passive=movies/exhibitions"
      },
      
      // ========== Additional Useful Fields ==========
      category: {
        type: "string",
        enum: ["MUSIC", "SOCIAL", "ACTIVE", "CULTURE", "FOOD", "NIGHTLIFE", "FAMILY", "CIVIC", "COMMUNITY"],
        description: "Event category in UPPERCASE"
      },
      persona_tags: {
        type: "array",
        items: { type: "string" },
        description: "Persona fit tags: ExpatFriendly, DigitalNomad, FamilyFriendly, Networking, BeginnerFriendly, DateNight, SoloFriendly"
      },
      image_url: {
        type: ["string", "null"],
        description: "URL to event image (absolute URL)"
      },
      ticket_url: {
        type: ["string", "null"],
        description: "URL to purchase tickets (absolute URL)"
      },
      price_info: {
        type: ["string", "null"],
        description: "Price information (e.g., '€15', 'Free', '€10-€25')"
      }
    },
    required: [
      "title",
      "event_date", 
      "start_time",
      "venue_name",
      "language_profile",
      "interaction_mode",
      "category"
    ],
    additionalProperties: false
  }
};

// ============================================================================
// TYPESCRIPT INTERFACES
// ============================================================================

export type LanguageProfile = 'NL' | 'EN' | 'Mixed' | 'Other';
export type InteractionMode = 'high' | 'medium' | 'low' | 'passive';
export type CategoryKey = 'MUSIC' | 'SOCIAL' | 'ACTIVE' | 'CULTURE' | 'FOOD' | 'NIGHTLIFE' | 'FAMILY' | 'CIVIC' | 'COMMUNITY';

/**
 * Fully extracted Social Five event data
 */
export interface SocialFiveEvent {
  // Core
  title: string;
  description?: string;
  event_date: string;  // YYYY-MM-DD
  
  // Social Five #1: Start Time & Doors
  start_time: string;  // HH:MM
  doors_open_time?: string | null;
  
  // Social Five #2: Precise Location
  venue_name: string;
  street_address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  
  // Social Five #3: Duration/End Time
  end_time?: string | null;
  estimated_duration_minutes?: number | null;
  
  // Social Five #4: Language Profile
  language_profile: LanguageProfile;
  
  // Social Five #5: Interaction Mode
  interaction_mode: InteractionMode;
  
  // Additional
  category: CategoryKey;
  persona_tags?: string[];
  image_url?: string | null;
  ticket_url?: string | null;
  price_info?: string | null;
}

/**
 * Input hints for enrichment (from Pass 1 discovery)
 */
export interface EnrichmentHints {
  title?: string;
  date?: string;
  location?: string;
  detailUrl?: string;
}

/**
 * Enrichment result with metadata
 */
export interface EnrichmentResult {
  success: boolean;
  event: SocialFiveEvent | null;
  socialFiveScore: number;  // 0-5
  confidence: number;  // 0-1
  processingTimeMs: number;
  error?: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate Social Five completeness score (0-5)
 */
export function calculateSocialFiveScore(event: Partial<SocialFiveEvent>): number {
  let score = 0;
  
  // 1. Start Time (doors OR start)
  if (event.start_time && event.start_time.match(/^\d{2}:\d{2}$/)) {
    score++;
  }
  
  // 2. Precise Location (venue + address OR city)
  if (event.venue_name && (event.street_address || event.city)) {
    score++;
  }
  
  // 3. End Time/Duration
  if (event.end_time || (event.estimated_duration_minutes && event.estimated_duration_minutes > 0)) {
    score++;
  }
  
  // 4. Language Profile
  if (event.language_profile && ['NL', 'EN', 'Mixed', 'Other'].includes(event.language_profile)) {
    score++;
  }
  
  // 5. Interaction Mode
  if (event.interaction_mode && ['high', 'medium', 'low', 'passive'].includes(event.interaction_mode)) {
    score++;
  }
  
  return score;
}

/**
 * Check if Social Five is complete (score = 5)
 */
export function isSocialFiveComplete(event: Partial<SocialFiveEvent>): boolean {
  return calculateSocialFiveScore(event) === 5;
}

/**
 * Get missing Social Five fields
 */
export function getMissingSocialFiveFields(event: Partial<SocialFiveEvent>): string[] {
  const missing: string[] = [];
  
  if (!event.start_time || !event.start_time.match(/^\d{2}:\d{2}$/)) {
    missing.push('start_time');
  }
  
  if (!event.venue_name || (!event.street_address && !event.city)) {
    missing.push('location');
  }
  
  if (!event.end_time && (!event.estimated_duration_minutes || event.estimated_duration_minutes <= 0)) {
    missing.push('end_time/duration');
  }
  
  if (!event.language_profile) {
    missing.push('language_profile');
  }
  
  if (!event.interaction_mode) {
    missing.push('interaction_mode');
  }
  
  return missing;
}

/**
 * Build structured address object for database
 */
export function buildStructuredAddress(event: Partial<SocialFiveEvent>): Record<string, unknown> | null {
  if (!event.venue_name) return null;
  
  return {
    venue: event.venue_name,
    street: event.street_address || null,
    city: event.city || null,
    postal_code: event.postal_code || null,
    country: 'Netherlands'  // Default for Dutch rollout
  };
}
