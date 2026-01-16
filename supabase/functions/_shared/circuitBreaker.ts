/**
 * Circuit Breaker Module for Resilient Source Management
 * 
 * Implements the Circuit Breaker pattern to prevent repeated calls to failing sources.
 * State is persisted in the database for survival across edge function restarts.
 * 
 * States:
 * - CLOSED: Normal operation, requests allowed
 * - OPEN: Circuit tripped, requests blocked
 * - HALF_OPEN: Probing recovery, one request allowed
 * 
 * @module _shared/circuitBreaker
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import type { CircuitState, CircuitBreakerState } from "./types.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  /** Number of failures before circuit opens */
  failureThreshold: 5,
  /** Number of successes in HALF_OPEN to close circuit */
  successThreshold: 1,
  /** Base cooldown period in milliseconds */
  baseCooldownMs: 30 * 60 * 1000, // 30 minutes
  /** Maximum cooldown period (caps exponential backoff) */
  maxCooldownMs: 24 * 60 * 60 * 1000, // 24 hours
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSupabaseClient(url: string, key: string) {
  return createClient(url, key);
}

// ============================================================================
// CIRCUIT BREAKER OPERATIONS
// ============================================================================

/**
 * Check if a source's circuit breaker allows requests.
 * 
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Service role key
 * @param sourceId - Source UUID to check
 * @returns true if requests are allowed, false if blocked
 */
export async function isCircuitClosed(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string
): Promise<boolean> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('circuit_breaker_state')
    .select('state, cooldown_until')
    .eq('source_id', sourceId)
    .maybeSingle();
  
  if (error) {
    // On database error, fail open (allow request) but log prominently
    // This ensures the scraper continues working even if the circuit breaker
    // infrastructure has issues, but the error is visible for investigation
    console.error(
      `[CIRCUIT_BREAKER_DB_ERROR] Failed to check circuit for ${sourceId}: ${error.message}. ` +
      `Failing open (allowing request). This may mask persistent infrastructure issues.`
    );
    // Consider: In production, you might want to send a Slack alert here
    return true;
  }
  
  if (!data) {
    // No state exists = CLOSED (new source)
    return true;
  }
  
  if (data.state === 'CLOSED') {
    return true;
  }
  
  if (data.state === 'OPEN') {
    // Check if cooldown has elapsed
    if (data.cooldown_until && new Date(data.cooldown_until) <= new Date()) {
      // Transition to HALF_OPEN
      await transitionToHalfOpen(supabase, sourceId);
      return true; // Allow one probe request
    }
    return false; // Still in cooldown
  }
  
  if (data.state === 'HALF_OPEN') {
    return true; // Allow probe request
  }
  
  return true;
}

/**
 * Get the current circuit state for a source.
 */
export async function getCircuitState(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string
): Promise<CircuitBreakerState | null> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('circuit_breaker_state')
    .select('*')
    .eq('source_id', sourceId)
    .maybeSingle();
  
  if (error) {
    console.warn(`Failed to get circuit state for ${sourceId}:`, error.message);
    return null;
  }
  
  return data as CircuitBreakerState | null;
}

/**
 * Record a successful request. May close the circuit if in HALF_OPEN state.
 */
export async function recordSuccess(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string
): Promise<void> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  // Use the database function for atomic operation
  const { error } = await supabase.rpc('cb_record_success', {
    p_source_id: sourceId
  });
  
  if (error) {
    console.warn(`Failed to record success for ${sourceId}:`, error.message);
  }
}

/**
 * Record a failed request. May open the circuit if threshold reached.
 * 
 * @returns Object indicating if circuit was opened
 */
export async function recordFailure(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string,
  errorMessage?: string,
  failureThreshold: number = DEFAULT_CONFIG.failureThreshold
): Promise<{ circuitOpened: boolean; newState: CircuitState }> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  // Use the database function for atomic operation
  const { data, error } = await supabase.rpc('cb_record_failure', {
    p_source_id: sourceId,
    p_error_message: errorMessage || null,
    p_failure_threshold: failureThreshold
  });
  
  if (error) {
    console.warn(`Failed to record failure for ${sourceId}:`, error.message);
    return { circuitOpened: false, newState: 'CLOSED' };
  }
  
  const result = data?.[0];
  return {
    circuitOpened: result?.circuit_opened || false,
    newState: (result?.new_state as CircuitState) || 'CLOSED'
  };
}

/**
 * Transition circuit from OPEN to HALF_OPEN (internal use).
 */
// deno-lint-ignore no-explicit-any
async function transitionToHalfOpen(
  supabase: any,
  sourceId: string
): Promise<void> {
  const { error } = await supabase
    .from('circuit_breaker_state')
    .update({
      state: 'HALF_OPEN',
      updated_at: new Date().toISOString()
    })
    .eq('source_id', sourceId);
  
  if (error) {
    console.warn(`Failed to transition to HALF_OPEN for ${sourceId}:`, error.message);
  }
}

/**
 * Get all sources that are available (circuit not blocking).
 * Uses the source_health_status view for efficient querying.
 */
export async function getAvailableSources(
  supabaseUrl: string,
  supabaseKey: string
): Promise<string[]> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('source_health_status')
    .select('id')
    .eq('is_available', true);
  
  if (error) {
    console.warn(`Failed to get available sources:`, error.message);
    return [];
  }
  
  return (data || []).map(s => s.id);
}

/**
 * Get sources ordered by priority score.
 * Higher priority = should be processed first.
 */
export async function getSourcesByPriority(
  supabaseUrl: string,
  supabaseKey: string,
  limit?: number
): Promise<Array<{ id: string; name: string; priority_score: number }>> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  let query = supabase
    .from('source_health_status')
    .select('id, name, priority_score')
    .eq('is_available', true)
    .order('priority_score', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.warn(`Failed to get sources by priority:`, error.message);
    return [];
  }
  
  return data || [];
}

/**
 * Manually reset a circuit breaker to CLOSED state.
 * Use this for manual intervention after fixing an issue.
 */
export async function resetCircuit(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string,
  notes?: string
): Promise<boolean> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('circuit_breaker_state')
    .upsert({
      source_id: sourceId,
      state: 'CLOSED',
      failure_count: 0,
      success_count: 0,
      consecutive_opens: 0,
      cooldown_until: null,
      opened_at: null,
      updated_at: new Date().toISOString()
    });
  
  if (error) {
    console.error(`Failed to reset circuit for ${sourceId}:`, error.message);
    return false;
  }
  
  console.log(`Circuit reset to CLOSED for ${sourceId}${notes ? `: ${notes}` : ''}`);
  return true;
}

/**
 * Check all circuits and transition OPEN → HALF_OPEN where cooldown elapsed.
 * This should be called periodically (e.g., by cron job).
 */
export async function checkAllCooldowns(
  supabaseUrl: string,
  supabaseKey: string
): Promise<number> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase.rpc('cb_check_cooldown');
  
  if (error) {
    console.warn(`Failed to check cooldowns:`, error.message);
    return 0;
  }
  
  return data || 0;
}

/**
 * Get summary of circuit breaker states.
 */
export async function getCircuitSummary(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ closed: number; open: number; halfOpen: number }> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('circuit_breaker_state')
    .select('state');
  
  if (error) {
    console.warn(`Failed to get circuit summary:`, error.message);
    return { closed: 0, open: 0, halfOpen: 0 };
  }
  
  const summary = { closed: 0, open: 0, halfOpen: 0 };
  for (const row of data || []) {
    if (row.state === 'CLOSED') summary.closed++;
    else if (row.state === 'OPEN') summary.open++;
    else if (row.state === 'HALF_OPEN') summary.halfOpen++;
  }
  
  return summary;
}
