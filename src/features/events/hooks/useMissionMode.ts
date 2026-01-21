/**
 * React Query hook for mission mode
 * 
 * Fetches events for immediate intent queries (lunch, coffee, drinks)
 * with geospatial filtering and walking distance calculations
 */

import { useQuery } from '@tanstack/react-query';
import type { MissionIntent, MissionModeResponse } from '../types/discoveryTypes';
import { fetchMissionModeEvents } from '../api/eventService';

interface UseMissionModeOptions {
  intent: MissionIntent | null;
  userLocation?: { lat: number; lng: number };
  maxDistanceKm?: number;
  enabled?: boolean;
}

export function useMissionMode({
  intent,
  userLocation,
  maxDistanceKm = 1.0,
  enabled = true,
}: UseMissionModeOptions) {
  return useQuery<MissionModeResponse>({
    queryKey: ['mission-mode', intent, userLocation, maxDistanceKm],
    queryFn: () => {
      if (!intent || !userLocation) {
        throw new Error('Intent and user location are required for mission mode');
      }
      return fetchMissionModeEvents(intent, userLocation, maxDistanceKm);
    },
    enabled: enabled && !!intent && !!userLocation,
    staleTime: 1 * 60 * 1000, // 1 minute (immediate needs change quickly)
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true, // Always fresh for immediate intents
  });
}
