/**
 * Server-side rate limiting utilities
 * 
 * Implements database-backed rate limiting to prevent abuse and ensure fair usage.
 * This cannot be bypassed by clients unlike client-side rate limiting.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logError } from './errorLogging.ts';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Rate limit key (e.g., 'api_key', 'ip_address', 'user_id') */
  keyType: 'api_key' | 'ip_address' | 'user_id' | 'function_name';
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of requests made in the current window */
  requestCount: number;
  /** Number of requests remaining in the current window */
  remaining: number;
  /** Unix timestamp when the rate limit will reset */
  resetAt: number;
  /** Error message if not allowed */
  error?: string;
}

/**
 * Default rate limit configurations for different function types
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Coordinator: 10 requests per minute (for manual triggers)
  'scrape-coordinator': {
    maxRequests: 10,
    windowSeconds: 60,
    keyType: 'api_key',
  },
  // Process worker: 60 requests per minute (for batch processing)
  'process-worker': {
    maxRequests: 60,
    windowSeconds: 60,
    keyType: 'api_key',
  },
  // Scrape events: 30 requests per minute (for individual source scraping)
  'scrape-events': {
    maxRequests: 30,
    windowSeconds: 60,
    keyType: 'api_key',
  },
  // Default fallback: 20 requests per minute
  'default': {
    maxRequests: 20,
    windowSeconds: 60,
    keyType: 'api_key',
  },
};

/**
 * Checks if a request should be rate limited
 * 
 * Uses database to track request counts per key (API key, IP, etc.)
 * Implements sliding window algorithm for accurate rate limiting
 * 
 * @param key - The rate limit key (e.g., API key, IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('[RateLimiting] Missing Supabase credentials');
      return {
        allowed: true,
        requestCount: 0,
        remaining: config.maxRequests,
        resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
      };
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - config.windowSeconds;
    
    // Try to use RPC function for atomic rate limit check
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_key: key,
      p_key_type: config.keyType,
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowSeconds,
    });
    
    if (error) {
      // If RPC doesn't exist, fall back to manual implementation
      console.warn('[RateLimiting] RPC not available, using fallback');
      return await checkRateLimitFallback(supabase, key, config, windowStart, now);
    }
    
    return data as RateLimitResult;
  } catch (error) {
    await logError({
      level: 'error',
      source: 'rateLimiting',
      function_name: 'checkRateLimit',
      message: 'Rate limit check failed',
      error_type: 'RateLimitError',
      stack_trace: error instanceof Error ? error.stack : undefined,
      context: { key, config },
    });
    
    // Allow request on error (fail open)
    return {
      allowed: true,
      requestCount: 0,
      remaining: config.maxRequests,
      resetAt: Math.floor(Date.now() / 1000) + config.windowSeconds,
    };
  }
}

/**
 * Fallback rate limit implementation using direct database queries
 * Used when the RPC function is not available
 */
async function checkRateLimitFallback(
  supabase: any,
  key: string,
  config: RateLimitConfig,
  windowStart: number,
  now: number
): Promise<RateLimitResult> {
  try {
    // Create rate_limits table if it doesn't exist
    const { error: tableError } = await supabase.rpc('ensure_rate_limits_table');
    // Ignore error if table already exists
    
    // Insert current request
    const { error: insertError } = await supabase
      .from('rate_limits')
      .insert({
        rate_key: key,
        key_type: config.keyType,
        request_timestamp: now,
      });
    
    if (insertError && insertError.code !== '23505') {
      // 23505 is unique constraint violation, which is fine
      console.error('[RateLimiting] Failed to insert rate limit record:', insertError);
    }
    
    // Count requests in the current window
    const { data: countData, error: countError } = await supabase
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('rate_key', key)
      .gte('request_timestamp', windowStart);
    
    if (countError) {
      console.error('[RateLimiting] Failed to count requests:', countError);
      return {
        allowed: true,
        requestCount: 0,
        remaining: config.maxRequests,
        resetAt: now + config.windowSeconds,
      };
    }
    
    const requestCount = countData?.[0]?.count || 0;
    const remaining = Math.max(0, config.maxRequests - requestCount);
    const allowed = requestCount < config.maxRequests;
    
    // Clean up old records (older than window)
    await supabase
      .from('rate_limits')
      .delete()
      .lt('request_timestamp', windowStart);
    
    return {
      allowed,
      requestCount,
      remaining,
      resetAt: now + config.windowSeconds,
      error: allowed ? undefined : `Rate limit exceeded. Try again in ${config.windowSeconds} seconds.`,
    };
  } catch (error) {
    console.error('[RateLimiting] Fallback implementation failed:', error);
    return {
      allowed: true,
      requestCount: 0,
      remaining: config.maxRequests,
      resetAt: now + config.windowSeconds,
    };
  }
}

/**
 * Extracts rate limit key from request
 * 
 * Supports multiple key types:
 * - api_key: Extracted from Authorization or x-api-key header
 * - ip_address: Extracted from x-forwarded-for or x-real-ip header
 * - user_id: Extracted from Authorization header (JWT token)
 * - function_name: Extracted from request URL path
 * 
 * @param req - The incoming request
 * @param keyType - The type of key to extract
 * @returns The rate limit key
 */
export function extractRateLimitKey(
  req: Request,
  keyType: 'api_key' | 'ip_address' | 'user_id' | 'function_name'
): string {
  switch (keyType) {
    case 'api_key':
      return extractApiKey(req) || 'anonymous';
    
    case 'ip_address':
      return extractIpAddress(req) || 'unknown';
    
    case 'user_id':
      return extractUserId(req) || 'anonymous';
    
    case 'function_name':
      return extractFunctionName(req) || 'unknown';
    
    default:
      return 'unknown';
  }
}

/**
 * Extracts API key from request headers
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  const xApiKey = req.headers.get('x-api-key');
  
  if (xApiKey) return xApiKey;
  
  if (authHeader) {
    const parts = authHeader.trim().split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      return parts[1];
    }
    if (parts.length === 1) {
      return parts[0];
    }
  }
  
  return null;
}

/**
 * Extracts IP address from request headers
 */
function extractIpAddress(req: Request): string | null {
  // Try x-forwarded-for header (from load balancer/proxy)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try x-real-ip header
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return null;
}

/**
 * Extracts user ID from JWT token in Authorization header
 */
function extractUserId(req: Request): string | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  
  try {
    // Extract JWT token
    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }
    
    const token = parts[1];
    
    // Decode JWT (without verification, just to get user ID)
    const payload = token.split('.')[1];
    if (!payload) return null;
    
    const decoded = atob(payload);
    const claims = JSON.parse(decoded);
    
    return claims.sub || claims.user_id || null;
  } catch {
    return null;
  }
}

/**
 * Extracts function name from request URL
 */
function extractFunctionName(req: Request): string {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    // Function name is typically the last part of the path
    return pathParts[pathParts.length - 1] || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Middleware to apply rate limiting to a request
 * 
 * Automatically checks rate limits and returns 429 if exceeded
 * 
 * @param req - The incoming request
 * @param config - Rate limit configuration
 * @returns Response if rate limited, null if allowed
 */
export async function withRateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<Response | null> {
  const key = extractRateLimitKey(req, config.keyType);
  const result = await checkRateLimit(key, config);
  
  if (!result.allowed) {
    return createRateLimitResponse(result);
  }
  
  return null;
}

/**
 * Creates a rate limit exceeded response
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: result.error || 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: result.resetAt - Math.floor(Date.now() / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.resetAt - Math.floor(Date.now() / 1000)),
        'X-RateLimit-Limit': String(result.requestCount + result.remaining),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}

/**
 * Wraps an edge function handler with rate limiting
 * 
 * Automatically checks rate limits and returns 429 if exceeded
 * 
 * @param handler - The handler function to wrap
 * @param configOrFunctionName - Rate limit config or function name to use default config
 * @returns Wrapped handler function
 */
export function withRateLimiting<T extends any[]>(
  handler: (req: Request, ...args: T) => Promise<Response>,
  configOrFunctionName: RateLimitConfig | string
) {
  const config = typeof configOrFunctionName === 'string'
    ? DEFAULT_RATE_LIMITS[configOrFunctionName] || DEFAULT_RATE_LIMITS.default
    : configOrFunctionName;
  
  return async (req: Request, ...args: T): Promise<Response> => {
    const rateLimitResponse = await withRateLimit(req, config);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(req, ...args);
  };
}
