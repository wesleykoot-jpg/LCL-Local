/**
 * Dead Letter Queue (DLQ) Module for Failed Pipeline Items
 * 
 * Provides a persistent store for failed pipeline items with:
 * - Full context preservation for debugging
 * - Automatic retry scheduling with exponential backoff
 * - Manual resolution tracking
 * 
 * @module _shared/dlq
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import type { DLQStage, DLQStatus, DeadLetterItem } from "./types.ts";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG = {
  /** Maximum retry attempts */
  maxRetries: 3,
  /** Base delay for first retry (1 hour) */
  baseRetryDelayMs: 60 * 60 * 1000,
  /** Alert threshold - Slack alert when DLQ size exceeds this */
  alertThreshold: 50,
  /** Initial retry count for new items */
  initialRetryCount: 0,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSupabaseClient(url: string, key: string) {
  return createClient(url, key);
}

/**
 * Calculate next retry time with exponential backoff.
 */
function calculateNextRetry(retryCount: number): Date {
  const delayMs = DEFAULT_CONFIG.baseRetryDelayMs * Math.pow(2, retryCount);
  return new Date(Date.now() + delayMs);
}

// ============================================================================
// DLQ OPERATIONS
// ============================================================================

/**
 * Add a failed item to the dead letter queue.
 * 
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Service role key
 * @param item - The failed item details
 * @returns The created DLQ item ID, or null on failure
 */
export async function addToDLQ(
  supabaseUrl: string,
  supabaseKey: string,
  item: {
    jobId?: string;
    sourceId?: string;
    stage: DLQStage;
    errorType?: string;
    errorMessage?: string;
    errorStack?: string;
    payload?: Record<string, unknown>;
  }
): Promise<string | null> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('dead_letter_queue')
    .insert({
      original_job_id: item.jobId || null,
      source_id: item.sourceId || null,
      stage: item.stage,
      error_type: item.errorType || null,
      error_message: item.errorMessage || null,
      error_stack: item.errorStack || null,
      payload: item.payload || null,
      retry_count: DEFAULT_CONFIG.initialRetryCount,
      max_retries: DEFAULT_CONFIG.maxRetries,
      next_retry_at: calculateNextRetry(DEFAULT_CONFIG.initialRetryCount).toISOString(),
      status: 'pending'
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to add item to DLQ:', error.message);
    return null;
  }
  
  console.log(`Added to DLQ: ${data.id} (stage: ${item.stage}, error: ${item.errorType})`);
  return data.id;
}

/**
 * Get pending items that are ready for retry.
 */
export async function getItemsReadyForRetry(
  supabaseUrl: string,
  supabaseKey: string,
  limit: number = 10
): Promise<DeadLetterItem[]> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('dead_letter_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .lt('retry_count', DEFAULT_CONFIG.maxRetries)
    .order('next_retry_at', { ascending: true })
    .limit(limit);
  
  if (error) {
    console.error('Failed to get DLQ items for retry:', error.message);
    return [];
  }
  
  return (data || []) as DeadLetterItem[];
}

/**
 * Mark an item as being retried (updates retry count and next retry time).
 */
export async function markAsRetrying(
  supabaseUrl: string,
  supabaseKey: string,
  dlqId: string
): Promise<boolean> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  // First get current retry count
  const { data: current, error: fetchError } = await supabase
    .from('dead_letter_queue')
    .select('retry_count')
    .eq('id', dlqId)
    .single();
  
  if (fetchError || !current) {
    console.error('Failed to fetch DLQ item for retry:', fetchError?.message);
    return false;
  }
  
  const newRetryCount = current.retry_count + 1;
  const nextRetry = calculateNextRetry(newRetryCount);
  
  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: 'retrying',
      retry_count: newRetryCount,
      next_retry_at: nextRetry.toISOString()
    })
    .eq('id', dlqId);
  
  if (error) {
    console.error('Failed to mark DLQ item as retrying:', error.message);
    return false;
  }
  
  return true;
}

/**
 * Mark an item as resolved (successfully retried or manually fixed).
 */
export async function markAsResolved(
  supabaseUrl: string,
  supabaseKey: string,
  dlqId: string,
  notes?: string
): Promise<boolean> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolution_notes: notes || 'Automatically resolved on successful retry'
    })
    .eq('id', dlqId);
  
  if (error) {
    console.error('Failed to mark DLQ item as resolved:', error.message);
    return false;
  }
  
  console.log(`DLQ item ${dlqId} marked as resolved`);
  return true;
}

/**
 * Mark an item as discarded (giving up on retry).
 */
export async function markAsDiscarded(
  supabaseUrl: string,
  supabaseKey: string,
  dlqId: string,
  reason?: string
): Promise<boolean> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: 'discarded',
      resolved_at: new Date().toISOString(),
      resolution_notes: reason || 'Discarded after max retries'
    })
    .eq('id', dlqId);
  
  if (error) {
    console.error('Failed to mark DLQ item as discarded:', error.message);
    return false;
  }
  
  console.log(`DLQ item ${dlqId} marked as discarded: ${reason}`);
  return true;
}

/**
 * Reset an item back to pending status (for manual retry).
 */
export async function resetToPending(
  supabaseUrl: string,
  supabaseKey: string,
  dlqId: string
): Promise<boolean> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: 'pending',
      next_retry_at: new Date().toISOString(),  // Retry immediately
      resolved_at: null,
      resolution_notes: null
    })
    .eq('id', dlqId);
  
  if (error) {
    console.error('Failed to reset DLQ item to pending:', error.message);
    return false;
  }
  
  return true;
}

/**
 * Get DLQ summary statistics.
 */
export async function getDLQStats(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{
  pending: number;
  retrying: number;
  resolved: number;
  discarded: number;
  byStage: Record<string, number>;
  byErrorType: Record<string, number>;
}> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('dead_letter_queue')
    .select('status, stage, error_type');
  
  if (error) {
    console.error('Failed to get DLQ stats:', error.message);
    return {
      pending: 0,
      retrying: 0,
      resolved: 0,
      discarded: 0,
      byStage: {},
      byErrorType: {}
    };
  }
  
  const stats = {
    pending: 0,
    retrying: 0,
    resolved: 0,
    discarded: 0,
    byStage: {} as Record<string, number>,
    byErrorType: {} as Record<string, number>
  };
  
  for (const item of data || []) {
    // Count by status
    if (item.status === 'pending') stats.pending++;
    else if (item.status === 'retrying') stats.retrying++;
    else if (item.status === 'resolved') stats.resolved++;
    else if (item.status === 'discarded') stats.discarded++;
    
    // Count by stage (only pending/retrying)
    if (item.status === 'pending' || item.status === 'retrying') {
      stats.byStage[item.stage] = (stats.byStage[item.stage] || 0) + 1;
      
      if (item.error_type) {
        stats.byErrorType[item.error_type] = (stats.byErrorType[item.error_type] || 0) + 1;
      }
    }
  }
  
  return stats;
}

/**
 * Check if DLQ size exceeds alert threshold.
 */
export async function shouldAlertDLQ(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ shouldAlert: boolean; pendingCount: number }> {
  const stats = await getDLQStats(supabaseUrl, supabaseKey);
  const pendingCount = stats.pending + stats.retrying;
  
  return {
    shouldAlert: pendingCount > DEFAULT_CONFIG.alertThreshold,
    pendingCount
  };
}

/**
 * Get recent DLQ items for a specific source.
 */
export async function getDLQItemsForSource(
  supabaseUrl: string,
  supabaseKey: string,
  sourceId: string,
  limit: number = 10
): Promise<DeadLetterItem[]> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const { data, error } = await supabase
    .from('dead_letter_queue')
    .select('*')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('Failed to get DLQ items for source:', error.message);
    return [];
  }
  
  return (data || []) as DeadLetterItem[];
}

/**
 * Clean up old resolved/discarded items.
 * Should be run periodically (e.g., weekly).
 */
export async function cleanupOldItems(
  supabaseUrl: string,
  supabaseKey: string,
  daysOld: number = 30
): Promise<number> {
  const supabase = getSupabaseClient(supabaseUrl, supabaseKey);
  
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);
  
  const { data, error } = await supabase
    .from('dead_letter_queue')
    .delete()
    .in('status', ['resolved', 'discarded'])
    .lt('resolved_at', cutoff.toISOString())
    .select('id');
  
  if (error) {
    console.error('Failed to cleanup old DLQ items:', error.message);
    return 0;
  }
  
  const count = data?.length || 0;
  console.log(`Cleaned up ${count} old DLQ items`);
  return count;
}
