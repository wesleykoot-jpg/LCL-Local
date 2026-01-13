/**
 * Exponential backoff with full jitter for retry logic.
 * Respects Retry-After header when present.
 */

import { DEFAULTS } from '../config/defaults';

/**
 * Calculate backoff delay with full jitter
 * @param attempt Current attempt number (0-indexed)
 * @param baseMs Base delay in milliseconds
 * @param capMs Maximum delay cap in milliseconds
 * @returns Delay in milliseconds with jitter applied
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseMs: number = DEFAULTS.BACKOFF_BASE_MS,
  capMs: number = DEFAULTS.BACKOFF_CAP_MS
): number {
  // Exponential: base * 2^attempt
  const exponential = baseMs * Math.pow(2, attempt);
  // Cap the value
  const capped = Math.min(exponential, capMs);
  // Full jitter: random between 0 and capped value
  return Math.floor(Math.random() * capped);
}

/**
 * Parse Retry-After header value
 * @param retryAfter Header value (can be seconds or HTTP date)
 * @returns Delay in milliseconds, or null if invalid
 */
export function parseRetryAfter(retryAfter: string | undefined | null): number | null {
  if (!retryAfter) return null;

  // Try parsing as integer (seconds)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  // Only try parsing as HTTP date if it doesn't look like a number
  // (to avoid parsing "0" or "-5" as dates)
  if (!/^\s*-?\d+\s*$/.test(retryAfter)) {
    const date = new Date(retryAfter);
    if (!isNaN(date.getTime())) {
      const delayMs = date.getTime() - Date.now();
      return delayMs > 0 ? delayMs : 0;
    }
  }

  return null;
}

/**
 * Get the appropriate delay for next retry attempt
 * Respects Retry-After header if present, otherwise uses exponential backoff
 * @param attempt Current attempt number (0-indexed)
 * @param retryAfterHeader Optional Retry-After header value
 * @param baseMs Base delay for exponential backoff
 * @param capMs Maximum delay cap
 * @returns Delay in milliseconds
 */
export function getRetryDelay(
  attempt: number,
  retryAfterHeader?: string | null,
  baseMs: number = DEFAULTS.BACKOFF_BASE_MS,
  capMs: number = DEFAULTS.BACKOFF_CAP_MS
): number {
  // Prefer Retry-After header if present
  const retryAfterDelay = parseRetryAfter(retryAfterHeader);
  if (retryAfterDelay !== null) {
    return Math.min(retryAfterDelay, capMs);
  }

  // Otherwise use exponential backoff with jitter
  return calculateBackoffWithJitter(attempt, baseMs, capMs);
}

/**
 * Sleep for specified milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
