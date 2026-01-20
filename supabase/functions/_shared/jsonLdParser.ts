/**
 * JSON-LD Parser for Schema.org Events
 * 
 * Extracts and validates structured event data from HTML.
 * Used for deterministic parsing without AI.
 * 
 * @module _shared/jsonLdParser
 */

import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import type { NormalizedEvent } from "./types.ts";

// Valid Schema.org Event types
const VALID_EVENT_TYPES = [
  'Event', 'SportsEvent', 'MusicEvent', 'Festival', 'TheaterEvent',
  'DanceEvent', 'ComedyEvent', 'ExhibitionEvent', 'SocialEvent',
  'BusinessEvent', 'EducationEvent', 'FoodEvent', 'ScreeningEvent',
];

export interface JsonLdEvent {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  venue_name: string;
  image_url: string | null;
  category?: string;
}

/**
 * Extracts Schema.org Event data from JSON-LD blocks in HTML.
 * Returns null if no valid events found or data is incomplete.
 */
export function extractJsonLdEvents(html: string): JsonLdEvent[] | null {
  if (!html) return null;
  
  const $ = cheerio.load(html);
  const events: JsonLdEvent[] = [];
  
  $('script[type="application/ld+json"]').each((_, script) => {
    const content = $(script).html();
    if (!content) return;
    
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch {
      // Try soft repair for common issues
      try {
        const cleaned = content
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/'/g, '"');
        data = JSON.parse(cleaned);
      } catch {
        return; // Skip malformed JSON
      }
    }
    
    // Handle both single objects and arrays
    const items = Array.isArray(data) ? data : [data];
    
    for (const item of items) {
      // Handle @graph structure
      if (item && typeof item === 'object' && '@graph' in item) {
        const graphItems = (item as { '@graph': unknown[] })['@graph'];
        if (Array.isArray(graphItems)) {
          items.push(...graphItems);
        }
        continue;
      }
      
      const event = parseSchemaOrgEvent(item);
      if (event) events.push(event);
    }
  });
  
  return events.length > 0 ? events : null;
}

/**
 * Parses a single Schema.org Event object into our format.
 */
function parseSchemaOrgEvent(obj: unknown): JsonLdEvent | null {
  if (!obj || typeof obj !== 'object') return null;
  
  const item = obj as Record<string, unknown>;
  
  // Check if valid event type
  const type = item['@type'];
  if (!type) return null;
  const types = Array.isArray(type) ? type : [type];
  if (!types.some(t => VALID_EVENT_TYPES.includes(String(t)))) return null;
  
  // Extract required fields
  const title = getStringValue(item['name']) || getStringValue(item['headline']);
  if (!title) return null;
  
  // Extract date
  let eventDate = '';
  let eventTime = 'TBD';
  
  if (item['startDate']) {
    const startStr = getStringValue(item['startDate']);
    const parsed = parseIsoDateTime(startStr);
    if (parsed) {
      eventDate = parsed.date;
      eventTime = parsed.time || 'TBD';
    }
  }
  
  if (!eventDate) return null; // Date is required
  
  // Extract location
  let venueName = '';
  if (item['location']) {
    const loc = item['location'];
    if (typeof loc === 'string') {
      venueName = loc;
    } else if (typeof loc === 'object' && loc !== null) {
      const locObj = loc as Record<string, unknown>;
      venueName = getStringValue(locObj['name']) || getStringValue(locObj['address']) || '';
    }
  }
  
  // Extract image
  let imageUrl: string | null = null;
  if (item['image']) {
    const img = item['image'];
    if (typeof img === 'string') {
      imageUrl = img;
    } else if (Array.isArray(img) && img.length > 0) {
      imageUrl = typeof img[0] === 'string' ? img[0] : getStringValue(img[0]);
    } else if (typeof img === 'object' && img !== null) {
      imageUrl = getStringValue((img as Record<string, unknown>)['url']);
    }
  }
  
  // Infer category from type
  const category = inferCategory(types[0] as string);
  
  return {
    title,
    description: getStringValue(item['description']) || '',
    event_date: eventDate,
    event_time: eventTime,
    venue_name: venueName,
    image_url: imageUrl,
    category,
  };
}

function getStringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return String(obj['@value'] || obj['name'] || obj['text'] || '').trim();
  }
  return '';
}

function parseIsoDateTime(str: string): { date: string; time: string | null } | null {
  if (!str) return null;
  
  // ISO 8601: 2025-01-20T19:30:00+01:00
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return null;
  
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  const time = match[4] && match[5] ? `${match[4]}:${match[5]}` : null;
  
  return { date, time };
}

function inferCategory(type: string): string {
  switch (type) {
    case 'MusicEvent': return 'music';
    case 'SportsEvent': return 'active';
    case 'TheaterEvent': return 'entertainment';
    case 'DanceEvent': return 'entertainment';
    case 'ComedyEvent': return 'entertainment';
    case 'FoodEvent': return 'foodie';
    case 'Festival': return 'community';
    case 'ExhibitionEvent': return 'entertainment';
    case 'SocialEvent': return 'social';
    case 'EducationEvent': return 'workshops';
    default: return 'community';
  }
}

/**
 * Checks if JSON-LD data is complete enough for deterministic parsing.
 */
export function isJsonLdComplete(event: JsonLdEvent): boolean {
  return !!(event.title && event.event_date);
}

/**
 * Converts JsonLdEvent to NormalizedEvent format.
 */
export function jsonLdToNormalized(event: JsonLdEvent): NormalizedEvent {
  return {
    title: event.title,
    description: event.description,
    event_date: event.event_date,
    event_time: event.event_time,
    image_url: event.image_url,
    venue_name: event.venue_name,
    internal_category: event.category as any || 'community',
  };
}
