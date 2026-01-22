/**
 * Query performance monitoring utility
 * Tracks slow queries and provides performance insights
 */

export interface QueryMetrics {
  queryName: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

// In-memory storage for query metrics (in production, send to analytics service)
const queryMetrics: QueryMetrics[] = [];
const MAX_STORED_METRICS = 100;

/**
 * Monitors query performance and logs slow queries
 * @param queryName - Name/identifier for the query
 * @param queryFn - The query function to monitor
 * @param slowThresholdMs - Threshold in ms to consider a query slow (default: 1000ms)
 * @returns Promise with query result
 */
export async function monitorQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  slowThresholdMs: number = 1000
): Promise<T> {
  const start = performance.now();
  const timestamp = Date.now();

  try {
    const result = await queryFn();
    const duration = performance.now() - start;

    // Store metrics
    storeMetric({
      queryName,
      duration,
      timestamp,
      success: true,
    });

    // Log slow queries
    if (duration > slowThresholdMs) {
      console.warn(
        `[SLOW QUERY] ${queryName} took ${duration.toFixed(0)}ms (threshold: ${slowThresholdMs}ms)`
      );
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.log(`[QUERY] ${queryName} completed in ${duration.toFixed(0)}ms`);
    }

    // Send to analytics in production
    if (import.meta.env.PROD && duration > slowThresholdMs) {
      // Example: analytics.track('slow_query', { queryName, duration });
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    // Store error metrics
    storeMetric({
      queryName,
      duration,
      timestamp,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });

    console.error(
      `[QUERY ERROR] ${queryName} failed after ${duration.toFixed(0)}ms`,
      error
    );

    throw error;
  }
}

/**
 * Stores query metrics (limited to MAX_STORED_METRICS)
 */
function storeMetric(metric: QueryMetrics): void {
  queryMetrics.push(metric);

  // Keep only the most recent metrics
  if (queryMetrics.length > MAX_STORED_METRICS) {
    queryMetrics.shift();
  }
}

/**
 * Gets query performance statistics
 */
export function getQueryStats(): {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageDuration: number;
  slowQueries: number;
  slowestQuery: QueryMetrics | null;
} {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageDuration: 0,
      slowQueries: 0,
      slowestQuery: null,
    };
  }

  const successful = queryMetrics.filter((m) => m.success);
  const failed = queryMetrics.filter((m) => !m.success);
  const slow = queryMetrics.filter((m) => m.duration > 1000);
  const totalDuration = queryMetrics.reduce((sum, m) => sum + m.duration, 0);
  const slowest = queryMetrics.reduce((prev, current) =>
    current.duration > prev.duration ? current : prev
  );

  return {
    totalQueries: queryMetrics.length,
    successfulQueries: successful.length,
    failedQueries: failed.length,
    averageDuration: totalDuration / queryMetrics.length,
    slowQueries: slow.length,
    slowestQuery: slowest,
  };
}

/**
 * Gets metrics for a specific query
 */
export function getQueryMetrics(queryName: string): QueryMetrics[] {
  return queryMetrics.filter((m) => m.queryName === queryName);
}

/**
 * Clears all stored metrics
 */
export function clearMetrics(): void {
  queryMetrics.length = 0;
}

/**
 * Logs query statistics to console
 */
export function logQueryStats(): void {
  const stats = getQueryStats();
  console.log('=== Query Performance Statistics ===');
  console.log(`Total Queries: ${stats.totalQueries}`);
  console.log(`Successful: ${stats.successfulQueries}`);
  console.log(`Failed: ${stats.failedQueries}`);
  console.log(`Average Duration: ${stats.averageDuration.toFixed(0)}ms`);
  console.log(`Slow Queries (>1s): ${stats.slowQueries}`);
  if (stats.slowestQuery) {
    console.log(
      `Slowest Query: ${stats.slowestQuery.queryName} (${stats.slowestQuery.duration.toFixed(0)}ms)`
    );
  }
  console.log('====================================');
}
