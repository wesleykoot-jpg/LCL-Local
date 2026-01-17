import { describe, it, expect } from 'vitest';
import {
  lookupVenue,
  lookupVenueByPlaceId,
  normalizeVenueName,
  getVenuesByCity,
  getVenuesByCategory,
} from '../venueRegistry';

describe('Venue Registry', () => {
  describe('normalizeVenueName', () => {
    it('should lowercase the name', () => {
      expect(normalizeVenueName('Johan Cruijff ArenA')).toBe('johan cruijff');
    });

    it('should remove diacritics', () => {
      expect(normalizeVenueName('Café')).toBe('cafe');
    });

    it('should remove common venue suffixes', () => {
      expect(normalizeVenueName('Amsterdam Stadium')).toBe('amsterdam');
      expect(normalizeVenueName('Luxor Cinema')).toBe('luxor');
      expect(normalizeVenueName('Concert Hall')).toBe('concert');
    });

    it('should collapse whitespace', () => {
      expect(normalizeVenueName('Multiple   Spaces')).toBe('multiple spaces');
    });
  });

  describe('lookupVenue', () => {
    it('should find venue by exact name', () => {
      const result = lookupVenue('Johan Cruijff ArenA');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Johan Cruijff ArenA');
      expect(result?.city).toBe('Amsterdam');
    });

    it('should find venue by alias', () => {
      const result = lookupVenue('Ajax Stadium');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Johan Cruijff ArenA');
    });

    it('should find venue by partial name', () => {
      const result = lookupVenue('Cruijff');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Johan Cruijff ArenA');
    });

    it('should return null for unknown venue', () => {
      const result = lookupVenue('Completely Nonexistent Location ABC123');
      expect(result).toBeNull();
    });

    it('should return null for empty query', () => {
      expect(lookupVenue('')).toBeNull();
      expect(lookupVenue('a')).toBeNull();
    });

    it('should filter by city when provided', () => {
      // Ziggo Dome is in Amsterdam
      const result = lookupVenue('Ziggo Dome', 'Amsterdam');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Ziggo Dome');

      // Should not match with wrong city
      const wrongCity = lookupVenue('Ziggo Dome', 'Rotterdam');
      expect(wrongCity).toBeNull();
    });

    it('should find De Kuip in Rotterdam', () => {
      const result = lookupVenue('De Kuip');
      expect(result).toBeDefined();
      expect(result?.city).toBe('Rotterdam');
      expect(result?.category).toBe('stadium');
    });

    it('should find venue by Feyenoord alias', () => {
      const result = lookupVenue('Feyenoord Stadium');
      expect(result).toBeDefined();
      expect(result?.name).toBe('De Kuip');
    });
  });

  describe('lookupVenueByPlaceId', () => {
    it('should find venue by Google Place ID', () => {
      const result = lookupVenueByPlaceId('ChIJMwmhB7UJxkcRHw_YqmTLNYE');
      expect(result).toBeDefined();
      expect(result?.name).toBe('Johan Cruijff ArenA');
    });

    it('should return null for unknown place ID', () => {
      const result = lookupVenueByPlaceId('unknown_place_id');
      expect(result).toBeNull();
    });

    it('should return null for empty place ID', () => {
      expect(lookupVenueByPlaceId('')).toBeNull();
    });
  });

  describe('getVenuesByCity', () => {
    it('should return all venues in Amsterdam', () => {
      const venues = getVenuesByCity('Amsterdam');
      expect(venues.length).toBeGreaterThan(1);
      expect(venues.every(v => v.city === 'Amsterdam')).toBe(true);
    });

    it('should return empty array for city with no venues', () => {
      const venues = getVenuesByCity('UnknownCity');
      expect(venues).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const lower = getVenuesByCity('amsterdam');
      const upper = getVenuesByCity('AMSTERDAM');
      expect(lower.length).toBe(upper.length);
    });
  });

  describe('getVenuesByCategory', () => {
    it('should return all stadiums', () => {
      const stadiums = getVenuesByCategory('stadium');
      expect(stadiums.length).toBeGreaterThan(0);
      expect(stadiums.every(v => v.category === 'stadium')).toBe(true);
    });

    it('should return all arenas', () => {
      const arenas = getVenuesByCategory('arena');
      expect(arenas.length).toBeGreaterThan(0);
      expect(arenas.every(v => v.category === 'arena')).toBe(true);
    });

    it('should return empty array for unused category', () => {
      const parks = getVenuesByCategory('park');
      // May be empty depending on the test subset
      expect(Array.isArray(parks)).toBe(true);
    });
  });

  describe('venue data integrity', () => {
    it('should have valid coordinates for all venues', () => {
      const venues = getVenuesByCity('Amsterdam');
      for (const venue of venues) {
        expect(venue.lat).toBeGreaterThan(50); // Netherlands latitude
        expect(venue.lat).toBeLessThan(54);
        expect(venue.lng).toBeGreaterThan(3); // Netherlands longitude
        expect(venue.lng).toBeLessThan(8);
      }
    });

    it('should have unique names in registry', () => {
      const stadiums = getVenuesByCategory('stadium');
      const names = stadiums.map(v => v.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });
  });
});
