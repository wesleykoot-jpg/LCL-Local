// Fetch recent scraper activity logs from the database
// Returns recent scrape jobs and their status as operational logs
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

    // Parse optional minutes query param
    const url = new URL(req.url);
    const minutesParam = Number(url.searchParams.get('minutes') ?? DEFAULT_MINUTES);
    const minutes = Number.isFinite(minutesParam) && minutesParam > 0 ? Math.min(minutesParam, 60 * 24) : DEFAULT_MINUTES;

    const now = new Date();
    const from = new Date(now.getTime() - minutes * 60 * 1000).toISOString();
    const to = now.toISOString();

    const logs: LogEntry[] = [];

    // Fetch recent scrape jobs
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

    // Fetch recent discovery jobs
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

    // Sort all logs by timestamp descending
    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return new Response(JSON.stringify({ 
      success: true,
      from, 
      to, 
      count: logs.length, 
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
