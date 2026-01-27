/**
 * Geospatial Utilities for Group Meeting Point Calculation
 *
 * This module provides mathematical utilities for calculating optimal
 * meeting points for groups of users based on their locations.
 *
 * Key algorithms:
 * - Geometric Centroid: Simple average of all participant coordinates
 * - Weighted Centroid: Pulls center towards user clusters
 * - Majority Cluster Detection: Identifies groups of nearby users
 */

import { calculateDistanceKm } from './distance';

/**
 * User location interface for centroid calculations
 */
export interface UserLocation {
  id: string;
  lat: number;
  lng: number;
  /** Optional weight for this user (e.g., host gets more weight) */
  weight?: number;
}

/**
 * Result of a centroid calculation
 */
export interface CentroidResult {
  lat: number;
  lng: number;
  /** Average distance from centroid to all participants (km) */
  averageDistanceKm: number;
  /** Maximum distance from centroid to any participant (km) */
  maxDistanceKm: number;
}

/**
 * Result of cluster detection
 */
export interface ClusterResult {
  /** Center of the largest cluster */
  center: { lat: number; lng: number };
  /** Number of users in the largest cluster */
  memberCount: number;
  /** IDs of users in the largest cluster */
  memberIds: string[];
  /** All detected clusters */
  clusters: Array<{
    center: { lat: number; lng: number };
    memberIds: string[];
  }>;
}

/**
 * Options for weighted centroid calculation
 */
export interface WeightedCentroidOptions {
  /** Weight multiplier for the host (default: 1.5) */
  hostWeight?: number;
  /** Cluster detection radius in km (default: 5) */
  clusterRadiusKm?: number;
  /** Weight multiplier for cluster members (default: 1.2 per additional member) */
  clusterBoost?: number;
}

/**
 * Venue suggestion anchors for proposal creation
 */
export interface VenueSuggestionAnchors {
  /** Host's location (Anchor A) */
  hostLocation: { lat: number; lng: number };
  /** Calculated fair meet point (Anchor B) */
  fairMeetPoint: CentroidResult;
  /** Majority cluster center (Anchor C) - null if no clear cluster */
  hubLocation: ClusterResult | null;
}

/**
 * Calculates the geometric centroid (center point) of multiple user locations.
 *
 * Uses simple arithmetic mean for latitude and longitude.
 * For short distances (<100km), this provides a good approximation.
 *
 * @param users - Array of user locations
 * @returns Centroid result with center coordinates and distance metrics
 * @throws Error if less than 1 user is provided
 *
 * @example
 * const centroid = calculateGroupCentroid([
 *   { id: 'user1', lat: 52.5076, lng: 6.2483 }, // Meppel
 *   { id: 'user2', lat: 52.5168, lng: 6.0830 }, // Zwolle
 *   { id: 'user3', lat: 53.2194, lng: 6.5665 }, // Groningen
 * ]);
 * // Returns center point between all three cities
 */
export function calculateGroupCentroid(users: UserLocation[]): CentroidResult {
  if (users.length === 0) {
    throw new Error('At least one user location is required');
  }

  if (users.length === 1) {
    return {
      lat: users[0].lat,
      lng: users[0].lng,
      averageDistanceKm: 0,
      maxDistanceKm: 0,
    };
  }

  // Calculate arithmetic mean of coordinates
  const sumLat = users.reduce((sum, user) => sum + user.lat, 0);
  const sumLng = users.reduce((sum, user) => sum + user.lng, 0);

  const centroidLat = sumLat / users.length;
  const centroidLng = sumLng / users.length;

  // Calculate distances from centroid to each user
  const distances = users.map((user) =>
    calculateDistanceKm(centroidLat, centroidLng, user.lat, user.lng)
  );

  const averageDistanceKm =
    distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const maxDistanceKm = Math.max(...distances);

  return {
    lat: centroidLat,
    lng: centroidLng,
    averageDistanceKm,
    maxDistanceKm,
  };
}

/**
 * Calculates a weighted centroid that pulls toward user clusters.
 *
 * This "Fairness Engine" ensures that if 3 people are in Zwolle and
 * 1 person is in Meppel, the meeting point is pulled toward Zwolle.
 *
 * Weights are applied based on:
 * 1. Explicit user weights (e.g., host gets hostWeight multiplier)
 * 2. Cluster membership (users near others get clusterBoost)
 *
 * @param users - Array of user locations with optional weights
 * @param options - Configuration for weighting behavior
 * @returns Weighted centroid result
 *
 * @example
 * const weightedCentroid = calculateWeightedCentroid(
 *   [
 *     { id: 'host', lat: 52.5076, lng: 6.2483, weight: 1.5 }, // Meppel (host)
 *     { id: 'user2', lat: 52.5168, lng: 6.0830 }, // Zwolle
 *     { id: 'user3', lat: 52.5200, lng: 6.0900 }, // Near Zwolle
 *     { id: 'user4', lat: 52.5150, lng: 6.0850 }, // Near Zwolle
 *   ],
 *   { clusterRadiusKm: 5, clusterBoost: 1.2 }
 * );
 * // Centroid is pulled toward Zwolle cluster
 */
export function calculateWeightedCentroid(
  users: UserLocation[],
  options: WeightedCentroidOptions = {}
): CentroidResult {
  if (users.length === 0) {
    throw new Error('At least one user location is required');
  }

  if (users.length === 1) {
    return {
      lat: users[0].lat,
      lng: users[0].lng,
      averageDistanceKm: 0,
      maxDistanceKm: 0,
    };
  }

  const { clusterRadiusKm = 5, clusterBoost = 1.2 } = options;

  // Calculate cluster-based weights
  const clusterWeights = users.map((user) => {
    // Count nearby users (within clusterRadiusKm)
    const nearbyCount = users.filter((other) => {
      if (other.id === user.id) return false;
      const distance = calculateDistanceKm(
        user.lat,
        user.lng,
        other.lat,
        other.lng
      );
      return distance <= clusterRadiusKm;
    }).length;

    // Cluster boost: More nearby users = higher weight
    const clusterMultiplier = 1 + nearbyCount * (clusterBoost - 1);

    // Combine with explicit weight
    const baseWeight = user.weight ?? 1;
    return baseWeight * clusterMultiplier;
  });

  // Calculate weighted centroid
  const totalWeight = clusterWeights.reduce((sum, w) => sum + w, 0);

  const weightedLat = users.reduce(
    (sum, user, i) => sum + user.lat * clusterWeights[i],
    0
  ) / totalWeight;

  const weightedLng = users.reduce(
    (sum, user, i) => sum + user.lng * clusterWeights[i],
    0
  ) / totalWeight;

  // Calculate distances from weighted centroid
  const distances = users.map((user) =>
    calculateDistanceKm(weightedLat, weightedLng, user.lat, user.lng)
  );

  const averageDistanceKm =
    distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const maxDistanceKm = Math.max(...distances);

  return {
    lat: weightedLat,
    lng: weightedLng,
    averageDistanceKm,
    maxDistanceKm,
  };
}

/**
 * Finds the majority cluster (hub) among user locations.
 *
 * Uses a simple density-based approach:
 * 1. For each user, count how many others are within clusterRadiusKm
 * 2. Group users into clusters based on proximity
 * 3. Return the largest cluster as the "hub"
 *
 * @param users - Array of user locations
 * @param clusterRadiusKm - Maximum distance between cluster members (default: 5km)
 * @returns Cluster result with hub location, or null if no clear cluster
 *
 * @example
 * const cluster = findMajorityCluster([
 *   { id: 'user1', lat: 52.5168, lng: 6.0830 }, // Zwolle
 *   { id: 'user2', lat: 52.5200, lng: 6.0900 }, // Near Zwolle
 *   { id: 'user3', lat: 52.5150, lng: 6.0850 }, // Near Zwolle
 *   { id: 'user4', lat: 53.2194, lng: 6.5665 }, // Groningen (alone)
 * ]);
 * // Returns Zwolle cluster with 3 members
 */
export function findMajorityCluster(
  users: UserLocation[],
  clusterRadiusKm: number = 5
): ClusterResult | null {
  if (users.length < 2) {
    return null;
  }

  // Build adjacency list - who is near whom
  const adjacencyMap = new Map<string, string[]>();

  users.forEach((user) => {
    const nearbyIds = users
      .filter((other) => {
        if (other.id === user.id) return false;
        const distance = calculateDistanceKm(
          user.lat,
          user.lng,
          other.lat,
          other.lng
        );
        return distance <= clusterRadiusKm;
      })
      .map((u) => u.id);
    adjacencyMap.set(user.id, nearbyIds);
  });

  // Find connected components (clusters) using BFS
  const visited = new Set<string>();
  const clusters: Array<{ memberIds: string[] }> = [];

  users.forEach((user) => {
    if (visited.has(user.id)) return;

    const cluster: string[] = [];
    const queue = [user.id];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;

      visited.add(currentId);
      cluster.push(currentId);

      const neighbors = adjacencyMap.get(currentId) || [];
      neighbors.forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      });
    }

    clusters.push({ memberIds: cluster });
  });

  // No meaningful clusters if all are singles or only one cluster with everyone
  if (clusters.length === 0) {
    return null;
  }

  // Sort by size descending
  clusters.sort((a, b) => b.memberIds.length - a.memberIds.length);

  // Largest cluster must have at least 2 members to be considered a "hub"
  const largestCluster = clusters[0];
  if (largestCluster.memberIds.length < 2) {
    return null;
  }

  // Calculate center of largest cluster
  const clusterUsers = users.filter((u) =>
    largestCluster.memberIds.includes(u.id)
  );
  const centerLat =
    clusterUsers.reduce((sum, u) => sum + u.lat, 0) / clusterUsers.length;
  const centerLng =
    clusterUsers.reduce((sum, u) => sum + u.lng, 0) / clusterUsers.length;

  // Build full cluster results with centers
  const allClusters = clusters.map((cluster) => {
    const members = users.filter((u) => cluster.memberIds.includes(u.id));
    return {
      center: {
        lat: members.reduce((sum, u) => sum + u.lat, 0) / members.length,
        lng: members.reduce((sum, u) => sum + u.lng, 0) / members.length,
      },
      memberIds: cluster.memberIds,
    };
  });

  return {
    center: { lat: centerLat, lng: centerLng },
    memberCount: largestCluster.memberIds.length,
    memberIds: largestCluster.memberIds,
    clusters: allClusters,
  };
}

/**
 * Calculates all venue suggestion anchors for a group proposal.
 *
 * Returns three anchor points for venue search:
 * - Anchor A (Host): The initiator's location
 * - Anchor B (Fair Meet): The weighted centroid of all participants
 * - Anchor C (Hub): The center of the majority cluster (if one exists)
 *
 * @param hostId - ID of the host/initiator
 * @param users - All participant locations including host
 * @param options - Configuration options
 * @returns Venue suggestion anchors
 *
 * @example
 * const anchors = calculateVenueSuggestionAnchors('host-id', [
 *   { id: 'host-id', lat: 52.5076, lng: 6.2483 }, // Host in Meppel
 *   { id: 'user2', lat: 52.5168, lng: 6.0830 }, // Zwolle
 *   { id: 'user3', lat: 52.5200, lng: 6.0900 }, // Zwolle
 * ]);
 * // Returns host location, fair centroid, and Zwolle hub
 */
export function calculateVenueSuggestionAnchors(
  hostId: string,
  users: UserLocation[],
  options: WeightedCentroidOptions = {}
): VenueSuggestionAnchors {
  const { hostWeight = 1.5, clusterRadiusKm = 5 } = options;

  // Find host location
  const host = users.find((u) => u.id === hostId);
  if (!host) {
    throw new Error('Host not found in user list');
  }

  // Apply host weight
  const usersWithHostWeight = users.map((u) => ({
    ...u,
    weight: u.id === hostId ? (u.weight ?? 1) * hostWeight : u.weight ?? 1,
  }));

  // Calculate fair meet point (weighted centroid)
  const fairMeetPoint = calculateWeightedCentroid(usersWithHostWeight, options);

  // Find majority cluster
  const hubLocation = findMajorityCluster(users, clusterRadiusKm);

  return {
    hostLocation: { lat: host.lat, lng: host.lng },
    fairMeetPoint,
    hubLocation,
  };
}
