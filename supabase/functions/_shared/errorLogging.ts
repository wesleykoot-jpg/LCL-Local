// Centralized error logging utility for edge functions
// Logs errors to the error_logs table for debugging and monitoring

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSlackNotification } from './slack.ts';

export interface ErrorLogEntry {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: string;
  function_name?: string;
  message: string;
  error_code?: string;
  error_type?: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  request_id?: string;
  user_agent?: string;
}

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      console.error('[ErrorLogging] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

function truncateValue(value: string | undefined, limit = 2500): string | undefined {
  if (!value) return undefined;
  return value.length > limit ? `${value.slice(0, limit)}…(truncated)` : value;
}

/**
 * Log an error to the centralized error_logs table
 * Non-blocking - won't throw if logging fails
 */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    const level = entry.level || 'error';
    const client = getSupabaseClient();
    if (!client) {
      console.error('[ErrorLogging] No client available, falling back to console:', entry);
    } else {
      // Use type assertion since error_logs table was just created and types may not be updated yet
      const { error } = await (client.from('error_logs') as any).insert({
        level,
        source: entry.source,
        function_name: entry.function_name,
        message: entry.message,
        error_code: entry.error_code,
        error_type: entry.error_type,
        stack_trace: entry.stack_trace,
        context: entry.context || {},
        request_id: entry.request_id,
        user_agent: entry.user_agent,
      });

      if (error) {
        console.error('[ErrorLogging] Failed to insert log:', error.message);
      }
    }

    // Forward errors to Slack for real-time visibility
    if (level === 'error' || level === 'fatal') {
      const contextString = truncateValue(
        entry.context ? JSON.stringify(entry.context, null, 2) : undefined,
        1800
      );
      const stackTrace = truncateValue(entry.stack_trace, 1800);

      const slackMessageLines = [
        `*${level.toUpperCase()}* ${entry.source}${entry.function_name ? ` › ${entry.function_name}` : ''}`,
        `*Message*: ${entry.message}`,
        entry.error_type ? `*Type*: ${entry.error_type}` : undefined,
        entry.error_code ? `*Code*: ${entry.error_code}` : undefined,
        entry.request_id ? `*Request ID*: ${entry.request_id}` : undefined,
        entry.user_agent ? `*User Agent*: ${entry.user_agent}` : undefined,
        contextString ? `*Context*:\n${contextString}` : undefined,
        stackTrace ? `*Stack*:\n${stackTrace}` : undefined,
      ].filter(Boolean);

      if (slackMessageLines.length > 0) {
        await sendSlackNotification(slackMessageLines.join('\n'), true);
      }
    }
  } catch (err) {
    console.error('[ErrorLogging] Exception during logging:', err);
  }
}

/**
 * Log an API/Supabase error with automatic extraction of error details
 */
export async function logSupabaseError(
  source: string,
  functionName: string,
  operation: string,
  error: { message?: string; code?: string; details?: string; hint?: string } | null,
  context?: Record<string, unknown>
): Promise<void> {
  if (!error) return;

  await logError({
    level: 'error',
    source,
    function_name: functionName,
    message: `${operation}: ${error.message || 'Unknown error'}`,
    error_code: error.code || undefined,
    error_type: 'PostgrestError',
    context: {
      ...context,
      details: error.details,
      hint: error.hint,
    },
  });
}

/**
 * Log a fetch/network error
 */
export async function logFetchError(
  source: string,
  functionName: string,
  url: string,
  error: Error | { message?: string; status?: number },
  context?: Record<string, unknown>
): Promise<void> {
  const status = 'status' in error ? error.status : undefined;
  
  await logError({
    level: 'error',
    source,
    function_name: functionName,
    message: `Fetch failed for ${url}: ${error.message || 'Unknown error'}`,
    error_code: status?.toString(),
    error_type: 'FetchError',
    stack_trace: error instanceof Error ? error.stack : undefined,
    context: {
      ...context,
      url,
      status,
    },
  });
}

/**
 * Log a warning (not a full error but notable)
 */
export async function logWarning(
  source: string,
  functionName: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    level: 'warn',
    source,
    function_name: functionName,
    message,
    context,
  });
}

/**
 * Log info-level message (for tracking important operations)
 */
export async function logInfo(
  source: string,
  functionName: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  await logError({
    level: 'info',
    source,
    function_name: functionName,
    message,
    context,
  });
}

/**
 * Wrap an async operation with automatic error logging
 */
export async function withErrorLogging<T>(
  source: string,
  functionName: string,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await logError({
      level: 'error',
      source,
      function_name: functionName,
      message: `${operation} failed: ${err instanceof Error ? err.message : String(err)}`,
      error_type: err instanceof Error ? err.constructor.name : 'UnknownError',
      stack_trace: err instanceof Error ? err.stack : undefined,
      context,
    });
    throw err;
  }
}
