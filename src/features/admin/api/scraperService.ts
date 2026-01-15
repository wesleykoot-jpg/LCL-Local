import { supabase } from '@/integrations/supabase/client';

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
