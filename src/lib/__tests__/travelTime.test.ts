import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  estimateTravelTime,
  formatTravelTime,
  suggestTravelMode,
  parseLocation,
  estimateTravelTimeBetweenEvents,
} from '../travelTime';

describe('Travel Time Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between Amsterdam and Rotterdam', () => {
      // Amsterdam: 52.3676° N, 4.9041° E
      // Rotterdam: 51.9244° N, 4.4777° E
      const distance = calculateDistance(52.3676, 4.9041, 51.9244, 4.4777);
      
      // Actual distance is approximately 57 km
      expect(distance).toBeGreaterThan(50);
      expect(distance).toBeLessThan(65);
    });

    it('should return 0 for same location', () => {
      const distance = calculateDistance(52.3676, 4.9041, 52.3676, 4.9041);
      expect(distance).toBe(0);
    });

    it('should calculate short distances accurately', () => {
      // Two points about 1 km apart in Amsterdam
      const distance = calculateDistance(52.3702, 4.8952, 52.3792, 4.8952);
      
      // Should be approximately 1 km
      expect(distance).toBeGreaterThan(0.5);
      expect(distance).toBeLessThan(1.5);
    });
  });

  describe('suggestTravelMode', () => {
    it('should suggest walking for very short distances', () => {
      expect(suggestTravelMode(0.5)).toBe('walking');
      expect(suggestTravelMode(0.9)).toBe('walking');
    });

    it('should suggest cycling for medium distances', () => {
      expect(suggestTravelMode(2)).toBe('cycling');
      expect(suggestTravelMode(4)).toBe('cycling');
    });

    it('should suggest transit for longer distances', () => {
      expect(suggestTravelMode(8)).toBe('transit');
      expect(suggestTravelMode(12)).toBe('transit');
    });

    it('should suggest car for long distances', () => {
      expect(suggestTravelMode(20)).toBe('car');
      expect(suggestTravelMode(50)).toBe('car');
    });
  });

  describe('estimateTravelTime', () => {
    it('should estimate walking time for short distances', () => {
      // 500 meters = 0.5 km at 5 km/h = 6 minutes
      const result = estimateTravelTime(
        { lat: 52.3702, lng: 4.8952 },
        { lat: 52.3702, lng: 4.8962 }, // ~70 meters
        'walking'
      );
      
      expect(result.mode).toBe('walking');
      expect(result.minutes).toBeGreaterThanOrEqual(1);
      expect(result.label).toContain('🚶');
    });

    it('should estimate car time for long distances', () => {
      // Amsterdam to Rotterdam (~57 km) at 40 km/h = ~85 minutes
      const result = estimateTravelTime(
        { lat: 52.3676, lng: 4.9041 },
        { lat: 51.9244, lng: 4.4777 },
        'car'
      );
      
      expect(result.mode).toBe('car');
      expect(result.minutes).toBeGreaterThan(60);
      expect(result.minutes).toBeLessThan(120);
      expect(result.label).toContain('🚕');
    });

    it('should auto-suggest travel mode when not provided', () => {
      const result = estimateTravelTime(
        { lat: 52.3702, lng: 4.8952 },
        { lat: 52.3792, lng: 4.8952 }
      );
      
      // About 1 km, should suggest walking or cycling
      expect(['walking', 'cycling']).toContain(result.mode);
    });

    it('should return minimum 1 minute for very short distances', () => {
      const result = estimateTravelTime(
        { lat: 52.3702, lng: 4.8952 },
        { lat: 52.3702, lng: 4.8952 }
      );
      
      expect(result.minutes).toBe(1);
    });
  });

  describe('formatTravelTime', () => {
    it('should format short travel times in minutes', () => {
      expect(formatTravelTime(15, 'car')).toBe('🚕 15 min');
      expect(formatTravelTime(5, 'walking')).toBe('🚶 5 min');
    });

    it('should format travel times over an hour', () => {
      expect(formatTravelTime(90, 'car')).toBe('🚕 1u 30m');
      expect(formatTravelTime(120, 'car')).toBe('🚕 2 uur');
    });

    it('should use correct emoji for each mode', () => {
      expect(formatTravelTime(10, 'walking')).toContain('🚶');
      expect(formatTravelTime(10, 'cycling')).toContain('🚴');
      expect(formatTravelTime(10, 'car')).toContain('🚕');
      expect(formatTravelTime(10, 'transit')).toContain('🚌');
    });
  });

  describe('parseLocation', () => {
    it('should parse PostGIS POINT format', () => {
      const result = parseLocation('POINT(4.9041 52.3676)');
      expect(result).toEqual({ lng: 4.9041, lat: 52.3676 });
    });

    it('should parse PostGIS POINT with SRID', () => {
      const result = parseLocation('SRID=4326;POINT(4.9041 52.3676)');
      expect(result).toEqual({ lng: 4.9041, lat: 52.3676 });
    });

    it('should parse {lat, lng} object', () => {
      const result = parseLocation({ lat: 52.3676, lng: 4.9041 });
      expect(result).toEqual({ lat: 52.3676, lng: 4.9041 });
    });

    it('should parse nested coordinates object', () => {
      const result = parseLocation({
        name: 'Amsterdam',
        coordinates: { lat: 52.3676, lng: 4.9041 }
      });
      expect(result).toEqual({ lat: 52.3676, lng: 4.9041 });
    });

    it('should return null for invalid input', () => {
      expect(parseLocation(null)).toBeNull();
      expect(parseLocation(undefined)).toBeNull();
      expect(parseLocation('invalid')).toBeNull();
      expect(parseLocation({})).toBeNull();
    });
  });

  describe('estimateTravelTimeBetweenEvents', () => {
    it('should estimate travel time between PostGIS locations', () => {
      const result = estimateTravelTimeBetweenEvents(
        'POINT(4.9041 52.3676)',
        'POINT(4.4777 51.9244)'
      );
      
      expect(result).not.toBeNull();
      expect(result?.minutes).toBeGreaterThan(0);
      expect(result?.distanceKm).toBeGreaterThan(0);
    });

    it('should return null for invalid locations', () => {
      const result = estimateTravelTimeBetweenEvents(null, null);
      expect(result).toBeNull();
    });

    it('should handle mixed location formats', () => {
      const result = estimateTravelTimeBetweenEvents(
        'POINT(4.9041 52.3676)',
        { lat: 51.9244, lng: 4.4777 }
      );
      
      expect(result).not.toBeNull();
      expect(result?.distanceKm).toBeGreaterThan(50);
    });
  });
});
