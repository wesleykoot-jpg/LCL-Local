/**
 * Scraper observability utilities
 * Handles failure detection and logging for the self-healing scraper pipeline
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";

export interface ScraperFailureLog {
  source_id: string;
  url: string;
  error_type: 'no_events_found' | 'selector_failed' | 'parse_error' | 'fetch_error' | 'rate_limited';
  error_message?: string;
  raw_html?: string;
  selector_context?: Record<string, unknown>;
  events_expected?: number;
  events_found?: number;
  status_code?: number;
}

/**
 * Logs a scraper failure to the database for debugging
 */
export async function logScraperFailure(
  supabaseUrl: string,
  supabaseKey: string,
  failure: ScraperFailureLog
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .from('scraper_failures')
      .insert({
        source_id: failure.source_id,
        url: failure.url,
        error_type: failure.error_type,
        error_message: failure.error_message,
        raw_html: failure.raw_html,
        selector_context: failure.selector_context,
        events_expected: failure.events_expected || 0,
        events_found: failure.events_found || 0,
        status_code: failure.status_code,
      });

    if (error) {
      console.error('Failed to log scraper failure:', error);
    }
  } catch (err) {
    console.error('Error logging scraper failure:', err);
  }
}

/**
 * Gets the historical average event count for a source
 */
export async function getHistoricalEventCount(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string
): Promise<number> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .rpc('get_source_historical_event_count', {
        p_source_id: sourceId,
      });

    if (error) {
      console.error('Failed to get historical event count:', error);
      return 0;
    }

    return data || 0;
  } catch (err) {
    console.error('Error getting historical event count:', err);
    return 0;
  }
}

/**
 * Increases the rate limit for a source after a 403/429 response
 */
export async function increaseRateLimit(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string,
  statusCode: number
): Promise<void> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { error } = await supabase
      .rpc('increase_source_rate_limit', {
        p_source_id: sourceId,
        p_status_code: statusCode,
      });

    if (error) {
      console.error('Failed to increase rate limit:', error);
    }
  } catch (err) {
    console.error('Error increasing rate limit:', err);
  }
}

/**
 * Gets the effective rate limit for a source (considering dynamic adjustments)
 */
export async function getEffectiveRateLimit(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string
): Promise<number> {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase
      .rpc('get_effective_rate_limit', {
        p_source_id: sourceId,
      });

    if (error) {
      console.error('Failed to get effective rate limit:', error);
      return 200; // Default fallback
    }

    return data || 200;
  } catch (err) {
    console.error('Error getting effective rate limit:', err);
    return 200;
  }
}
