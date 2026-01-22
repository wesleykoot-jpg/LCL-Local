/**
 * React Query hook for fetching discovery rails
 * 
 * Provides smart caching strategy:
 * - Traditional rails: 5 min cache (stable data)
 * - AI rails: Handled by backend, frontend uses single cache
 * - Auto-refetch on window focus for fresh data
 */

import { useQuery } from '@tanstack/react-query';
import type { DiscoveryLayout } from '../types/discoveryTypes.ts';
import { fetchDiscoveryRails } from '../api/eventService.ts';

interface UseDiscoveryRailsOptions {
  userId?: string;
  userLocation?: { lat: number; lng: number };
  radiusKm?: number;
  enabled?: boolean;
}

export function useDiscoveryRails({
  userId,
  userLocation,
  radiusKm = 25,
  enabled = true,
}: UseDiscoveryRailsOptions) {
  return useQuery<DiscoveryLayout>({
    queryKey: ['discovery-rails', userId, userLocation, radiusKm],
    queryFn: () => {
      // Backend handles null location by showing non-geospatial recommendations
      // Default to Groningen if no location provided (for testing/MVP)
      const defaultLocation = { lat: 53.2194, lng: 6.5665 }; 
      return fetchDiscoveryRails(userId || 'anonymous', userLocation || defaultLocation, radiusKm);
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: true,
    refetchOnMount: false,
  });
}
