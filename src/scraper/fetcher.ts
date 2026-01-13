/**
 * Single-request fetcher with conditional GET support.
 * Handles ETag, If-Modified-Since, and structured error responses.
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { DEFAULTS } from '../config/defaults';
import { parseRetryAfter } from '../lib/backoff';

export interface FetchResult {
  success: boolean;
  http_status: number | null;
  status_text?: string;
  etag?: string | null;
  last_modified?: string | null;
  body?: string | null;
  headers?: Record<string, any>;
  error?: string;
  retry_after?: number | null;
  raw_response_summary?: string;
}

export interface FetchOptions {
  url: string;
  userAgent: string;
  etag?: string | null;
  lastModified?: string | null;
  timeout?: number;
}

/**
 * Truncate body to max length
 */
function truncateBody(body: string, maxLength: number = DEFAULTS.MAX_BODY_LENGTH): string {
  if (body.length <= maxLength) {
    return body;
  }
  return body.substring(0, maxLength) + `\n... [truncated ${body.length - maxLength} chars]`;
}

/**
 * Fetch a URL with conditional GET headers
 */
export async function fetchUrl(options: FetchOptions): Promise<FetchResult> {
  const { url, userAgent, etag, lastModified, timeout = 30000 } = options;
  
  // Build headers
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
  };
  
  // Add conditional GET headers
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  
  if (lastModified) {
    headers['If-Modified-Since'] = lastModified;
  }
  
  try {
    const response: AxiosResponse = await axios.get(url, {
      headers,
      timeout,
      maxRedirects: 5,
      validateStatus: () => true, // Don't throw on any status code
    });
    
    // Extract headers
    const responseHeaders = response.headers || {};
    const responseEtag = typeof responseHeaders['etag'] === 'string' ? responseHeaders['etag'] : null;
    const responseLastModified = typeof responseHeaders['last-modified'] === 'string' ? responseHeaders['last-modified'] : null;
    const retryAfterHeader = typeof responseHeaders['retry-after'] === 'string' ? responseHeaders['retry-after'] : null;
    const retryAfter = parseRetryAfter(retryAfterHeader);
    
    // Handle 304 Not Modified
    if (response.status === 304) {
      return {
        success: true,
        http_status: 304,
        status_text: 'Not Modified',
        etag: etag || responseEtag,
        last_modified: lastModified || responseLastModified,
        body: null,
        headers: responseHeaders,
        raw_response_summary: 'Content not modified (304)',
      };
    }
    
    // Handle success responses (2xx)
    if (response.status >= 200 && response.status < 300) {
      const body = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
      
      return {
        success: true,
        http_status: response.status,
        status_text: response.statusText,
        etag: responseEtag,
        last_modified: responseLastModified,
        body: truncateBody(body),
        headers: responseHeaders,
        raw_response_summary: `Success: ${response.status} ${response.statusText}`,
      };
    }
    
    // Handle error responses (4xx, 5xx)
    const isTransient = response.status === 429 || 
                        response.status === 502 || 
                        response.status === 503 || 
                        response.status === 504;
    
    return {
      success: false,
      http_status: response.status,
      status_text: response.statusText,
      error: `HTTP ${response.status}: ${response.statusText}${isTransient ? ' (transient)' : ''}`,
      retry_after: retryAfter,
      headers: responseHeaders,
      raw_response_summary: `Error: ${response.status} ${response.statusText}`,
    };
    
  } catch (error) {
    // Handle network errors, timeouts, etc.
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED') {
        return {
          success: false,
          http_status: null,
          error: `Request timeout after ${timeout}ms`,
          raw_response_summary: 'Timeout',
        };
      }
      
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        return {
          success: false,
          http_status: null,
          error: `Network error: ${axiosError.code} - ${axiosError.message}`,
          raw_response_summary: 'Network error',
        };
      }
      
      return {
        success: false,
        http_status: axiosError.response?.status || null,
        error: axiosError.message,
        headers: axiosError.response?.headers,
        raw_response_summary: `Axios error: ${axiosError.message}`,
      };
    }
    
    // Unknown error
    return {
      success: false,
      http_status: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      raw_response_summary: 'Unknown error',
    };
  }
}

/**
 * Check if an error is transient and should be retried
 */
export function isTransientError(result: FetchResult): boolean {
  // Network errors and timeouts
  if (result.http_status === null) {
    return true;
  }
  
  // Transient HTTP status codes
  if (result.http_status === 429 ||  // Too Many Requests
      result.http_status === 502 ||  // Bad Gateway
      result.http_status === 503 ||  // Service Unavailable
      result.http_status === 504) {  // Gateway Timeout
    return true;
  }
  
  return false;
}
