/**
 * Scraper Insights Logger
 * 
 * Provides functions to log scraper run insights for debugging and
 * automatic strategy optimization.
 * 
 * @module _shared/scraperInsights
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import type { ExtractionStrategy, WaterfallResult } from "./dataExtractors.ts";
import type { CMSFingerprint } from "./cmsFingerprinter.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface ScraperInsightParams {
  /** Source ID */
  sourceId: string;
  /** Optional run ID for grouping */
  runId?: string;
  /** Waterfall extraction result */
  waterfallResult: WaterfallResult;
  /** CMS fingerprint result */
  cmsFingerprint?: CMSFingerprint;
  /** Total execution time */
  executionTimeMs: number;
  /** Fetch time */
  fetchTimeMs?: number;
  /** Parse time */
  parseTimeMs?: number;
  /** HTML size in bytes */
  htmlSizeBytes?: number;
  /** Error message if any */
  errorMessage?: string;
}

export interface InsightLogResult {
  success: boolean;
  insightId?: string;
  error?: string;
}

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

/**
 * Logs a scraper insight to the database.
 */
export async function logScraperInsight(
  supabase: SupabaseClient,
  params: ScraperInsightParams
): Promise<InsightLogResult> {
  try {
    const { waterfallResult, cmsFingerprint } = params;
    
    // Determine status
    let status: 'success' | 'partial' | 'failure' = 'failure';
    if (waterfallResult.totalEvents > 0) {
      status = 'success';
    } else if (waterfallResult.winningStrategy) {
      status = 'partial';
    }
    
    // Build strategy trace JSONB
    const strategyTrace: Record<string, unknown> = {};
    for (const [strategy, trace] of Object.entries(waterfallResult.strategyTrace)) {
      strategyTrace[strategy] = {
        tried: trace.tried,
        found: trace.found,
        error: trace.error,
        time_ms: trace.timeMs,
      };
    }
    
    const { data, error } = await supabase.rpc('log_scraper_insight', {
      p_source_id: params.sourceId,
      p_status: status,
      p_total_events_found: waterfallResult.totalEvents,
      p_winning_strategy: waterfallResult.winningStrategy,
      p_strategy_trace: strategyTrace,
      p_detected_cms: cmsFingerprint?.cms || null,
      p_detected_framework: cmsFingerprint?.version || cmsFingerprint?.cms || null,
      p_execution_time_ms: params.executionTimeMs,
      p_fetch_time_ms: params.fetchTimeMs || null,
      p_parse_time_ms: params.parseTimeMs || null,
      p_html_size_bytes: params.htmlSizeBytes || null,
      p_has_hydration_data: cmsFingerprint?.detectedDataSources.hasHydrationData || false,
      p_has_json_ld: cmsFingerprint?.detectedDataSources.hasJsonLd || false,
      p_has_rss_feed: cmsFingerprint?.detectedDataSources.hasRssFeed || false,
      p_has_ics_feed: cmsFingerprint?.detectedDataSources.hasIcsFeed || false,
      p_error_message: params.errorMessage || null,
      p_run_id: params.runId || null,
    });
    
    if (error) {
      console.warn('Failed to log scraper insight:', error.message);
      return { success: false, error: error.message };
    }
    
    return { success: true, insightId: data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('Failed to log scraper insight:', message);
    return { success: false, error: message };
  }
}

/**
 * Updates a source's preferred method and CMS detection.
 */
export async function updateSourceFromInsight(
  supabase: SupabaseClient,
  sourceId: string,
  winningStrategy: ExtractionStrategy | null,
  cmsFingerprint?: CMSFingerprint
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    if (cmsFingerprint) {
      updateData.detected_cms = cmsFingerprint.cms;
      updateData.detected_framework_version = cmsFingerprint.version;
    }
    
    // Note: preferred_method is auto-updated by the log_scraper_insight function
    // after 3 consecutive successes with the same strategy
    
    const { error } = await supabase
      .from('scraper_sources')
      .update(updateData)
      .eq('id', sourceId);
    
    if (error) {
      console.warn('Failed to update source:', error.message);
      return false;
    }
    
    return true;
  } catch (error) {
    console.warn('Failed to update source:', error);
    return false;
  }
}

/**
 * Gets the most recent insights for a source.
 */
export async function getRecentInsights(
  supabase: SupabaseClient,
  sourceId: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  status: string;
  winning_strategy: string | null;
  total_events_found: number;
  created_at: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('scraper_insights')
      .select('id, status, winning_strategy, total_events_found, created_at')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.warn('Failed to get recent insights:', error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.warn('Failed to get recent insights:', error);
    return [];
  }
}

/**
 * Checks if a source has consistent failures and should be investigated.
 */
export async function checkSourceHealth(
  supabase: SupabaseClient,
  sourceId: string
): Promise<{
  healthy: boolean;
  consecutiveFailures: number;
  suggestion?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('scraper_insights')
      .select('status, winning_strategy, detected_framework')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error || !data || data.length === 0) {
      return { healthy: true, consecutiveFailures: 0 };
    }
    
    // Count consecutive failures
    let consecutiveFailures = 0;
    for (const insight of data) {
      if (insight.status === 'failure') {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    
    const healthy = consecutiveFailures < 3;
    let suggestion: string | undefined;
    
    if (!healthy) {
      const lastSuccess = data.find(i => i.status === 'success');
      if (lastSuccess?.winning_strategy) {
        suggestion = `Last successful strategy was ${lastSuccess.winning_strategy}. Consider updating preferred_method.`;
      } else {
        suggestion = 'No recent successes. Consider checking if source structure changed or requires JS rendering.';
      }
    }
    
    return { healthy, consecutiveFailures, suggestion };
  } catch (error) {
    console.warn('Failed to check source health:', error);
    return { healthy: true, consecutiveFailures: 0 };
  }
}
