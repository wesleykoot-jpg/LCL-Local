/**
 * Centralized query key factory for React Query
 * This ensures consistent cache keys across the application
 */

export const queryKeys = {
  events: {
    all: ['events'] as const,
    feed: (filters: any) => ['events', 'feed', filters] as const,
  },
  profile: {
    all: ['profile'] as const,
    commitments: (userId: string) => ['profile', userId, 'commitments'] as const,
  },
} as const;
