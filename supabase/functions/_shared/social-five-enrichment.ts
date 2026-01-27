/**
 * Social Five Enrichment: GPT-4o structured outputs for event data extraction
 * 
 * The "Social Five" are the essential data points for social event matching:
 * 1. Start Time & Doors Open - When does it start? Can you arrive early?
 * 2. Precise Location - Map-ready address for navigation
 * 3. Duration/End Time - How long does it last?
 * 4. Language Profile - What language is spoken?
 * 5. Interaction Mode - How social is the event?
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Types
export interface SocialFive {
  // 1. Start Time & Doors Open
  eventDate: string | null;       // ISO date YYYY-MM-DD
  eventTime: string | null;       // HH:MM (24h)
  doorsOpenTime: string | null;   // HH:MM (24h)

  // 2. Precise Location
  venueName: string | null;
  venueAddress: string | null;    // Full address for geocoding
  coordinates: { lat: number; lng: number } | null;

  // 3. Duration/End Time
  endDate: string | null;         // ISO date
  endTime: string | null;         // HH:MM

  // 4. Language Profile
  languageProfile: 'NL' | 'EN' | 'DE' | 'MIXED';

  // 5. Interaction Mode
  interactionMode: 'HIGH' | 'MEDIUM' | 'LOW' | 'PASSIVE';
}

export interface EnrichmentResult extends SocialFive {
  // Additional extracted fields
  title: string;
  description: string | null;
  category: string | null;
  price: string | null;
  priceMinCents: number | null;
  priceMaxCents: number | null;
  ticketsUrl: string | null;
  organizer: string | null;
  performer: string | null;
  ageRestriction: string | null;
  imageUrl: string | null;

  // Persona tags for matching
  personaTags: string[];

  // Quality metrics
  dataCompleteness: number;       // 0-1 score
  extractionConfidence: number;   // 0-1 score
}

export interface VibeClassification {
  primaryVibe: string;
  vibeScore: number;
  suggestedPersonas: string[];
  socialIntensity: 'low' | 'medium' | 'high';
  recommendedFor: string[];
}

// Persona types for tagging
const PERSONA_TYPES = [
  'Nightlife Explorers',
  'Culture Vultures',
  'Sports Fanatics',
  'Foodies',
  'Nature Enthusiasts',
  'Family-Oriented',
  'Music Lovers',
  'Social Butterflies',
  'Quiet Seekers',
  'Adventure Seekers',
];

// Category mapping for Dutch events
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  cinema: ['film', 'bioscoop', 'movie', 'cinema', 'vertoning'],
  music: ['concert', 'muziek', 'optreden', 'live', 'dj', 'band'],
  sports: ['sport', 'wedstrijd', 'voetbal', 'hockey', 'tennis', 'fitness'],
  food: ['eten', 'restaurant', 'food', 'culinair', 'proeverij', 'markt'],
  crafts: ['workshop', 'cursus', 'maken', 'creatief', 'handwerk'],
  wellness: ['yoga', 'meditatie', 'wellness', 'spa', 'ontspanning'],
  family: ['kinderen', 'familie', 'gezin', 'kids', 'jeugd'],
  outdoor: ['wandeling', 'fietsen', 'natuur', 'outdoor', 'park'],
  market: ['markt', 'braderie', 'fair', 'beurs', 'rommelmarkt'],
  gaming: ['gaming', 'esports', 'bordspel', 'lan', 'game'],
};

/**
 * Extract Social Five using GPT-4o with structured outputs
 */
export async function extractSocialFive(
  html: string,
  url: string,
  existingData: Partial<EnrichmentResult> = {}
): Promise<EnrichmentResult> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Truncate HTML for API limits
  const truncatedHtml = html.slice(0, 25000);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert event data extractor for Dutch events. Extract structured event information from HTML.

CRITICAL: Focus on "The Social Five" - the most important fields for social matching:
1. Start Time & Doors Open - Extract both if available
2. Precise Location - Full address suitable for map navigation
3. Duration/End Time - When does the event end?
4. Language Profile - What language is the event in? (NL/EN/DE/MIXED)
5. Interaction Mode - How social is this event?
   - HIGH: Interactive, social mixing expected (workshops, meetups, parties)
   - MEDIUM: Social atmosphere but passive participation (concerts, markets)
   - LOW: Minimal interaction (cinema, lectures)
   - PASSIVE: Watch/observe only (exhibitions, monuments)

Also extract: title, description, category, price, organizer, performer, age restrictions.

For prices, extract both minimum and maximum in cents (e.g., "€12,50" = 1250 cents).
For Dutch dates, parse formats like "za 15 feb", "15-02-2025", "zaterdag 15 februari".
For times, always use 24-hour format.

Return null for fields you cannot confidently extract.`
        },
        {
          role: "user",
          content: `Extract event details from this page (${url}):\n\n${truncatedHtml}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "event_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Event title" },
              description: { type: ["string", "null"], description: "Event description" },
              eventDate: { type: ["string", "null"], description: "Date in YYYY-MM-DD format" },
              eventTime: { type: ["string", "null"], description: "Start time in HH:MM 24h format" },
              doorsOpenTime: { type: ["string", "null"], description: "Doors open time in HH:MM" },
              endDate: { type: ["string", "null"], description: "End date in YYYY-MM-DD format" },
              endTime: { type: ["string", "null"], description: "End time in HH:MM 24h format" },
              venueName: { type: ["string", "null"], description: "Venue/location name" },
              venueAddress: { type: ["string", "null"], description: "Full address for geocoding" },
              languageProfile: { 
                type: "string", 
                enum: ["NL", "EN", "DE", "MIXED"],
                description: "Primary language of the event" 
              },
              interactionMode: { 
                type: "string", 
                enum: ["HIGH", "MEDIUM", "LOW", "PASSIVE"],
                description: "Expected social interaction level" 
              },
              category: { type: ["string", "null"], description: "Event category" },
              price: { type: ["string", "null"], description: "Price as displayed" },
              priceMinCents: { type: ["number", "null"], description: "Minimum price in cents" },
              priceMaxCents: { type: ["number", "null"], description: "Maximum price in cents" },
              ticketsUrl: { type: ["string", "null"], description: "Ticket purchase URL" },
              organizer: { type: ["string", "null"], description: "Event organizer" },
              performer: { type: ["string", "null"], description: "Performer/artist name" },
              ageRestriction: { type: ["string", "null"], description: "Age restriction" },
              imageUrl: { type: ["string", "null"], description: "Main event image URL" },
              personaTags: { 
                type: "array", 
                items: { type: "string" },
                description: "Matching persona types" 
              },
              extractionConfidence: { 
                type: "number", 
                description: "Confidence score 0-1" 
              }
            },
            required: [
              "title", "description", "eventDate", "eventTime", "doorsOpenTime",
              "endDate", "endTime", "venueName", "venueAddress", "languageProfile",
              "interactionMode", "category", "price", "priceMinCents", "priceMaxCents",
              "ticketsUrl", "organizer", "performer", "ageRestriction", "imageUrl",
              "personaTags", "extractionConfidence"
            ],
            additionalProperties: false
          }
        }
      },
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const extracted = JSON.parse(data.choices[0].message.content);

  // Calculate data completeness
  const dataCompleteness = calculateCompleteness(extracted);

  return {
    ...extracted,
    coordinates: null, // Will be geocoded separately
    dataCompleteness,
  };
}

/**
 * Calculate data completeness score
 */
function calculateCompleteness(data: Partial<EnrichmentResult>): number {
  const weights: Record<string, number> = {
    // Social Five (higher weights)
    eventDate: 0.15,
    eventTime: 0.15,
    venueAddress: 0.15,
    endTime: 0.10,
    languageProfile: 0.05,
    interactionMode: 0.05,
    
    // Additional fields
    title: 0.10,
    description: 0.05,
    category: 0.05,
    price: 0.05,
    venueName: 0.05,
    imageUrl: 0.03,
    organizer: 0.02,
  };

  let score = 0;
  for (const [field, weight] of Object.entries(weights)) {
    const value = data[field as keyof EnrichmentResult];
    if (value !== null && value !== undefined && value !== '') {
      score += weight;
    }
  }

  return Math.min(score, 1);
}

/**
 * Classify event vibe for persona matching
 */
export async function classifyVibe(
  title: string,
  description: string,
  category: string | null
): Promise<VibeClassification> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Classify the vibe of this event for social matching.

Available persona types: ${PERSONA_TYPES.join(', ')}

Determine:
- Primary vibe (e.g., "energetic", "relaxed", "cultural", "festive")
- Social intensity (how much interaction is expected)
- Which personas would enjoy this event
- Who should be recommended this event`
        },
        {
          role: "user",
          content: `Title: ${title}\nDescription: ${description || 'N/A'}\nCategory: ${category || 'N/A'}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "vibe_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              primaryVibe: { type: "string", description: "Main vibe/atmosphere" },
              vibeScore: { type: "number", description: "Confidence 0-1" },
              suggestedPersonas: { 
                type: "array", 
                items: { type: "string" },
                description: "Matching persona types" 
              },
              socialIntensity: { 
                type: "string", 
                enum: ["low", "medium", "high"] 
              },
              recommendedFor: { 
                type: "array", 
                items: { type: "string" },
                description: "Target audience descriptions" 
              }
            },
            required: ["primaryVibe", "vibeScore", "suggestedPersonas", "socialIntensity", "recommendedFor"],
            additionalProperties: false
          }
        }
      },
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Infer category from text content using keywords
 */
export function inferCategory(title: string, description: string | null): string | null {
  const text = `${title} ${description || ''}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Apply enrichment results to a staging row
 */
export async function applyEnrichmentToStaging(
  supabase: ReturnType<typeof createClient>,
  stagingId: string,
  enrichment: EnrichmentResult
): Promise<void> {
  const { error } = await supabase
    .from('raw_event_staging')
    .update({
      title: enrichment.title,
      description: enrichment.description,
      event_date: enrichment.eventDate,
      event_time: enrichment.eventTime,
      doors_open_time: enrichment.doorsOpenTime,
      end_date: enrichment.endDate,
      end_time: enrichment.endTime,
      venue_name: enrichment.venueName,
      venue_address: enrichment.venueAddress,
      coordinates: enrichment.coordinates,
      language_profile: enrichment.languageProfile,
      interaction_mode: enrichment.interactionMode,
      category: enrichment.category,
      price: enrichment.price,
      price_min_cents: enrichment.priceMinCents,
      price_max_cents: enrichment.priceMaxCents,
      tickets_url: enrichment.ticketsUrl,
      organizer: enrichment.organizer,
      performer: enrichment.performer,
      age_restriction: enrichment.ageRestriction,
      image_url: enrichment.imageUrl,
      persona_tags: enrichment.personaTags,
      data_completeness: enrichment.dataCompleteness,
      quality_score: enrichment.extractionConfidence,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', stagingId);

  if (error) throw error;
}

/**
 * Queue enrichment job for later processing
 */
export async function queueEnrichmentJob(
  supabase: ReturnType<typeof createClient>,
  stagingId: string,
  html: string,
  url: string,
  priority: number = 100
): Promise<string> {
  const { data, error } = await supabase
    .from('ai_job_queue')
    .insert({
      job_type: 'enrich_social_five',
      related_id: stagingId,
      payload: { 
        html: html.slice(0, 50000), 
        url 
      },
      priority,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
