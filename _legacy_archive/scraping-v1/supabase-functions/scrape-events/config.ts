/**
 * Scraper Configuration - Targets and Schedules
 * 
 * Centralized configuration for all scraper strategies including
 * target URLs, cron schedules, and strategy-specific settings.
 * 
 * @module config
 */

import type { ScraperConfig, TimeMode } from "./strategies/base.ts";

// ============================================================================
// CRON SCHEDULE DEFINITIONS
// ============================================================================

/**
 * Cron schedule constants for readability
 * Format: minute hour day-of-month month day-of-week
 */
export const SCHEDULES = {
  /** Every day at 6:00 AM */
  DAILY_MORNING: "0 6 * * *",
  /** Every day at midnight */
  DAILY_MIDNIGHT: "0 0 * * *",
  /** Every Monday at 3:00 AM */
  WEEKLY_MONDAY: "0 3 * * 1",
  /** Every 6 hours */
  EVERY_6_HOURS: "0 */6 * * *",
  /** Every 12 hours */
  EVERY_12_HOURS: "0 */12 * * *",
  /** Every hour */
  HOURLY: "0 * * * *",
} as const;

// ============================================================================
// VENUE REGISTRY
// ============================================================================

/**
 * Known venues with pre-populated location data
 * Helps skip enrichment costs for well-known venues
 */
export interface VenueInfo {
  name: string;
  city: string;
  address?: string;
  coordinates: { lat: number; lng: number };
  google_place_id?: string;
}

export const VENUE_REGISTRY: Record<string, VenueInfo> = {
  // Amsterdam Concert Venues
  "paradiso": {
    name: "Paradiso",
    city: "Amsterdam",
    address: "Weteringschans 6-8, 1017 SG Amsterdam",
    coordinates: { lat: 52.3622, lng: 4.8834 },
    google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4",
  },
  "ziggo_dome": {
    name: "Ziggo Dome",
    city: "Amsterdam",
    address: "De Passage 100, 1101 AX Amsterdam",
    coordinates: { lat: 52.3136, lng: 4.9377 },
    google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY5",
  },
  "melkweg": {
    name: "Melkweg",
    city: "Amsterdam",
    address: "Lijnbaansgracht 234A, 1017 PH Amsterdam",
    coordinates: { lat: 52.3649, lng: 4.8819 },
  },
  "afas_live": {
    name: "AFAS Live",
    city: "Amsterdam",
    address: "ArenA Boulevard 590, 1101 DS Amsterdam",
    coordinates: { lat: 52.3127, lng: 4.9427 },
  },
  
  // Utrecht Venues
  "tivolivredenburg": {
    name: "TivoliVredenburg",
    city: "Utrecht",
    address: "Vredenburgkade 11, 3511 WC Utrecht",
    coordinates: { lat: 52.0928, lng: 5.1134 },
  },
  
  // Rotterdam Venues
  "ahoy": {
    name: "Rotterdam Ahoy",
    city: "Rotterdam",
    address: "Ahoyweg 10, 3084 BA Rotterdam",
    coordinates: { lat: 51.8889, lng: 4.4873 },
  },
  
  // Amsterdam Clubs
  "de_school": {
    name: "De School",
    city: "Amsterdam",
    address: "Doctor Jan van Breemenstraat 1, 1056 AB Amsterdam",
    coordinates: { lat: 52.3672, lng: 4.8521 },
  },
  "shelter": {
    name: "Shelter",
    city: "Amsterdam",
    address: "Overhoeksplein 3, 1031 KS Amsterdam",
    coordinates: { lat: 52.3908, lng: 4.9023 },
  },
  "de_marktkantine": {
    name: "De Marktkantine",
    city: "Amsterdam",
    address: "Jan van Galenstraat 6, 1051 KM Amsterdam",
    coordinates: { lat: 52.3743, lng: 4.8572 },
  },
  
  // Classical Music
  "concertgebouw": {
    name: "Concertgebouw",
    city: "Amsterdam",
    address: "Concertgebouwplein 10, 1071 LN Amsterdam",
    coordinates: { lat: 52.3561, lng: 4.8792 },
  },
  
  // Theaters
  "carre": {
    name: "Theater Carré",
    city: "Amsterdam",
    address: "Amstel 115-125, 1018 EM Amsterdam",
    coordinates: { lat: 52.3623, lng: 4.9031 },
  },
  
  // Sports Stadiums
  "johan_cruijff_arena": {
    name: "Johan Cruijff ArenA",
    city: "Amsterdam",
    address: "ArenA Boulevard 1, 1101 AX Amsterdam",
    coordinates: { lat: 52.3141, lng: 4.9419 },
  },
  "de_kuip": {
    name: "Stadion Feijenoord (De Kuip)",
    city: "Rotterdam",
    address: "Van Zandvlietplein 3, 3077 AA Rotterdam",
    coordinates: { lat: 51.8938, lng: 4.5236 },
  },
  "philips_stadion": {
    name: "Philips Stadion",
    city: "Eindhoven",
    address: "Frederiklaan 10A, 5616 NH Eindhoven",
    coordinates: { lat: 51.4414, lng: 5.4677 },
  },
};

/**
 * Lookup venue by name (case-insensitive, fuzzy matching)
 */
export function lookupVenue(name: string): VenueInfo | null {
  const normalized = name.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
  
  // Direct match
  if (VENUE_REGISTRY[normalized]) {
    return VENUE_REGISTRY[normalized];
  }
  
  // Partial match
  for (const [key, venue] of Object.entries(VENUE_REGISTRY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return venue;
    }
  }
  
  return null;
}

/**
 * Infer city from venue/stadium name using common Dutch patterns
 */
export function inferCityFromVenue(venueName: string): string | null {
  const lower = venueName.toLowerCase();
  
  // Common stadium patterns: "Stadion [City]" or "[City] Stadium"
  const stadiumPatterns = [
    /(?:stadion|stadium)\s+(\w+)/i,
    /(\w+)\s+(?:stadion|stadium)/i,
  ];
  
  for (const pattern of stadiumPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const city = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      return city;
    }
  }
  
  // Check venue registry
  const venue = lookupVenue(venueName);
  if (venue) {
    return venue.city;
  }
  
  return null;
}

// ============================================================================
// STRATEGY CONFIGURATIONS
// ============================================================================

/**
 * Sports Scraper Configuration
 */
export const SPORTS_CONFIG: ScraperConfig = {
  name: "sports",
  url: "https://eredivisie.nl",
  schedule: SCHEDULES.WEEKLY_MONDAY,
  enabled: true,
  category: "active",
  defaultTimeMode: "fixed",
  rateLimitMs: 2000,
};

export const SPORTS_TARGETS = {
  eredivisie: {
    name: "Eredivisie",
    url: "https://eredivisie.nl/programma",
    league: "Eredivisie",
    matchDurationMinutes: 105, // 90 + halftime
  },
  keuken_kampioen: {
    name: "Keuken Kampioen Divisie",
    url: "https://keukenkampioendivisie.nl/programma",
    league: "Keuken Kampioen Divisie",
    matchDurationMinutes: 105,
  },
};

/**
 * Music Scraper Configuration
 */
export const MUSIC_CONFIG: ScraperConfig = {
  name: "music",
  url: "https://paradiso.nl",
  schedule: SCHEDULES.DAILY_MORNING,
  enabled: true,
  category: "music",
  defaultTimeMode: "fixed",
  rateLimitMs: 1500,
};

export const MUSIC_TARGETS = {
  paradiso: {
    name: "Paradiso",
    url: "https://paradiso.nl/agenda",
    venueKey: "paradiso",
  },
  ziggo_dome: {
    name: "Ziggo Dome",
    url: "https://ziggodome.nl/agenda",
    venueKey: "ziggo_dome",
  },
  tivolivredenburg: {
    name: "TivoliVredenburg",
    url: "https://tivolivredenburg.nl/agenda",
    venueKey: "tivolivredenburg",
  },
  melkweg: {
    name: "Melkweg",
    url: "https://melkweg.nl/agenda",
    venueKey: "melkweg",
  },
  afas_live: {
    name: "AFAS Live",
    url: "https://afaslive.nl/agenda",
    venueKey: "afas_live",
  },
};

/**
 * Nightlife Scraper Configuration
 */
export const NIGHTLIFE_CONFIG: ScraperConfig = {
  name: "nightlife",
  url: "https://ra.co",
  schedule: SCHEDULES.DAILY_MORNING,
  enabled: true,
  category: "music",
  defaultTimeMode: "fixed",
  rateLimitMs: 3000, // More conservative for RA
};

export const NIGHTLIFE_TARGETS = {
  resident_advisor_amsterdam: {
    name: "Resident Advisor - Amsterdam",
    url: "https://ra.co/events/nl/amsterdam",
    type: "aggregator",
    defaultEndTime: "06:00", // Default closing time
    defaultDurationHours: 6,
  },
  de_school: {
    name: "De School",
    url: "https://deschoolamsterdam.nl/programma",
    venueKey: "de_school",
    defaultEndTime: "06:00",
  },
  shelter: {
    name: "Shelter",
    url: "https://shelteramsterdam.nl/events",
    venueKey: "shelter",
    defaultEndTime: "06:00",
  },
  de_marktkantine: {
    name: "De Marktkantine",
    url: "https://marktkantine.nl/programma",
    venueKey: "de_marktkantine",
    defaultEndTime: "05:00",
  },
};

/**
 * Culture Scraper Configuration
 */
export const CULTURE_CONFIG: ScraperConfig = {
  name: "culture",
  url: "https://concertgebouw.nl",
  schedule: SCHEDULES.DAILY_MORNING,
  enabled: true,
  category: "entertainment",
  defaultTimeMode: "fixed",
  rateLimitMs: 1500,
};

export const CULTURE_TARGETS = {
  concertgebouw: {
    name: "Concertgebouw",
    url: "https://concertgebouw.nl/agenda",
    venueKey: "concertgebouw",
    category: "music", // Classical music is still music
  },
  carre: {
    name: "Theater Carré",
    url: "https://carre.nl/agenda",
    venueKey: "carre",
    category: "entertainment",
  },
  pathe_specials: {
    name: "Pathé Specials",
    url: "https://pathe.nl/specials",
    category: "entertainment",
    filterMode: "specials_only", // Only scrape special screenings
  },
};

/**
 * Dining Scraper Configuration
 */
export const DINING_CONFIG: ScraperConfig = {
  name: "dining",
  url: "https://iens.nl",
  schedule: SCHEDULES.WEEKLY_MONDAY,
  enabled: true,
  category: "foodie",
  defaultTimeMode: "window", // Restaurants use opening hours, not fixed times
  rateLimitMs: 2000,
};

export const DINING_TARGETS = {
  misset_horeca: {
    name: "Misset Horeca - New Openings",
    url: "https://missethoreca.nl/nieuws/opening-restaurants",
    listType: "new_openings",
  },
  iens_top: {
    name: "Iens Top Lists",
    url: "https://iens.nl/top-restaurants",
    listType: "curated_list",
  },
};

// ============================================================================
// ALL STRATEGIES EXPORT
// ============================================================================

export const ALL_STRATEGIES = {
  sports: {
    config: SPORTS_CONFIG,
    targets: SPORTS_TARGETS,
  },
  music: {
    config: MUSIC_CONFIG,
    targets: MUSIC_TARGETS,
  },
  nightlife: {
    config: NIGHTLIFE_CONFIG,
    targets: NIGHTLIFE_TARGETS,
  },
  culture: {
    config: CULTURE_CONFIG,
    targets: CULTURE_TARGETS,
  },
  dining: {
    config: DINING_CONFIG,
    targets: DINING_TARGETS,
  },
};

/**
 * Get all enabled strategies
 */
export function getEnabledStrategies(): string[] {
  return Object.entries(ALL_STRATEGIES)
    .filter(([_, strategy]) => strategy.config.enabled)
    .map(([name, _]) => name);
}

/**
 * Parse cron expression and check if it matches current time
 * Simple implementation for basic cron patterns
 */
export function shouldRunNow(cronExpression: string, now: Date = new Date()): boolean {
  const parts = cronExpression.split(" ");
  if (parts.length !== 5) return false;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const matches = (pattern: string, value: number): boolean => {
    if (pattern === "*") return true;
    if (pattern.startsWith("*/")) {
      const interval = parseInt(pattern.slice(2), 10);
      return value % interval === 0;
    }
    return parseInt(pattern, 10) === value;
  };

  return (
    matches(minute, now.getMinutes()) &&
    matches(hour, now.getHours()) &&
    matches(dayOfMonth, now.getDate()) &&
    matches(month, now.getMonth() + 1) &&
    matches(dayOfWeek, now.getDay())
  );
}
