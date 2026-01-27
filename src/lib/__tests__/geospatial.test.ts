import { describe, it, expect } from 'vitest';
import {
  calculateGroupCentroid,
  calculateWeightedCentroid,
  findMajorityCluster,
  calculateVenueSuggestionAnchors,
  type UserLocation,
} from '../geospatial';

describe('geospatial', () => {
  // Sample locations for Dutch cities (used in examples)
  const meppel: UserLocation = { id: 'meppel', lat: 52.6961, lng: 6.1944 };
  const zwolle: UserLocation = { id: 'zwolle', lat: 52.5168, lng: 6.0830 };
  const groningen: UserLocation = { id: 'groningen', lat: 53.2194, lng: 6.5665 };
  
  // Locations near Zwolle for cluster testing
  const nearZwolle1: UserLocation = { id: 'near-zwolle-1', lat: 52.5200, lng: 6.0900 };
  const nearZwolle2: UserLocation = { id: 'near-zwolle-2', lat: 52.5150, lng: 6.0850 };

  describe('calculateGroupCentroid', () => {
    it('should return the same location for a single user', () => {
      const result = calculateGroupCentroid([meppel]);
      
      expect(result.lat).toBe(meppel.lat);
      expect(result.lng).toBe(meppel.lng);
      expect(result.averageDistanceKm).toBe(0);
      expect(result.maxDistanceKm).toBe(0);
    });

    it('should throw error for empty user array', () => {
      expect(() => calculateGroupCentroid([])).toThrow(
        'At least one user location is required'
      );
    });

    it('should calculate midpoint for two users', () => {
      const result = calculateGroupCentroid([meppel, zwolle]);
      
      // Midpoint should be between the two cities
      expect(result.lat).toBeCloseTo((meppel.lat + zwolle.lat) / 2, 4);
      expect(result.lng).toBeCloseTo((meppel.lng + zwolle.lng) / 2, 4);
    });

    it('should calculate centroid for three users', () => {
      const result = calculateGroupCentroid([meppel, zwolle, groningen]);
      
      // Centroid should be average of all three
      const expectedLat = (meppel.lat + zwolle.lat + groningen.lat) / 3;
      const expectedLng = (meppel.lng + zwolle.lng + groningen.lng) / 3;
      
      expect(result.lat).toBeCloseTo(expectedLat, 4);
      expect(result.lng).toBeCloseTo(expectedLng, 4);
      expect(result.averageDistanceKm).toBeGreaterThan(0);
      expect(result.maxDistanceKm).toBeGreaterThan(result.averageDistanceKm);
    });

    it('should calculate distance metrics correctly', () => {
      const result = calculateGroupCentroid([meppel, zwolle, groningen]);
      
      // Max distance should be to the farthest city (likely Groningen)
      expect(result.maxDistanceKm).toBeGreaterThan(20); // Groningen is ~50km from center
      expect(result.averageDistanceKm).toBeLessThan(result.maxDistanceKm);
    });
  });

  describe('calculateWeightedCentroid', () => {
    it('should return the same location for a single user', () => {
      const result = calculateWeightedCentroid([meppel]);
      
      expect(result.lat).toBe(meppel.lat);
      expect(result.lng).toBe(meppel.lng);
    });

    it('should throw error for empty user array', () => {
      expect(() => calculateWeightedCentroid([])).toThrow(
        'At least one user location is required'
      );
    });

    it('should pull centroid toward cluster of users', () => {
      const users: UserLocation[] = [
        meppel, // Alone
        zwolle,
        nearZwolle1,
        nearZwolle2,
      ];
      
      const simpleResult = calculateGroupCentroid(users);
      const weightedResult = calculateWeightedCentroid(users, { clusterRadiusKm: 5 });
      
      // Weighted centroid should be pulled toward Zwolle cluster
      // (closer to Zwolle's longitude than simple centroid)
      const distToZwolleSimple = Math.abs(simpleResult.lng - zwolle.lng);
      const distToZwolleWeighted = Math.abs(weightedResult.lng - zwolle.lng);
      
      expect(distToZwolleWeighted).toBeLessThan(distToZwolleSimple);
    });

    it('should respect explicit user weights', () => {
      const users: UserLocation[] = [
        { ...meppel, weight: 10 }, // Heavy weight on Meppel
        zwolle,
      ];
      
      const result = calculateWeightedCentroid(users);
      
      // Centroid should be pulled toward Meppel due to high weight
      const midpoint = (meppel.lat + zwolle.lat) / 2;
      expect(result.lat).toBeGreaterThan(midpoint); // Closer to Meppel (higher lat)
    });

    it('should use default options when none provided', () => {
      const result = calculateWeightedCentroid([meppel, zwolle]);
      
      expect(result.lat).toBeDefined();
      expect(result.lng).toBeDefined();
      expect(result.averageDistanceKm).toBeDefined();
    });
  });

  describe('findMajorityCluster', () => {
    it('should return null for single user', () => {
      const result = findMajorityCluster([meppel]);
      expect(result).toBeNull();
    });

    it('should return null for empty array', () => {
      const result = findMajorityCluster([]);
      expect(result).toBeNull();
    });

    it('should return null when no users are close enough', () => {
      // All users are far apart (> 5km cluster radius)
      const result = findMajorityCluster([meppel, zwolle, groningen], 5);
      expect(result).toBeNull();
    });

    it('should detect a cluster of nearby users', () => {
      const users: UserLocation[] = [
        zwolle,
        nearZwolle1,
        nearZwolle2,
        groningen, // Far away, not in cluster
      ];
      
      const result = findMajorityCluster(users, 5);
      
      expect(result).not.toBeNull();
      expect(result!.memberCount).toBe(3); // Zwolle + 2 nearby
      expect(result!.memberIds).toContain('zwolle');
      expect(result!.memberIds).toContain('near-zwolle-1');
      expect(result!.memberIds).toContain('near-zwolle-2');
      expect(result!.memberIds).not.toContain('groningen');
    });

    it('should calculate cluster center correctly', () => {
      const users: UserLocation[] = [zwolle, nearZwolle1, nearZwolle2];
      
      const result = findMajorityCluster(users, 5);
      
      expect(result).not.toBeNull();
      // Center should be average of the three points
      const expectedLat = (zwolle.lat + nearZwolle1.lat + nearZwolle2.lat) / 3;
      const expectedLng = (zwolle.lng + nearZwolle1.lng + nearZwolle2.lng) / 3;
      
      expect(result!.center.lat).toBeCloseTo(expectedLat, 4);
      expect(result!.center.lng).toBeCloseTo(expectedLng, 4);
    });

    it('should return all clusters in the result', () => {
      const amsterdam: UserLocation = { id: 'amsterdam', lat: 52.3676, lng: 4.9041 };
      const nearAmsterdam: UserLocation = { id: 'near-amsterdam', lat: 52.3700, lng: 4.9100 };
      
      const users: UserLocation[] = [
        zwolle,
        nearZwolle1,
        amsterdam,
        nearAmsterdam,
      ];
      
      const result = findMajorityCluster(users, 5);
      
      expect(result).not.toBeNull();
      expect(result!.clusters.length).toBe(2); // Two clusters
    });
  });

  describe('calculateVenueSuggestionAnchors', () => {
    it('should return all three anchor types', () => {
      const users: UserLocation[] = [
        { id: 'host', lat: 52.6961, lng: 6.1944 }, // Meppel (host)
        zwolle,
        nearZwolle1,
        nearZwolle2,
      ];
      
      const result = calculateVenueSuggestionAnchors('host', users);
      
      // Host location (Anchor A)
      expect(result.hostLocation.lat).toBe(52.6961);
      expect(result.hostLocation.lng).toBe(6.1944);
      
      // Fair meet point (Anchor B) - weighted centroid
      expect(result.fairMeetPoint).toBeDefined();
      expect(result.fairMeetPoint.lat).toBeDefined();
      expect(result.fairMeetPoint.lng).toBeDefined();
      
      // Hub location (Anchor C) - majority cluster
      expect(result.hubLocation).not.toBeNull();
      expect(result.hubLocation!.memberCount).toBe(3); // Zwolle cluster
    });

    it('should throw error if host not in user list', () => {
      expect(() =>
        calculateVenueSuggestionAnchors('nonexistent', [meppel, zwolle])
      ).toThrow('Host not found in user list');
    });

    it('should apply host weight to centroid calculation', () => {
      const users: UserLocation[] = [
        { id: 'host', lat: 52.6961, lng: 6.1944 },
        zwolle,
      ];
      
      // Without host weight adjustment
      const simpleResult = calculateGroupCentroid(users);
      
      // With host weight (1.5x default)
      const anchorsResult = calculateVenueSuggestionAnchors('host', users, {
        hostWeight: 2.0,
      });
      
      // Fair meet point should be pulled toward host location
      expect(anchorsResult.fairMeetPoint.lat).toBeGreaterThan(simpleResult.lat);
    });

    it('should return null hub when no clear cluster exists', () => {
      const users: UserLocation[] = [
        { id: 'host', lat: 52.6961, lng: 6.1944 },
        zwolle,
        groningen,
      ];
      
      const result = calculateVenueSuggestionAnchors('host', users, {
        clusterRadiusKm: 5,
      });
      
      // No cluster should be found (all cities are far apart)
      expect(result.hubLocation).toBeNull();
    });
  });
});
