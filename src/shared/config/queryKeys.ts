/**
 * Centralized query key factory for React Query
 * This ensures consistent cache keys across the application
 */

export interface EventFeedFilters {
  category?: string[];
  eventType?: string[];
  userLocation?: { lat: number; lng: number };
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}

export const queryKeys = {
  events: {
    all: ['events'] as const,
    feed: (filters: EventFeedFilters) => ['events', 'feed', filters] as const,
  },
  profile: {
    all: ['profile'] as const,
    commitments: (userId: string) => ['profile', userId, 'commitments'] as const,
  },
  friendsPulse: (userId: string) => ['friends-pulse', userId] as const,
} as const;
