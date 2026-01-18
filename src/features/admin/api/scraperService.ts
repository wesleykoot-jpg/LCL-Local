import { supabase } from '@/integrations/supabase/client';

// Constants
export const MAX_RETRY_ATTEMPTS = 3;

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_scraped_at: string | null;
  last_success: boolean | null;
  total_events_scraped: number | null;
  consecutive_failures: number | null;
  last_error: string | null;
  auto_disabled: boolean | null;
  last_rate_limit_remaining: number | null;
  last_rate_limit_reset_ts: string | null;
  last_rate_limit_retry_after_seconds: number | null;
}

export interface SourceResult {
  sourceId: string;
  sourceName: string;
  totalScraped: number;
  parsedByAI: number;
  inserted: number;
  skipped: number;
  failed: number;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  sources?: SourceResult[];
  totals?: {
    totalScraped: number;
    parsedByAI: number;
    inserted: number;
    skipped: number;
    failed: number;
  };
  // Legacy fields for backward compatibility
  totalScraped?: number;
  parsedByAI?: number;
  inserted?: number;
  skipped?: number;
  failed?: number;
  message?: string;
  error?: string;
}

export interface DryRunResult {
  success: boolean;
  sourceId: string;
  sourceName: string;
  eventsFound: number;
  sampleEvents?: Array<{
    title: string;
    date: string;
    venue: string;
  }>;
  error?: string;
}

export interface CoordinatorResult {
  success: boolean;
  jobsCreated?: number;
  error?: string;
}

/**
 * Helper function to safely extract inserted count from ScrapeResult
 * Handles both new format (result.totals.inserted) and legacy format (result.inserted)
 */
export function getInsertedCount(result: ScrapeResult): number {
  return result.totals?.inserted ?? result.inserted ?? 0;
}

/**
 * Helper function to safely extract total scraped count from ScrapeResult
 */
export function getTotalScrapedCount(result: ScrapeResult): number {
  return result.totals?.totalScraped ?? result.totalScraped ?? 0;
}

/**
 * Fetch all scraper sources with their stats
 */
export async function getSources(): Promise<ScraperSource[]> {
  const { data, error } = await supabase
    .from('scraper_sources')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return (data || []) as ScraperSource[];
}

/**
 * Toggle source enabled status
 */
export async function toggleSource(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('scraper_sources')
    .update({ 
      enabled,
      // Reset auto_disabled if manually re-enabling
      auto_disabled: enabled ? false : undefined,
      consecutive_failures: enabled ? 0 : undefined,
    })
    .eq('id', id);
  
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Run a dry-run test on a specific source
 */
export async function testSource(sourceId: string): Promise<DryRunResult> {
  const { data, error } = await supabase.functions.invoke('scrape-events', {
    body: {
      dryRun: true,
      sourceId,
      limit: 5,
    },
  });
  
  if (error) {
    return {
      success: false,
      sourceId,
      sourceName: 'Unknown',
      eventsFound: 0,
      error: error.message,
    };
  }
  
  // Extract relevant info from the response
  const source = data?.sources?.[0];
  return {
    success: data?.success ?? false,
    sourceId,
    sourceName: source?.sourceName ?? 'Unknown',
    eventsFound: source?.totalScraped ?? 0,
    sampleEvents: source?.sampleEvents,
    error: source?.error || data?.error,
  };
}

/**
 * Run full scrape on all enabled sources or specific sources
 */
export async function triggerScraper(sourceIds?: string[]): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-events', {
    body: sourceIds ? { sourceIds } : undefined,
  });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data as ScrapeResult;
}

/**
 * Disable sources with too many consecutive failures
 */
export async function disableBrokenSources(threshold: number = 3): Promise<number> {
  // Get sources that meet the failure threshold
  const { data: brokenSources, error: fetchError } = await supabase
    .from('scraper_sources')
    .select('id')
    .eq('enabled', true)
    .gte('consecutive_failures', threshold);
  
  if (fetchError) {
    throw new Error(fetchError.message);
  }
  
  if (!brokenSources || brokenSources.length === 0) {
    return 0;
  }
  
  // Disable them
  const ids = brokenSources.map(s => s.id);
  const { error: updateError } = await supabase
    .from('scraper_sources')
    .update({ enabled: false, auto_disabled: true })
    .in('id', ids);
  
  if (updateError) {
    throw new Error(updateError.message);
  }
  
  return ids.length;
}

/**
 * Reset health stats for a source (useful when fixing issues)
 */
export async function resetSourceHealth(id: string): Promise<void> {
  const { error } = await supabase
    .from('scraper_sources')
    .update({
      consecutive_failures: 0,
      last_error: null,
      auto_disabled: false,
    })
    .eq('id', id);
  
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateSourceConfig(id: string, config: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('scraper_sources')
    .update({ config })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function triggerCoordinator(): Promise<CoordinatorResult> {
  const { data, error } = await supabase.functions.invoke('scrape-coordinator');

  if (error) {
    return { success: false, error: error.message };
  }

  return (data as CoordinatorResult) ?? { success: false, error: 'Unknown error' };
}

export async function pruneEvents(): Promise<number> {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .lt('event_date', new Date().toISOString())
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  return data?.length ?? 0;
}

export interface DiscoveryResult {
  success: boolean;
  sourcesDiscovered?: number;
  sourcesEnabled?: number;
  municipalities?: string[];
  error?: string;
}

export interface DiscoveredSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  auto_discovered: boolean;
  location_name: string | null;
  created_at: string;
}

/**
 * Trigger source discovery for Dutch municipalities
 */
export async function triggerSourceDiscovery(options?: {
  maxMunicipalities?: number;
  minPopulation?: number;
}): Promise<DiscoveryResult> {
  const { data, error } = await supabase.functions.invoke('source-discovery', {
    body: options,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return data as DiscoveryResult;
}

/**
 * Get recently discovered sources
 */
export async function getDiscoveredSources(): Promise<DiscoveredSource[]> {
  const { data, error } = await supabase
    .from('scraper_sources')
    .select('id, name, url, enabled, auto_discovered, location_name, created_at')
    .eq('auto_discovered', true)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as DiscoveredSource[];
}

export interface LogEntry {
  timestamp: string;
  level?: string;
  message?: string;
  function_name?: string;
  [key: string]: unknown;
}

export interface LogsResult {
  success: boolean;
  from?: string;
  to?: string;
  minutes?: number;
  count?: number;
  summary?: {
    total: number;
    fatal: number;
    errors: number;
    warnings: number;
    info: number;
    debug: number;
    by_source: Record<string, number>;
    by_function: Record<string, number>;
  };
  logs?: LogEntry[];
  error?: string;
}

export interface TestResult {
  test: string;
  status: "PASS" | "FAIL";
  message?: string;
  details?: Record<string, unknown>;
}

export interface IntegrityTestReport {
  success: boolean;
  timestamp: string;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
}

/**
 * Fetch recent Supabase logs (errors, jobs, discovery)
 */
export async function fetchLogs(minutes: number = 60): Promise<LogsResult> {
  // Use fetch directly to support query params
  const url = `https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/fetch-last-15min-logs?minutes=${minutes}`;
  
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA'}`,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA',
    }
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  return {
    success: true,
    from: data?.from,
    to: data?.to,
    minutes: data?.minutes,
    count: data?.summary?.total ?? (Array.isArray(data?.logs) ? data.logs.length : 0),
    summary: data?.summary,
    logs: data?.logs || [],
  };
}

/**
 * Run scraper integrity tests
 * Tests: Soccer categorization, failover, rate limiting, 404 handling, time parsing, idempotency
 */
export async function runScraperTests(): Promise<IntegrityTestReport> {
  const { data, error } = await supabase.functions.invoke('scrape-events', {
    body: {
      action: 'run-integrity-test',
    },
  });

  if (error) {
    // Return a failed report
    return {
      success: false,
      timestamp: new Date().toISOString(),
      results: [{
        test: 'Connection',
        status: 'FAIL',
        message: error.message,
      }],
      summary: {
        total: 1,
        passed: 0,
        failed: 1,
      },
    };
  }

  return data as IntegrityTestReport;
}

/**
 * Trigger run-scraper edge function
 */
export async function triggerRunScraper(sourceIds?: string[]): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('run-scraper', {
    body: sourceIds ? { sourceIds } : undefined,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as ScrapeResult;
}

/**
 * Trigger scrape-worker edge function for specific source
 */
export async function triggerScrapeWorker(sourceId: string): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-worker', {
    body: { sourceId },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as ScrapeResult;
}

/**
 * Retry failed jobs
 */
export async function retryFailedJobs(): Promise<{ success: boolean; retriedCount: number; error?: string }> {
  try {
    // Get all failed jobs
    const { data: failedJobs, error: fetchError } = await supabase
      .from('scrape_jobs')
      .select('id, source_id')
      .eq('status', 'failed')
      .lt('attempts', MAX_RETRY_ATTEMPTS); // Only retry if attempts < MAX_RETRY_ATTEMPTS

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!failedJobs || failedJobs.length === 0) {
      return { success: true, retriedCount: 0 };
    }

    // Reset them to pending
    const { error: updateError } = await supabase
      .from('scrape_jobs')
      .update({ 
        status: 'pending',
        error_message: null,
      })
      .in('id', failedJobs.map(j => j.id));

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { success: true, retriedCount: failedJobs.length };
  } catch (error) {
    return {
      success: false,
      retriedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Queue specific sources for scraping
 */
export async function queueSourcesForScraping(sourceIds: string[]): Promise<{ success: boolean; jobsCreated: number; error?: string }> {
  try {
    const jobs = sourceIds.map(sourceId => ({
      source_id: sourceId,
      status: 'pending',
      attempts: 0,
      events_scraped: 0,
      events_inserted: 0,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('scrape_jobs')
      .insert(jobs)
      .select('id');

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, jobsCreated: data?.length ?? 0 };
  } catch (error) {
    return {
      success: false,
      jobsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get detailed job information
 */
export async function getJobDetails(jobId: string) {
  const { data, error } = await supabase
    .from('scrape_jobs')
    .select('*, scraper_sources(name, url)')
    .eq('id', jobId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Trigger scrape for selected sources (bypassing queue)
 * Uses the scrape-events edge function with specific sourceIds.
 * This allows immediate execution of scraping for chosen sources without going through the job queue.
 */
export async function triggerSelectedSources(sourceIds: string[]): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-events', {
    body: { sourceIds },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as ScrapeResult;
}
