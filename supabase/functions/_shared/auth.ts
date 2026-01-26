/**
 * Authentication and authorization utilities for Edge Functions
 * 
 * Provides API key validation and request signing verification
 * to protect edge functions from unauthorized access.
 */

import { logError } from './errorLogging.ts';

/**
 * Authentication error types
 */
export enum AuthError {
  MISSING_API_KEY = 'MISSING_API_KEY',
  INVALID_API_KEY = 'INVALID_API_KEY',
  EXPIRED_API_KEY = 'EXPIRED_API_KEY',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  FORBIDDEN = 'FORBIDDEN',
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  error?: AuthError;
  message?: string;
  userId?: string;
  apiKeyType?: 'service' | 'admin' | 'worker';
}

/**
 * Validates an API key against allowed keys
 * 
 * Supports multiple key types:
 * - Service role keys (full access)
 * - Admin keys (limited admin access)
 * - Worker keys (internal worker communication)
 * 
 * @param req - The incoming request
 * @returns Authentication result
 */
export async function validateApiKey(req: Request): Promise<AuthResult> {
  try {
    // Get API key from Authorization header or x-api-key header
    const authHeader = req.headers.get('authorization');
    const xApiKey = req.headers.get('x-api-key');
    
    const apiKey = extractApiKey(authHeader) || xApiKey;
    
    if (!apiKey) {
      return {
        success: false,
        error: AuthError.MISSING_API_KEY,
        message: 'API key is required',
      };
    }
    
    // Get allowed API keys from environment
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const adminApiKey = Deno.env.get('ADMIN_API_KEY');
    const workerApiKey = Deno.env.get('WORKER_API_KEY');
    
    // Validate service role key (full access)
    if (serviceRoleKey && apiKey === serviceRoleKey) {
      return {
        success: true,
        apiKeyType: 'service',
      };
    }
    
    // Validate admin key (limited admin access)
    if (adminApiKey && apiKey === adminApiKey) {
      return {
        success: true,
        apiKeyType: 'admin',
      };
    }
    
    // Validate worker key (internal worker communication)
    if (workerApiKey && apiKey === workerApiKey) {
      return {
        success: true,
        apiKeyType: 'worker',
      };
    }
    
    return {
      success: false,
      error: AuthError.INVALID_API_KEY,
      message: 'Invalid API key',
    };
  } catch (error) {
    await logError({
      level: 'error',
      source: 'auth',
      function_name: 'validateApiKey',
      message: 'Authentication validation failed',
      error_type: 'AuthError',
      stack_trace: error instanceof Error ? error.stack : undefined,
    });
    
    return {
      success: false,
      error: AuthError.INVALID_API_KEY,
      message: 'Authentication failed',
    };
  }
}

/**
 * Extracts API key from Authorization header
 * Supports both "Bearer <token>" and plain token formats
 */
function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.trim().split(' ');
  
  // Handle "Bearer <token>" format
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  
  // Handle plain token format
  if (parts.length === 1) {
    return parts[0];
  }
  
  return null;
}

/**
 * Validates request signature using HMAC
 * 
 * Uses HMAC-SHA256 to verify request integrity
 * Signature is calculated from: timestamp + method + path + body
 * 
 * @param req - The incoming request
 * @returns Authentication result
 */
export async function validateSignature(req: Request): Promise<AuthResult> {
  try {
    const signature = req.headers.get('x-signature');
    const timestamp = req.headers.get('x-timestamp');
    const apiKey = req.headers.get('x-api-key');
    
    if (!signature || !timestamp || !apiKey) {
      return {
        success: false,
        error: AuthError.MISSING_API_KEY,
        message: 'Signature, timestamp, and API key are required',
      };
    }
    
    // Check timestamp freshness (prevent replay attacks)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 300; // 5 minutes
    
    if (Math.abs(currentTime - requestTime) > maxAge) {
      return {
        success: false,
        error: AuthError.EXPIRED_API_KEY,
        message: 'Request timestamp is too old',
      };
    }
    
    // Get signing secret from environment
    const signingSecret = Deno.env.get('SIGNING_SECRET');
    if (!signingSecret) {
      return {
        success: false,
        error: AuthError.INVALID_SIGNATURE,
        message: 'Signing secret not configured',
      };
    }
    
    // Calculate expected signature
    const method = req.method;
    const path = new URL(req.url).pathname;
    const body = await req.clone().text();
    
    const payload = `${timestamp}${method}${path}${body}`;
    const expectedSignature = await hmacSha256(signingSecret, payload);
    
    // Compare signatures using constant-time comparison
    if (!constantTimeCompare(signature, expectedSignature)) {
      return {
        success: false,
        error: AuthError.INVALID_SIGNATURE,
        message: 'Invalid signature',
      };
    }
    
    return {
      success: true,
      apiKeyType: 'service', // Signature-based auth implies service-level access
    };
  } catch (error) {
    await logError({
      level: 'error',
      source: 'auth',
      function_name: 'validateSignature',
      message: 'Signature validation failed',
      error_type: 'AuthError',
      stack_trace: error instanceof Error ? error.stack : undefined,
    });
    
    return {
      success: false,
      error: AuthError.INVALID_SIGNATURE,
      message: 'Signature validation failed',
    };
  }
}

/**
 * Calculates HMAC-SHA256 hash
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData
  );
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Middleware to authenticate requests
 * 
 * Supports both API key and signature-based authentication
 * Tries signature validation first, then falls back to API key validation
 * 
 * @param req - The incoming request
 * @returns Authentication result
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  // Try signature validation first (more secure)
  const signatureResult = await validateSignature(req);
  if (signatureResult.success) {
    return signatureResult;
  }
  
  // Fall back to API key validation
  const apiKeyResult = await validateApiKey(req);
  return apiKeyResult;
}

/**
 * Creates an unauthorized response
 */
export function createUnauthorizedResponse(authResult: AuthResult): Response {
  return new Response(
    JSON.stringify({
      error: authResult.message || 'Unauthorized',
      code: authResult.error,
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="LCL API", Bearer realm="LCL API"',
      },
    }
  );
}

/**
 * Creates a forbidden response
 */
export function createForbiddenResponse(message: string = 'Forbidden'): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code: 'FORBIDDEN',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Wraps an edge function handler with authentication
 * 
 * Automatically validates the request and returns 401 if authentication fails
 * 
 * @param handler - The handler function to wrap
 * @param options - Authentication options
 * @returns Wrapped handler function
 */
export function withAuth<T extends any[]>(
  handler: (req: Request, ...args: T) => Promise<Response>,
  options: {
    requireSignature?: boolean;
    allowedKeyTypes?: Array<'service' | 'admin' | 'worker'>;
  } = {}
) {
  return async (req: Request, ...args: T): Promise<Response> => {
    const authResult = options.requireSignature
      ? await validateSignature(req)
      : await authenticateRequest(req);
    
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult);
    }
    
    // Check if the API key type is allowed
    if (options.allowedKeyTypes && authResult.apiKeyType) {
      if (!options.allowedKeyTypes.includes(authResult.apiKeyType)) {
        return createForbiddenResponse('Insufficient permissions');
      }
    }
    
    // Call the original handler
    return handler(req, ...args);
  };
}
