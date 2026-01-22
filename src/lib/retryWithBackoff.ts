/**
 * Retry logic with exponential backoff for transient failures
 * Handles network errors, timeouts, and temporary database issues
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000ms) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 10000ms) */
  maxDelayMs?: number;
  /** Function to determine if error should be retried */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback called before each retry */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Default retry logic - retries on network errors, timeouts, and 5xx errors
 */
export function defaultShouldRetry(error: unknown): boolean {
  const err = error as { message?: string; code?: string; status?: number };

  // Retry on network errors
  if (err.message?.toLowerCase().includes('network')) return true;
  if (err.message?.toLowerCase().includes('timeout')) return true;
  if (err.message?.toLowerCase().includes('fetch')) return true;

  // Retry on 5xx server errors
  if (err.status && err.status >= 500 && err.status < 600) return true;

  // Retry on specific Supabase error codes
  const retryableCodes = [
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
    '57P03', // cannot_connect_now
    '53300', // too_many_connections
  ];
  if (err.code && retryableCodes.includes(err.code)) return true;

  return false;
}

/**
 * Retries a function with exponential backoff
 * @param fn - The function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with function result or rejects after max retries
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if we've exhausted attempts or error is not retryable
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay; // ±30% jitter
      const delayWithJitter = delay + jitter;

      if (import.meta.env.DEV) {
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delayWithJitter)}ms`,
          error
        );
      }

      // Call onRetry callback if provided
      onRetry?.(attempt + 1, error);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
    }
  }

  throw lastError;
}

/**
 * Convenience function for retrying Supabase queries
 */
export async function retrySupabaseQuery<T>(
  queryFn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  return retryWithBackoff(queryFn, {
    maxRetries,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    shouldRetry: defaultShouldRetry,
  });
}
