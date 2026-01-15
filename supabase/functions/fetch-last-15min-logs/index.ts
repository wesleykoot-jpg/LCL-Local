// Comprehensive log fetcher for Supabase
// Fetches from: error_logs table, scrape_jobs, discovery_jobs, source errors,
// AND Supabase Analytics (edge function execution logs)
// Default window: 15 minutes (configurable via ?minutes=N, max 1440 = 24h)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_MINUTES = 15;
const MAX_MINUTES = 1440; // 24 hours

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  source: string;
  function_name?: string;
  message: string;
  error_code?: string;
  error_type?: string;
  context?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse optional minutes query param (support both query string and URL path)
    const url = new URL(req.url);
    const minutesParam = Number(url.searchParams.get('minutes') ?? DEFAULT_MINUTES);
    const minutes = Number.isFinite(minutesParam) && minutesParam > 0 
      ? Math.min(minutesParam, MAX_MINUTES) 
      : DEFAULT_MINUTES;

    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60 * 1000).toISOString();
    const to = now.toISOString();

    const allLogs: LogEntry[] = [];

    // ===== 1. Fetch from centralized error_logs table =====
    try {
      const { data: errorLogs, error: errorLogsErr } = await supabase
        .from('error_logs')
        .select('*')
        .gte('timestamp', from)
        .order('timestamp', { ascending: false })
        .limit(500);

      if (errorLogsErr) {
        console.error('[fetch-logs] error_logs query failed:', errorLogsErr.message);
      } else {
        for (const log of errorLogs || []) {
          allLogs.push({
            timestamp: log.timestamp,
            level: log.level || 'error',
            source: log.source || 'unknown',
            function_name: log.function_name,
            message: log.message,
            error_code: log.error_code,
            error_type: log.error_type,
            context: log.context,
          });
        }
      }
    } catch (err) {
      console.error('[fetch-logs] error_logs query exception:', err);
    }

    // ===== 2. Fetch scrape job errors =====
    try {
      const { data: jobs } = await supabase
        .from('scrape_jobs')
        .select('id, source_id, status, attempts, events_scraped, events_inserted, error_message, created_at, started_at, completed_at')
        .gte('created_at', from)
        .order('created_at', { ascending: false })
        .limit(300);

      // Get source names
      const sourceIds = [...new Set((jobs || []).map(j => j.source_id))];
      const { data: sources } = await supabase
        .from('scraper_sources')
        .select('id, name')
        .in('id', sourceIds.length > 0 ? sourceIds : ['__none__']);
      
      const sourceMap = new Map((sources || []).map(s => [s.id, s.name]));

      for (const job of jobs || []) {
        const sourceName = sourceMap.get(job.source_id) || 'Unknown';
        
        if (job.status === 'failed') {
          allLogs.push({
            timestamp: job.completed_at || job.created_at,
            level: 'error',
            source: 'scrape-job',
            function_name: 'scrape-worker',
            message: `Job failed for "${sourceName}": ${job.error_message || 'Unknown error'}`,
            context: { source_id: job.source_id, job_id: job.id, attempts: job.attempts }
          });
        } else if (job.status === 'completed') {
          // Mark as warning if no events were inserted (potential issue)
          const noEventsInserted = (job.events_scraped || 0) > 0 && (job.events_inserted || 0) === 0;
          allLogs.push({
            timestamp: job.completed_at || job.created_at,
            level: noEventsInserted ? 'warn' : 'info',
            source: 'scrape-job',
            function_name: 'scrape-worker',
            message: noEventsInserted
              ? `⚠ "${sourceName}": scraped ${job.events_scraped} but inserted 0 (possible duplicates/conflicts)`
              : `✓ "${sourceName}": scraped ${job.events_scraped}, inserted ${job.events_inserted}`,
            context: { source_id: job.source_id, job_id: job.id }
          });
        } else if (job.status === 'processing') {
          allLogs.push({
            timestamp: job.started_at || job.created_at,
            level: 'info',
            source: 'scrape-job',
            function_name: 'scrape-worker',
            message: `⟳ "${sourceName}": processing (attempt ${job.attempts})`,
            context: { source_id: job.source_id, job_id: job.id }
          });
        }
      }
    } catch (err) {
      console.error('[fetch-logs] scrape_jobs query exception:', err);
    }

    // ===== 3. Fetch discovery job errors =====
    try {
      const { data: discoveryJobs } = await supabase
        .from('discovery_jobs')
        .select('*')
        .gte('created_at', from)
        .order('created_at', { ascending: false })
        .limit(100);

      for (const dj of discoveryJobs || []) {
        if (dj.status === 'failed') {
          allLogs.push({
            timestamp: dj.updated_at || dj.created_at,
            level: 'error',
            source: 'discovery-job',
            function_name: 'source-discovery',
            message: `Discovery failed for ${dj.municipality}: ${dj.error_message || 'Unknown error'}`,
            context: { job_id: dj.id, province: dj.province }
          });
        } else if (dj.status === 'completed') {
          // Log as warning if found sources but couldn't add any (409 conflicts)
          const isConflict = (dj.sources_found || 0) > 0 && (dj.sources_added || 0) === 0;
          allLogs.push({
            timestamp: dj.completed_at || dj.created_at,
            level: isConflict ? 'warn' : 'info',
            source: 'discovery-job',
            function_name: 'source-discovery',
            message: isConflict 
              ? `⚠ ${dj.municipality}: found ${dj.sources_found} but added 0 (duplicates/conflicts)`
              : `✓ ${dj.municipality}: found ${dj.sources_found || 0}, added ${dj.sources_added || 0}`,
            context: { job_id: dj.id, sources_found: dj.sources_found, sources_added: dj.sources_added }
          });
        }
      }
    } catch (err) {
      console.error('[fetch-logs] discovery_jobs query exception:', err);
    }

    // ===== 4. Fetch source-level errors =====
    try {
      const { data: sourcesWithErrors } = await supabase
        .from('scraper_sources')
        .select('id, name, url, last_error, consecutive_failures, auto_disabled, updated_at')
        .not('last_error', 'is', null)
        .gte('updated_at', from)
        .order('updated_at', { ascending: false })
        .limit(100);

      for (const source of sourcesWithErrors || []) {
        allLogs.push({
          timestamp: source.updated_at,
          level: source.auto_disabled ? 'error' : 'warn',
          source: 'scraper-source',
          function_name: 'scrape-worker',
          message: source.auto_disabled 
            ? `Source "${source.name}" auto-disabled: ${source.last_error}`
            : `Source "${source.name}" error (${source.consecutive_failures} failures): ${source.last_error}`,
          error_code: source.consecutive_failures?.toString(),
          context: { source_id: source.id, url: source.url, auto_disabled: source.auto_disabled }
        });
      }
    } catch (err) {
      console.error('[fetch-logs] scraper_sources query exception:', err);
    }

    // ===== 5. Check for recent events with duplicate fingerprints (indicates 409 conflicts) =====
    try {
      const { data: recentEvents } = await supabase
        .from('events')
        .select('event_fingerprint')
        .gte('created_at', from)
        .not('event_fingerprint', 'is', null)
        .limit(1000);

      const fingerprintCounts = new Map<string, number>();
      for (const evt of recentEvents || []) {
        if (evt.event_fingerprint) {
          fingerprintCounts.set(evt.event_fingerprint, (fingerprintCounts.get(evt.event_fingerprint) || 0) + 1);
        }
      }

      const duplicates = [...fingerprintCounts.entries()].filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        allLogs.push({
          timestamp: now.toISOString(),
          level: 'warn',
          source: 'data-quality',
          function_name: 'event-dedup',
          message: `${duplicates.length} events with duplicate fingerprints detected in last ${minutes} min`,
          context: { duplicate_count: duplicates.length, sample_fingerprints: duplicates.slice(0, 5).map(d => d[0]) }
        });
      }
    } catch (err) {
      console.error('[fetch-logs] events fingerprint check exception:', err);
    }

    // ===== 6. Fetch events that failed to insert (check for null source_id which might indicate issues) =====
    try {
      const { data: orphanEvents, count: orphanCount } = await supabase
        .from('events')
        .select('id, title, created_at', { count: 'exact' })
        .is('source_id', null)
        .gte('created_at', from)
        .limit(10);

      if (orphanCount && orphanCount > 0) {
        allLogs.push({
          timestamp: now.toISOString(),
          level: 'warn',
          source: 'data-quality',
          function_name: 'event-insert',
          message: `${orphanCount} events without source_id (orphaned) in last ${minutes} min`,
          context: { 
            orphan_count: orphanCount, 
            sample_events: (orphanEvents || []).map(e => ({ id: e.id, title: e.title })).slice(0, 5)
          }
        });
      }
    } catch (err) {
      console.error('[fetch-logs] orphan events check exception:', err);
    }

    // ===== 7. Check for stale processing jobs (stuck jobs) =====
    try {
      const staleThreshold = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30 min ago
      
      const { data: staleJobs } = await supabase
        .from('scrape_jobs')
        .select('id, source_id, started_at, attempts')
        .eq('status', 'processing')
        .lt('started_at', staleThreshold)
        .limit(20);

      if (staleJobs && staleJobs.length > 0) {
        // Get source names for stale jobs
        const staleSourceIds = staleJobs.map(j => j.source_id);
        const { data: staleSources } = await supabase
          .from('scraper_sources')
          .select('id, name')
          .in('id', staleSourceIds);
        
        const staleSourceMap = new Map((staleSources || []).map(s => [s.id, s.name]));

        for (const job of staleJobs) {
          const sourceName = staleSourceMap.get(job.source_id) || 'Unknown';
          allLogs.push({
            timestamp: job.started_at,
            level: 'error',
            source: 'scrape-job',
            function_name: 'scrape-worker',
            message: `STALE JOB: "${sourceName}" stuck in processing for 30+ min`,
            error_type: 'StaleJob',
            context: { source_id: job.source_id, job_id: job.id, started_at: job.started_at }
          });
        }
      }
    } catch (err) {
      console.error('[fetch-logs] stale jobs check exception:', err);
    }

    // ===== 8. Check for sources that haven't been scraped recently (health check) =====
    try {
      const healthCheckThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
      
      const { data: inactiveSources, count: inactiveCount } = await supabase
        .from('scraper_sources')
        .select('id, name, last_scraped_at', { count: 'exact' })
        .eq('enabled', true)
        .or(`last_scraped_at.is.null,last_scraped_at.lt.${healthCheckThreshold}`)
        .limit(20);

      if (inactiveCount && inactiveCount > 5) {
        allLogs.push({
          timestamp: now.toISOString(),
          level: 'warn',
          source: 'health-check',
          function_name: 'scraper-monitoring',
          message: `${inactiveCount} enabled sources haven't been scraped in 48+ hours`,
          context: { 
            inactive_count: inactiveCount, 
            sample_sources: (inactiveSources || []).map(s => s.name).slice(0, 10)
          }
        });
      }
    } catch (err) {
      console.error('[fetch-logs] inactive sources check exception:', err);
    }

    // ===== 9. Aggregate event insertion stats =====
    try {
      const { count: totalEventsInserted } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', from);

      if (totalEventsInserted !== null) {
        allLogs.push({
          timestamp: now.toISOString(),
          level: 'info',
          source: 'stats',
          function_name: 'event-aggregation',
          message: `📊 Total events inserted in last ${minutes} min: ${totalEventsInserted}`,
          context: { total_events: totalEventsInserted, period_minutes: minutes }
        });
      }
    } catch (err) {
      console.error('[fetch-logs] event stats exception:', err);
    }

    // Sort all logs by timestamp descending
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate summary stats
    const summary = {
      total: allLogs.length,
      fatal: allLogs.filter(l => l.level === 'fatal').length,
      errors: allLogs.filter(l => l.level === 'error').length,
      warnings: allLogs.filter(l => l.level === 'warn').length,
      info: allLogs.filter(l => l.level === 'info').length,
      debug: allLogs.filter(l => l.level === 'debug').length,
      by_source: {} as Record<string, number>,
      by_function: {} as Record<string, number>,
    };

    // Group by source and function
    for (const log of allLogs) {
      summary.by_source[log.source] = (summary.by_source[log.source] || 0) + 1;
      if (log.function_name) {
        summary.by_function[log.function_name] = (summary.by_function[log.function_name] || 0) + 1;
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      from, 
      to,
      minutes,
      summary,
      logs: allLogs
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[fetch-logs] Fatal error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
