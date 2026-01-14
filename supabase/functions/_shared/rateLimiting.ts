/**
 * Rate limiting utilities with adaptive jitter
 * Implements anti-fingerprinting through randomized delays
 */

/**
 * Applies jitter (±20%) to a delay value to avoid fingerprinting
 * @param baseMs - Base delay in milliseconds
 * @param jitterPercent - Jitter percentage (default 20%)
 * @returns Jittered delay in milliseconds
 */
export function applyJitter(baseMs: number, jitterPercent: number = 20): number {
  const jitterRange = baseMs * (jitterPercent / 100);
  const jitter = (Math.random() * 2 - 1) * jitterRange; // Random value between -jitterRange and +jitterRange
  return Math.max(0, Math.round(baseMs + jitter));
}

/**
 * Creates a delay with jitter
 * @param baseMs - Base delay in milliseconds
 * @param jitterPercent - Jitter percentage (default 20%)
 * @returns Promise that resolves after the jittered delay
 */
export function jitteredDelay(baseMs: number, jitterPercent: number = 20): Promise<void> {
  const delayMs = applyJitter(baseMs, jitterPercent);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Checks if a status code indicates rate limiting
 * @param statusCode - HTTP status code
 * @returns true if the status code is 403 or 429
 */
export function isRateLimited(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 429;
}
