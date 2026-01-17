/**
 * Rate-limit header parsing utilities
 * Extracts rate-limit information from HTTP response headers
 */

export interface RateLimitInfo {
  retryAfterSeconds?: number;
  remaining?: number;
  resetTs?: string;
}

/**
 * Parses rate-limit headers from an HTTP response
 * Supports various common header formats:
 * - Retry-After (seconds or HTTP date)
 * - X-RateLimit-Remaining / RateLimit-Remaining
 * - X-RateLimit-Reset / RateLimit-Reset (Unix timestamp or ISO date)
 */
export function parseRateLimitHeaders(headers?: Headers): RateLimitInfo {
  if (!headers) {
    return {};
  }

  const info: RateLimitInfo = {};

  // Parse Retry-After header (RFC 6585)
  // Can be either seconds or HTTP date
  const retryAfter = headers.get('retry-after') || headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      info.retryAfterSeconds = seconds;
    } else {
      // Try parsing as HTTP date
      const date = new Date(retryAfter);
      if (!isNaN(date.getTime())) {
        info.retryAfterSeconds = Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
      }
    }
  }

  // Parse X-RateLimit-Remaining or RateLimit-Remaining
  const remaining = 
    headers.get('x-ratelimit-remaining') || 
    headers.get('X-RateLimit-Remaining') ||
    headers.get('ratelimit-remaining') ||
    headers.get('RateLimit-Remaining');
  if (remaining) {
    const parsed = parseInt(remaining, 10);
    if (!isNaN(parsed)) {
      info.remaining = parsed;
    }
  }

  // Parse X-RateLimit-Reset or RateLimit-Reset
  // Can be Unix timestamp (seconds) or ISO date string
  const reset = 
    headers.get('x-ratelimit-reset') ||
    headers.get('X-RateLimit-Reset') ||
    headers.get('ratelimit-reset') ||
    headers.get('RateLimit-Reset');
  if (reset) {
    const timestamp = parseInt(reset, 10);
    if (!isNaN(timestamp)) {
      // Unix timestamp (seconds)
      const date = new Date(timestamp * 1000);
      if (!isNaN(date.getTime())) {
        info.resetTs = date.toISOString();
      }
    } else {
      // Try parsing as ISO date
      const date = new Date(reset);
      if (!isNaN(date.getTime())) {
        info.resetTs = date.toISOString();
      }
    }
  }

  return info;
}
