/**
 * AI Retry Worker: Process queued AI jobs with rate-limit handling
 * 
 * This Edge Function runs on a cron schedule (every 5 minutes) to:
 * 1. Claim pending AI jobs from the queue
 * 2. Process them with appropriate handlers
 * 3. Handle rate limits with exponential backoff
 * 4. Update job status and results
 * 
 * Job Types:
 * - analyze_js_heavy: Determine if page needs JS rendering
 * - enrich_social_five: Extract Social Five event data
 * - heal_selectors: Fix broken CSS selectors
 * - classify_vibe: Classify event vibe for persona matching
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzePageStrategy, cacheAnalysisResult } from "../_shared/analyzer-module.ts";
import { extractSocialFive, applyEnrichmentToStaging, classifyVibe } from "../_shared/social-five-enrichment.ts";
import { healSelectors } from "../_shared/selector-healer.ts";

// Configuration
const BATCH_SIZE = 5;
const MAX_PROCESSING_TIME_MS = 50000; // 50 seconds (Edge Function limit is 60s)

// Types
interface AiJob {
  id: string;
  job_type: 'analyze_js_heavy' | 'enrich_social_five' | 'heal_selectors' | 'classify_vibe';
  related_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  priority: number;
}

interface ProcessingStats {
  processed: number;
  succeeded: number;
  failed: number;
  rateLimited: number;
  skipped: number;
}

serve(async (req) => {
  const startTime = Date.now();
  const stats: ProcessingStats = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    rateLimited: 0,
    skipped: 0,
  };

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for manual invocation with specific job type
    let jobTypeFilter: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        jobTypeFilter = body.job_type || null;
      } catch {
        // Ignore JSON parse errors for cron invocations
      }
    }

    // Claim jobs from queue
    const { data: jobs, error: claimError } = await supabase.rpc('claim_ai_jobs', {
      p_job_type: jobTypeFilter,
      p_batch_size: BATCH_SIZE,
    });

    if (claimError) {
      console.error('Failed to claim jobs:', claimError);
      return new Response(JSON.stringify({ error: claimError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No jobs to process',
        stats 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[ai-retry-worker] Claimed ${jobs.length} jobs`);

    // Process each job
    for (const job of jobs as AiJob[]) {
      // Check time limit
      if (Date.now() - startTime > MAX_PROCESSING_TIME_MS) {
        console.log('[ai-retry-worker] Time limit reached, stopping');
        stats.skipped += jobs.length - stats.processed;
        break;
      }

      stats.processed++;

      try {
        await processJob(supabase, job);
        stats.succeeded++;

        // Mark job as completed
        await supabase.rpc('complete_ai_job', {
          p_job_id: job.id,
          p_result: { success: true, processedAt: new Date().toISOString() },
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[ai-retry-worker] Job ${job.id} failed:`, errorMessage);

        if (errorMessage === 'RATE_LIMITED') {
          stats.rateLimited++;
          // Mark as rate limited with longer backoff
          await supabase.rpc('fail_ai_job', {
            p_job_id: job.id,
            p_error: 'Rate limited by OpenAI',
            p_is_rate_limited: true,
          });
        } else {
          stats.failed++;
          // Mark as failed
          await supabase.rpc('fail_ai_job', {
            p_job_id: job.id,
            p_error: errorMessage,
            p_is_rate_limited: false,
          });
        }
      }

      // Small delay between jobs to be nice to OpenAI
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = Date.now() - startTime;
    console.log(`[ai-retry-worker] Completed in ${duration}ms:`, stats);

    return new Response(JSON.stringify({ 
      message: `Processed ${stats.processed} jobs`,
      stats,
      durationMs: duration,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[ai-retry-worker] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stats,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Process a single AI job based on its type
 */
async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: AiJob
): Promise<void> {
  console.log(`[ai-retry-worker] Processing ${job.job_type} job ${job.id}`);

  switch (job.job_type) {
    case 'analyze_js_heavy':
      await processAnalyzeJob(supabase, job);
      break;

    case 'enrich_social_five':
      await processEnrichJob(supabase, job);
      break;

    case 'heal_selectors':
      await processHealJob(supabase, job);
      break;

    case 'classify_vibe':
      await processVibeJob(supabase, job);
      break;

    default:
      throw new Error(`Unknown job type: ${job.job_type}`);
  }
}

/**
 * Process JS-heavy analysis job
 */
async function processAnalyzeJob(
  supabase: ReturnType<typeof createClient>,
  job: AiJob
): Promise<void> {
  const { url, html } = job.payload as { url: string; html: string };

  if (!url || !html) {
    throw new Error('Missing url or html in payload');
  }

  const result = await analyzePageStrategy(html, url, true);

  // Cache the result on the source
  if (job.related_id) {
    await cacheAnalysisResult(supabase, job.related_id, result, '');
  }
}

/**
 * Process Social Five enrichment job
 */
async function processEnrichJob(
  supabase: ReturnType<typeof createClient>,
  job: AiJob
): Promise<void> {
  const { url, html } = job.payload as { url: string; html: string };

  if (!url || !html) {
    throw new Error('Missing url or html in payload');
  }

  const enrichment = await extractSocialFive(html, url);

  // Apply enrichment to staging row
  if (job.related_id) {
    await applyEnrichmentToStaging(supabase, job.related_id, enrichment);
  }
}

/**
 * Process selector healing job
 */
async function processHealJob(
  supabase: ReturnType<typeof createClient>,
  job: AiJob
): Promise<void> {
  const { sourceId } = job.payload as { sourceId: string };

  if (!sourceId) {
    throw new Error('Missing sourceId in payload');
  }

  await healSelectors(supabase, sourceId);
}

/**
 * Process vibe classification job
 */
async function processVibeJob(
  supabase: ReturnType<typeof createClient>,
  job: AiJob
): Promise<void> {
  const { title, description, category, stagingId } = job.payload as {
    title: string;
    description: string;
    category: string | null;
    stagingId: string;
  };

  if (!title || !stagingId) {
    throw new Error('Missing title or stagingId in payload');
  }

  const vibeResult = await classifyVibe(title, description || '', category);

  // Update staging row with vibe data
  await supabase
    .from('raw_event_staging')
    .update({
      persona_tags: vibeResult.suggestedPersonas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stagingId);
}
