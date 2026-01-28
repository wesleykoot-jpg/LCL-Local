/**
 * Optimized debug logging that can be disabled for performance
 */

const DEBUG_ENABLED = import.meta.env.DEV && false; // Set to true to enable debug logs

/**
 * Debug logging that can be toggled off for performance
 * Prevents expensive console.log calls from blocking the UI thread
 */
export function debugLog(label: string, ...args: unknown[]) {
  if (DEBUG_ENABLED) {
    console.log(`[${label}]`, ...args);
  }
}

/**
 * Conditional debug logging - only logs in specific scenarios
 */
export function debugLogIf(condition: boolean, label: string, ...args: unknown[]) {
  if (DEBUG_ENABLED && condition) {
    console.log(`[${label}]`, ...args);
  }
}

/**
 * Performance measurement utility
 */
export function measurePerformance(label: string, fn: () => void) {
  if (!DEBUG_ENABLED) {
    fn();
    return;
  }

  const start = performance.now();
  fn();
  const duration = performance.now() - start;
  if (duration > 50) {
    // Only log slow operations
    console.warn(`[PERF] ${label} took ${duration.toFixed(2)}ms`);
  }
}
