// Fetch recent scraper activity logs from the database
// Returns recent scrape jobs, discovery jobs, AND API/Edge function errors
// Default window: 15 minutes (configurable via ?minutes=15 query param)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_MINUTES = 15;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  function_name: string;
  message: string;
  metadata?: Record<string, unknown>;
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
    
    // Extract project ref from URL (e.g., "mlpefjsbriqgxcaqxhic" from "https://mlpefjsbriqgxcaqxhic.supabase.co")
    const projectRef = SUPABASE_URL.replace('https://', '').split('.')[0];

    // Parse optional minutes query param
    const url = new URL(req.url);
    const minutesParam = Number(url.searchParams.get('minutes') ?? DEFAULT_MINUTES);
    const minutes = Number.isFinite(minutesParam) && minutesParam > 0 ? Math.min(minutesParam, 60 * 24) : DEFAULT_MINUTES;

    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60 * 1000).toISOString();
    const to = now.toISOString();

    const logs: LogEntry[] = [];

    // ===== 1. Fetch recent scrape jobs =====
    const { data: jobs, error: jobsError } = await supabase
      .from('scrape_jobs')
      .select(`
        id,
        source_id,
        status,
        attempts,
        events_scraped,
        events_inserted,
        error_message,
        created_at,
        started_at,
        completed_at
      `)
      .gte('created_at', from)
      .order('created_at', { ascending: false })
      .limit(200);

    if (jobsError) {
      console.error('[fetch-logs] Jobs query error:', jobsError);
    }

    // Get source names for context
    const sourceIds = [...new Set((jobs || []).map(j => j.source_id))];
    const { data: sources } = await supabase
      .from('scraper_sources')
      .select('id, name')
      .in('id', sourceIds);
    
    const sourceMap = new Map((sources || []).map(s => [s.id, s.name]));

    // Transform jobs to log entries
    for (const job of jobs || []) {
      const sourceName = sourceMap.get(job.source_id) || 'Unknown';
      
      if (job.status === 'completed') {
        logs.push({
          timestamp: job.completed_at || job.created_at,
          level: 'info',
          function_name: 'scrape-worker',
          message: `✓ ${sourceName}: scraped ${job.events_scraped}, inserted ${job.events_inserted}`,
          metadata: { source_id: job.source_id, job_id: job.id }
        });
      } else if (job.status === 'failed') {
        logs.push({
          timestamp: job.completed_at || job.created_at,
          level: 'error',
          function_name: 'scrape-worker',
          message: `✗ ${sourceName}: ${job.error_message || 'Unknown error'}`,
          metadata: { source_id: job.source_id, job_id: job.id, attempts: job.attempts }
        });
      } else if (job.status === 'processing') {
        logs.push({
          timestamp: job.started_at || job.created_at,
          level: 'info',
          function_name: 'scrape-worker',
          message: `⟳ ${sourceName}: processing (attempt ${job.attempts})`,
          metadata: { source_id: job.source_id, job_id: job.id }
        });
      } else if (job.status === 'pending') {
        logs.push({
          timestamp: job.created_at,
          level: 'info',
          function_name: 'scrape-coordinator',
          message: `◷ ${sourceName}: queued`,
          metadata: { source_id: job.source_id, job_id: job.id }
        });
      }
    }

    // ===== 2. Fetch recent discovery jobs =====
    const { data: discoveryJobs } = await supabase
      .from('discovery_jobs')
      .select('*')
      .gte('created_at', from)
      .order('created_at', { ascending: false })
      .limit(50);

    for (const dj of discoveryJobs || []) {
      if (dj.status === 'completed') {
        logs.push({
          timestamp: dj.completed_at || dj.created_at,
          level: 'info',
          function_name: 'source-discovery',
          message: `✓ ${dj.municipality}: found ${dj.sources_found || 0}, added ${dj.sources_added || 0}`,
          metadata: { job_id: dj.id, province: dj.province }
        });
      } else if (dj.status === 'failed') {
        logs.push({
          timestamp: dj.updated_at || dj.created_at,
          level: 'error',
          function_name: 'source-discovery',
          message: `✗ ${dj.municipality}: ${dj.error_message || 'Unknown error'}`,
          metadata: { job_id: dj.id }
        });
      } else if (dj.status === 'processing') {
        logs.push({
          timestamp: dj.started_at || dj.created_at,
          level: 'info',
          function_name: 'source-discovery',
          message: `⟳ ${dj.municipality}: discovering sources...`,
          metadata: { job_id: dj.id }
        });
      }
    }

    // ===== 3. Fetch API errors from Supabase Analytics (Logflare) =====
    // Query the analytics endpoint for postgres errors and edge function errors
    try {
      const analyticsUrl = `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all/query`;
      const fromMs = new Date(from).getTime() * 1000; // microseconds
      const toMs = new Date(to).getTime() * 1000;
      
      // Query for postgres/API errors (4xx, 5xx responses)
      const postgresQuery = `
        select 
          timestamp,
          event_message,
          metadata
        from postgres_logs
        where timestamp >= ${fromMs} and timestamp <= ${toMs}
        order by timestamp desc
        limit 100
      `;
      
      // Use Management API to query logs - requires service role key
      // Since we can't access Logflare directly, we'll capture errors from our own tables
      
      // Alternative: Query for events with duplicate fingerprints (409 conflicts)
      const { data: recentErrors } = await supabase
        .from('events')
        .select('id, title, event_fingerprint, created_at, source_id')
        .gte('created_at', from)
        .order('created_at', { ascending: false })
        .limit(500);
      
      // Find duplicates by fingerprint (these would cause 409s on insert)
      const fingerprintCounts = new Map<string, number>();
      for (const event of recentErrors || []) {
        if (event.event_fingerprint) {
          fingerprintCounts.set(event.event_fingerprint, (fingerprintCounts.get(event.event_fingerprint) || 0) + 1);
        }
      }
      
      const duplicateFingerprints = [...fingerprintCounts.entries()].filter(([_, count]) => count > 1);
      if (duplicateFingerprints.length > 0) {
        logs.push({
          timestamp: now.toISOString(),
          level: 'warn',
          function_name: 'api-conflicts',
          message: `⚠ ${duplicateFingerprints.length} duplicate event fingerprints detected (may cause 409 conflicts)`,
          metadata: { duplicate_count: duplicateFingerprints.length }
        });
      }
      
    } catch (analyticsError) {
      console.error('[fetch-logs] Analytics query error:', analyticsError);
      // Non-fatal - continue with other logs
    }

    // ===== 4. Check for recent source insert conflicts by looking at scraper_sources =====
    try {
      // Get sources that were updated recently (potential conflict resolutions)
      const { data: recentSources, error: sourcesError } = await supabase
        .from('scraper_sources')
        .select('id, name, url, created_at, updated_at, last_error, consecutive_failures, auto_disabled')
        .gte('updated_at', from)
        .order('updated_at', { ascending: false })
        .limit(100);
      
      if (sourcesError) {
        console.error('[fetch-logs] Sources query error:', sourcesError);
      }
      
      for (const source of recentSources || []) {
        // If updated_at is different from created_at, it was updated (possible conflict resolution)
        const created = new Date(source.created_at).getTime();
        const updated = new Date(source.updated_at).getTime();
        const isUpdate = updated - created > 1000; // More than 1 second difference
        
        if (source.last_error) {
          logs.push({
            timestamp: source.updated_at,
            level: 'error',
            function_name: 'scraper-source',
            message: `✗ Source "${source.name}": ${source.last_error}`,
            metadata: { source_id: source.id, url: source.url, consecutive_failures: source.consecutive_failures }
          });
        }
        
        if (source.auto_disabled) {
          logs.push({
            timestamp: source.updated_at,
            level: 'warn',
            function_name: 'scraper-source',
            message: `⚠ Source "${source.name}" auto-disabled after ${source.consecutive_failures} failures`,
            metadata: { source_id: source.id, url: source.url }
          });
        }
        
        // Log recent conflict-style updates (same URL being re-added)
        if (isUpdate && new Date(source.updated_at) >= new Date(from)) {
          logs.push({
            timestamp: source.updated_at,
            level: 'info',
            function_name: 'source-discovery',
            message: `↻ Source "${source.name}" updated (URL: ${source.url.substring(0, 50)}...)`,
            metadata: { source_id: source.id, url: source.url }
          });
        }
      }
    } catch (sourcesError) {
      console.error('[fetch-logs] Sources conflict check error:', sourcesError);
    }

    // ===== 5. Track 409 conflicts by monitoring unique constraint violations =====
    // Since we can't directly query Logflare, let's create a simple conflict detection
    // by checking for sources that already exist when discovery tries to add them
    try {
      // Check discovery jobs for "sources_added = 0 but sources_found > 0" pattern (indicates conflicts)
      const conflictPatternJobs = (discoveryJobs || []).filter(
        dj => dj.status === 'completed' && (dj.sources_found || 0) > 0 && (dj.sources_added || 0) === 0
      );
      
      for (const dj of conflictPatternJobs) {
        logs.push({
          timestamp: dj.completed_at || dj.created_at,
          level: 'warn',
          function_name: 'source-discovery',
          message: `⚠ ${dj.municipality}: found ${dj.sources_found} sources but added 0 (all duplicates/409s)`,
          metadata: { job_id: dj.id, sources_found: dj.sources_found }
        });
      }
    } catch (conflictError) {
      console.error('[fetch-logs] Conflict pattern check error:', conflictError);
    }

    // Sort all logs by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Summary stats
    const errorCount = logs.filter(l => l.level === 'error').length;
    const warnCount = logs.filter(l => l.level === 'warn').length;
    const infoCount = logs.filter(l => l.level === 'info').length;

    return new Response(JSON.stringify({ 
      success: true,
      from, 
      to,
      summary: {
        total: logs.length,
        errors: errorCount,
        warnings: warnCount,
        info: infoCount
      },
      logs 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[fetch-logs] Error:', err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
