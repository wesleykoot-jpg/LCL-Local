/**
 * Tests for Scraper Configuration
 * 
 * Tests for venue registry lookup and cron schedule parsing
 */
import { describe, it, expect } from 'vitest';

// ============================================================================
// VENUE REGISTRY (copied from config.ts for testing)
// ============================================================================

interface VenueInfo {
  name: string;
  city: string;
  address?: string;
  coordinates: { lat: number; lng: number };
  google_place_id?: string;
}

const VENUE_REGISTRY: Record<string, VenueInfo> = {
  "paradiso": {
    name: "Paradiso",
    city: "Amsterdam",
    address: "Weteringschans 6-8, 1017 SG Amsterdam",
    coordinates: { lat: 52.3622, lng: 4.8834 },
  },
  "ziggo_dome": {
    name: "Ziggo Dome",
    city: "Amsterdam",
    address: "De Passage 100, 1101 AX Amsterdam",
    coordinates: { lat: 52.3136, lng: 4.9377 },
  },
  "tivolivredenburg": {
    name: "TivoliVredenburg",
    city: "Utrecht",
    address: "Vredenburgkade 11, 3511 WC Utrecht",
    coordinates: { lat: 52.0928, lng: 5.1134 },
  },
  "de_school": {
    name: "De School",
    city: "Amsterdam",
    coordinates: { lat: 52.3672, lng: 4.8521 },
  },
  "concertgebouw": {
    name: "Concertgebouw",
    city: "Amsterdam",
    coordinates: { lat: 52.3561, lng: 4.8792 },
  },
  "johan_cruijff_arena": {
    name: "Johan Cruijff ArenA",
    city: "Amsterdam",
    coordinates: { lat: 52.3141, lng: 4.9419 },
  },
};

function lookupVenue(name: string): VenueInfo | null {
  const normalized = name.toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_");
  
  if (VENUE_REGISTRY[normalized]) {
    return VENUE_REGISTRY[normalized];
  }
  
  for (const [key, venue] of Object.entries(VENUE_REGISTRY)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return venue;
    }
  }
  
  return null;
}

function inferCityFromVenue(venueName: string): string | null {
  const lower = venueName.toLowerCase();
  
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
  
  const venue = lookupVenue(venueName);
  if (venue) {
    return venue.city;
  }
  
  return null;
}

function shouldRunNow(cronExpression: string, now: Date = new Date()): boolean {
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

// ============================================================================
// TESTS
// ============================================================================

describe('Scraper Configuration', () => {
  describe('lookupVenue', () => {
    it('should find Paradiso by exact name', () => {
      const venue = lookupVenue('paradiso');
      expect(venue).not.toBeNull();
      expect(venue?.name).toBe('Paradiso');
      expect(venue?.city).toBe('Amsterdam');
    });

    it('should find Ziggo Dome with underscore', () => {
      const venue = lookupVenue('ziggo_dome');
      expect(venue).not.toBeNull();
      expect(venue?.name).toBe('Ziggo Dome');
    });

    it('should find venue by partial match', () => {
      const venue = lookupVenue('paradiso amsterdam');
      expect(venue).not.toBeNull();
      expect(venue?.name).toBe('Paradiso');
    });

    it('should find TivoliVredenburg in Utrecht', () => {
      const venue = lookupVenue('tivolivredenburg');
      expect(venue).not.toBeNull();
      expect(venue?.city).toBe('Utrecht');
    });

    it('should return null for unknown venue', () => {
      const venue = lookupVenue('unknown venue');
      expect(venue).toBeNull();
    });

    it('should handle special characters', () => {
      const venue = lookupVenue('Paradiso!');
      expect(venue).not.toBeNull();
      expect(venue?.name).toBe('Paradiso');
    });
  });

  describe('inferCityFromVenue', () => {
    it('should infer city from venue registry', () => {
      expect(inferCityFromVenue('Paradiso')).toBe('Amsterdam');
      expect(inferCityFromVenue('TivoliVredenburg')).toBe('Utrecht');
    });

    it('should infer city from stadium pattern "Stadion X"', () => {
      const city = inferCityFromVenue('Stadion Rotterdam');
      expect(city).toBe('Rotterdam');
    });

    it('should infer city from stadium pattern "X Stadium"', () => {
      const city = inferCityFromVenue('Amsterdam Stadium');
      expect(city).toBe('Amsterdam');
    });

    it('should return null for unknown venue', () => {
      expect(inferCityFromVenue('Random Place')).toBeNull();
    });
  });

  describe('shouldRunNow', () => {
    it('should match exact time', () => {
      const now = new Date('2026-01-17T06:00:00');
      expect(shouldRunNow('0 6 * * *', now)).toBe(true);
    });

    it('should not match different hour', () => {
      const now = new Date('2026-01-17T07:00:00');
      expect(shouldRunNow('0 6 * * *', now)).toBe(false);
    });

    it('should match wildcard minute', () => {
      const now = new Date('2026-01-17T06:30:00');
      expect(shouldRunNow('* 6 * * *', now)).toBe(true);
    });

    it('should match interval pattern */6', () => {
      const now1 = new Date('2026-01-17T06:00:00');
      const now2 = new Date('2026-01-17T12:00:00');
      const now3 = new Date('2026-01-17T05:00:00');
      
      expect(shouldRunNow('0 */6 * * *', now1)).toBe(true);
      expect(shouldRunNow('0 */6 * * *', now2)).toBe(true);
      expect(shouldRunNow('0 */6 * * *', now3)).toBe(false);
    });

    it('should match specific day of week (Monday = 1)', () => {
      const monday = new Date('2026-01-19T03:00:00'); // Monday
      const tuesday = new Date('2026-01-20T03:00:00'); // Tuesday
      
      expect(shouldRunNow('0 3 * * 1', monday)).toBe(true);
      expect(shouldRunNow('0 3 * * 1', tuesday)).toBe(false);
    });

    it('should reject invalid cron expression', () => {
      const now = new Date();
      expect(shouldRunNow('invalid', now)).toBe(false);
      expect(shouldRunNow('0 6 *', now)).toBe(false);
    });
  });
});

describe('Venue Registry Coverage', () => {
  it('should have all required Amsterdam venues', () => {
    const amsterdamVenues = ['paradiso', 'ziggo_dome', 'de_school', 'concertgebouw'];
    
    for (const venue of amsterdamVenues) {
      const info = VENUE_REGISTRY[venue];
      expect(info).toBeDefined();
      expect(info.city).toBe('Amsterdam');
    }
  });

  it('should have valid coordinates for all venues', () => {
    for (const [key, venue] of Object.entries(VENUE_REGISTRY)) {
      expect(venue.coordinates).toBeDefined();
      expect(venue.coordinates.lat).toBeGreaterThan(50);
      expect(venue.coordinates.lat).toBeLessThan(54);
      expect(venue.coordinates.lng).toBeGreaterThan(3);
      expect(venue.coordinates.lng).toBeLessThan(8);
    }
  });

  it('should have at least one sports stadium', () => {
    const stadium = VENUE_REGISTRY['johan_cruijff_arena'];
    expect(stadium).toBeDefined();
    expect(stadium.name.toLowerCase()).toContain('arena');
  });
});
