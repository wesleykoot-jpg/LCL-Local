/**
 * Centralized React Query configuration constants
 * These values control cache behavior across the application
 */

// Consider data fresh for 2 minutes
export const QUERY_STALE_TIME = 1000 * 60 * 2;

// Keep unused data in cache for 10 minutes
export const QUERY_GC_TIME = 1000 * 60 * 10;
