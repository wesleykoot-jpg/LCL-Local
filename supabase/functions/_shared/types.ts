export interface RawEventCard {
  title: string;
  date: string;
  location: string;
  description: string;
  detailUrl: string;
  imageUrl: string | null;
  rawHtml: string;
  categoryHint?: string;
  detailPageTime?: string;
}

/**
 * Structured date/time representation for events.
 * Stores dates in UTC for consistent handling across timezones.
 */
export interface StructuredDate {
  /** ISO 8601 string for the start time, in UTC */
  utc_start: string;
  /** ISO 8601 string for the end time (optional), in UTC */
  utc_end?: string;
  /** IANA timezone identifier (e.g., 'Europe/Amsterdam') */
  timezone?: string;
  /** Whether this is an all-day event */
  all_day?: boolean;
}

/**
 * Structured location representation for events.
 * Stores both human-readable name and machine-readable coordinates.
 */
export interface StructuredLocation {
  /** Human-readable location/venue name */
  name: string;
  /** Geographic coordinates */
  coordinates?: {
    lat: number;
    lng: number;
  };
  /** Full address if available */
  address?: string;
  /** Reference to a venue ID if stored separately */
  venue_id?: string;
}

/**
 * Enriched event ready for database insertion.
 * Contains both structured and legacy fields for backward compatibility.
 */
export interface EnrichedEvent {
  title: string;
  description: string;
  category: string;
  event_type: string;
  venue_name: string;
  location: string; // Legacy: POINT(lng lat) format
  event_date: string; // Legacy: ISO timestamp
  event_time: string; // Legacy: HH:MM or descriptive string
  image_url: string | null;
  created_by: string | null;
  status: string;
  source_id: string;
  event_fingerprint: string;
  structured_date?: StructuredDate;
  structured_location?: StructuredLocation;
  organizer?: string;
}

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  requires_render?: boolean;
  last_probe_urls?: Record<string, unknown>;
  language?: string;
  country?: string;
  default_coordinates?: { lat: number; lng: number };
  config: {
    selectors?: string[];
    headers?: Record<string, string>;
    rate_limit_ms?: number;
    default_coordinates?: { lat: number; lng: number };
    language?: string;
    country?: string;
    dynamic_year?: boolean;
    discoveryAnchors?: string[];
    alternatePaths?: string[];
    requires_render?: boolean;
  };
}