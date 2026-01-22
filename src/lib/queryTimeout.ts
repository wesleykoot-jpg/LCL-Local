/**
 * Utility for adding timeouts to Supabase queries
 * Prevents queries from hanging indefinitely
 */

export class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Query timed out after ${timeoutMs}ms`);
    this.name = 'QueryTimeoutError';
  }
}

/**
 * Wraps a query function with a timeout
 * @param queryFn - The query function to execute
 * @param timeoutMs - Timeout in milliseconds (default: 10000ms = 10s)
 * @returns Promise that resolves with query result or rejects on timeout
 */
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new QueryTimeoutError(timeoutMs)), timeoutMs)
    ),
  ]);
}

/**
 * Configuration for different query types
 */
export const QUERY_TIMEOUTS = {
  /** Fast queries (simple selects, counts) */
  FAST: 5000,
  /** Standard queries (joins, filters) */
  STANDARD: 10000,
  /** Complex queries (RPC functions, aggregations) */
  COMPLEX: 15000,
  /** Heavy queries (reports, analytics) */
  HEAVY: 30000,
} as const;
