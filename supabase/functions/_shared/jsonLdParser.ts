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

/**
 * Enhanced JSON-LD Event interface with additional Schema.org fields
 * for improved data quality and completeness.
 */
export interface JsonLdEvent {
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  venue_name: string;
  venue_address?: string;
  image_url: string | null;
  category?: string;
  // Enhanced fields for data quality
  end_date?: string;
  end_time?: string;
  price?: string;
  price_currency?: string;
  price_min?: number;
  price_max?: number;
  tickets_url?: string;
  organizer?: string;
  organizer_url?: string;
  performer?: string;
  event_status?: 'scheduled' | 'cancelled' | 'postponed' | 'rescheduled';
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
 * Enhanced to extract additional fields for improved data quality.
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
  
  // Extract start date/time
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
  
  // Extract end date/time
  let endDate: string | undefined;
  let endTime: string | undefined;
  if (item['endDate']) {
    const endStr = getStringValue(item['endDate']);
    const parsed = parseIsoDateTime(endStr);
    if (parsed) {
      endDate = parsed.date;
      endTime = parsed.time || undefined;
    }
  }
  
  // Extract location
  let venueName = '';
  let venueAddress: string | undefined;
  if (item['location']) {
    const loc = item['location'];
    if (typeof loc === 'string') {
      venueName = loc;
    } else if (typeof loc === 'object' && loc !== null) {
      const locObj = loc as Record<string, unknown>;
      venueName = getStringValue(locObj['name']) || '';
      
      // Extract address from PostalAddress schema
      if (locObj['address']) {
        const addr = locObj['address'];
        if (typeof addr === 'string') {
          venueAddress = addr;
        } else if (typeof addr === 'object' && addr !== null) {
          const addrObj = addr as Record<string, unknown>;
          const parts = [
            getStringValue(addrObj['streetAddress']),
            getStringValue(addrObj['addressLocality']),
            getStringValue(addrObj['postalCode']),
            getStringValue(addrObj['addressCountry']),
          ].filter(Boolean);
          venueAddress = parts.join(', ');
        }
      }
      
      // Fallback if no name but has address
      if (!venueName && venueAddress) {
        venueName = venueAddress;
      }
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
  
  // Extract pricing from offers
  let price: string | undefined;
  let priceCurrency: string | undefined;
  let priceMin: number | undefined;
  let priceMax: number | undefined;
  let ticketsUrl: string | undefined;
  
  if (item['offers']) {
    const offers = item['offers'];
    const offersList = Array.isArray(offers) ? offers : [offers];
    
    for (const offer of offersList) {
      if (typeof offer !== 'object' || !offer) continue;
      const offerObj = offer as Record<string, unknown>;
      
      // Extract price
      if (offerObj['price'] !== undefined) {
        const priceVal = offerObj['price'];
        if (typeof priceVal === 'number') {
          priceMin = priceMin === undefined ? priceVal * 100 : Math.min(priceMin, priceVal * 100);
          priceMax = priceMax === undefined ? priceVal * 100 : Math.max(priceMax, priceVal * 100);
        } else if (typeof priceVal === 'string') {
          const parsed = parseFloat(priceVal.replace(/[^0-9.,]/g, '').replace(',', '.'));
          if (!isNaN(parsed)) {
            priceMin = priceMin === undefined ? parsed * 100 : Math.min(priceMin, parsed * 100);
            priceMax = priceMax === undefined ? parsed * 100 : Math.max(priceMax, parsed * 100);
          }
        }
      }
      
      // Extract low/high price for ranges
      if (offerObj['lowPrice'] !== undefined) {
        const low = parseFloat(String(offerObj['lowPrice']).replace(',', '.'));
        if (!isNaN(low)) priceMin = low * 100;
      }
      if (offerObj['highPrice'] !== undefined) {
        const high = parseFloat(String(offerObj['highPrice']).replace(',', '.'));
        if (!isNaN(high)) priceMax = high * 100;
      }
      
      // Extract currency
      if (offerObj['priceCurrency']) {
        priceCurrency = getStringValue(offerObj['priceCurrency']);
      }
      
      // Extract ticket URL
      if (offerObj['url']) {
        ticketsUrl = getStringValue(offerObj['url']);
      }
    }
    
    // Format price string
    if (priceMin !== undefined || priceMax !== undefined) {
      const currency = priceCurrency || 'EUR';
      const symbol = currency === 'EUR' ? '€' : currency;
      if (priceMin === 0 && (priceMax === 0 || priceMax === undefined)) {
        price = 'Gratis';
      } else if (priceMin !== undefined && priceMax !== undefined && priceMin !== priceMax) {
        price = `${symbol}${(priceMin / 100).toFixed(2)} - ${symbol}${(priceMax / 100).toFixed(2)}`;
      } else if (priceMin !== undefined) {
        price = `${symbol}${(priceMin / 100).toFixed(2)}`;
      }
    }
  }
  
  // Check for isAccessibleForFree
  if (item['isAccessibleForFree'] === true) {
    price = 'Gratis';
    priceMin = 0;
    priceMax = 0;
  }
  
  // Extract organizer
  let organizer: string | undefined;
  let organizerUrl: string | undefined;
  if (item['organizer']) {
    const org = item['organizer'];
    if (typeof org === 'string') {
      organizer = org;
    } else if (typeof org === 'object' && org !== null) {
      const orgObj = org as Record<string, unknown>;
      organizer = getStringValue(orgObj['name']);
      organizerUrl = getStringValue(orgObj['url']);
    }
  }
  
  // Extract performer
  let performer: string | undefined;
  if (item['performer']) {
    const perf = item['performer'];
    if (typeof perf === 'string') {
      performer = perf;
    } else if (Array.isArray(perf) && perf.length > 0) {
      const first = perf[0];
      performer = typeof first === 'string' ? first : getStringValue(first);
    } else if (typeof perf === 'object' && perf !== null) {
      performer = getStringValue((perf as Record<string, unknown>)['name']);
    }
  }
  
  // Extract event status
  let eventStatus: JsonLdEvent['event_status'];
  if (item['eventStatus']) {
    const status = getStringValue(item['eventStatus']).toLowerCase();
    if (status.includes('cancelled')) eventStatus = 'cancelled';
    else if (status.includes('postponed')) eventStatus = 'postponed';
    else if (status.includes('rescheduled')) eventStatus = 'rescheduled';
    else eventStatus = 'scheduled';
  }
  
  // Infer category from type
  const category = inferCategory(types[0] as string);
  
  return {
    title,
    description: getStringValue(item['description']) || '',
    event_date: eventDate,
    event_time: eventTime,
    venue_name: venueName,
    venue_address: venueAddress,
    image_url: imageUrl,
    category,
    end_date: endDate,
    end_time: endTime,
    price,
    price_currency: priceCurrency,
    price_min: priceMin,
    price_max: priceMax,
    tickets_url: ticketsUrl,
    organizer,
    organizer_url: organizerUrl,
    performer,
    event_status: eventStatus,
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
 * Returns true if we have at least title and date.
 */
export function isJsonLdComplete(event: JsonLdEvent): boolean {
  return !!(event.title && event.event_date);
}

/**
 * Calculates data completeness score for a JSON-LD event.
 * Returns a score from 0 to 1 indicating how complete the data is.
 */
export function calculateJsonLdCompleteness(event: JsonLdEvent): number {
  let score = 0;
  const weights = {
    title: 0.15,
    description: 0.10,
    event_date: 0.10,
    event_time: 0.05,
    venue_name: 0.10,
    venue_address: 0.05,
    image_url: 0.10,
    end_time: 0.05,
    price: 0.10,
    tickets_url: 0.05,
    organizer: 0.05,
    performer: 0.05,
    category: 0.05,
  };
  
  if (event.title) score += weights.title;
  if (event.description && event.description.length > 50) score += weights.description;
  if (event.event_date) score += weights.event_date;
  if (event.event_time && event.event_time !== 'TBD') score += weights.event_time;
  if (event.venue_name) score += weights.venue_name;
  if (event.venue_address) score += weights.venue_address;
  if (event.image_url) score += weights.image_url;
  if (event.end_time) score += weights.end_time;
  if (event.price) score += weights.price;
  if (event.tickets_url) score += weights.tickets_url;
  if (event.organizer) score += weights.organizer;
  if (event.performer) score += weights.performer;
  if (event.category) score += weights.category;
  
  return Math.min(score, 1);
}

/**
 * Converts JsonLdEvent to NormalizedEvent format.
 * Enhanced to include all additional fields for improved data quality.
 */
export function jsonLdToNormalized(event: JsonLdEvent): NormalizedEvent {
  const completeness = calculateJsonLdCompleteness(event);
  
  return {
    title: event.title,
    description: event.description,
    event_date: event.event_date,
    event_time: event.event_time,
    image_url: event.image_url,
    venue_name: event.venue_name,
    venue_address: event.venue_address,
    category: (event.category?.toUpperCase() || 'COMMUNITY') as any,
    // Enhanced fields
    end_date: event.end_date,
    end_time: event.end_time,
    price: event.price,
    price_currency: event.price_currency,
    price_min: event.price_min,
    price_max: event.price_max,
    tickets_url: event.tickets_url,
    organizer: event.organizer,
    organizer_url: event.organizer_url,
    performer: event.performer,
    event_status: event.event_status,
    data_completeness: completeness,
    data_source: 'detail',  // JSON-LD typically comes from detail pages
  };
}
