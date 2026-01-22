/**
 * Centralized error handling for Supabase operations
 * Provides consistent error logging, monitoring, and user-friendly error messages
 */

export class SupabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
    public hint?: string
  ) {
    super(message);
    this.name = 'SupabaseError';
  }
}

export interface ErrorContext {
  operation: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Handles Supabase errors with consistent logging and monitoring
 * @param error - The error to handle
 * @param context - Context about where the error occurred
 * @returns Wrapped SupabaseError with additional context
 */
export function handleSupabaseError(
  error: unknown,
  context: ErrorContext
): SupabaseError {
  const supabaseError = error as {
    message?: string;
    code?: string;
    details?: unknown;
    hint?: string;
  };

  const wrappedError = new SupabaseError(
    supabaseError.message || 'Unknown Supabase error',
    supabaseError.code,
    supabaseError.details,
    supabaseError.hint
  );

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error(`[${context.operation}]`, {
      error: wrappedError,
      context,
      code: supabaseError.code,
      hint: supabaseError.hint,
    });
  }

  // In production, you would send to monitoring service (Sentry, LogRocket, etc.)
  if (import.meta.env.PROD) {
    // Example: Sentry.captureException(wrappedError, { tags: { ... }, extra: { ... } });
    console.error(`[${context.operation}] Production error:`, {
      message: wrappedError.message,
      code: wrappedError.code,
      operation: context.operation,
      component: context.component,
    });
  }

  return wrappedError;
}

/**
 * Gets a user-friendly error message for common Supabase errors
 */
export function getUserFriendlyErrorMessage(error: SupabaseError): string {
  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    '23505': 'This item already exists.',
    '23503': 'Cannot delete this item because it is being used elsewhere.',
    '42501': 'You do not have permission to perform this action.',
    'PGRST116': 'No results found.',
    'PGRST301': 'Invalid request parameters.',
  };

  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }

  // Check for common error patterns in message
  if (error.message.includes('JWT')) {
    return 'Your session has expired. Please log in again.';
  }

  if (error.message.includes('network') || error.message.includes('timeout')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Default message
  return 'An unexpected error occurred. Please try again.';
}
