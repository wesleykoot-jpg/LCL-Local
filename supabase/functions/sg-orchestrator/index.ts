/**
 * SG Orchestrator - Pipeline Coordinator
 * 
 * Social Graph Intelligence Pipeline - Master Orchestrator
 * 
 * Responsibilities:
 * - Coordinates all pipeline stages
 * - Handles scheduled runs
 * - Provides pipeline health status
 * - Triggers individual workers
 * 
 * @module sg-orchestrator
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { 
  supabaseUrl, 
  supabaseServiceRoleKey, 
  validateEnv 
} from "../_shared/sgEnv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// TYPES
// ============================================================================

interface PipelineStats {
  stage: string;
  count: number;
  oldest_item: string | null;
  avg_wait_time_minutes: number;
}

interface OrchestratorResponse {
  success: boolean;
  mode: string;
  pipeline_stats: PipelineStats[];
  actions_taken: string[];
  errors: string[];
  duration_ms: number;
}

// ============================================================================
// WORKER INVOCATION
// ============================================================================

async function invokeWorker(
  workerName: string, 
  payload: Record<string, unknown> = {}
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${workerName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface OrchestratorPayload {
  mode?: 'status' | 'run_all' | 'run_stage' | 'discovery_only' | 'auto_process';
  stage?: string;
  cities?: string[];
  limit?: number;
  /** For auto_process: target % of rate limit to use (default 80) */
  throttle_pct?: number;
  /** For auto_process: max cycles before stopping (default 10) */
  max_cycles?: number;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate environment
  const envCheck = validateEnv();
  if (!envCheck.valid) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables", missing: envCheck.missing }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const startTime = Date.now();

  try {
    // Parse payload
    let payload: OrchestratorPayload = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const { 
      mode = 'status',
      stage,
      cities,
      limit = 50,
      throttle_pct = 80,
      max_cycles = 10,
    } = payload;

    console.log(`[SG Orchestrator] Mode: ${mode}`);
    
    // Rate limit constants (at 80% of max)
    // Nominatim: 1 req/sec → with geocoding batches of 5, wait ~5s between curator calls
    // OpenAI: 500 RPM → at 80% = 400 RPM, ~6 req/sec (not bottleneck)
    const CURATOR_BATCH_SIZE = 5;  // Events per curator call
    const CURATOR_DELAY_MS = Math.round((CURATOR_BATCH_SIZE * 1000) * (100 / throttle_pct)); // ~6250ms at 80%
    const STRATEGIST_BATCH_SIZE = 30; // URLs per strategist call (no geocoding)
    const VECTORIZER_BATCH_SIZE = 20; // Events per vectorizer call (no geocoding)

    const response: OrchestratorResponse = {
      success: true,
      mode,
      pipeline_stats: [],
      actions_taken: [],
      errors: [],
      duration_ms: 0,
    };

    // Get pipeline stats
    const { data: stats, error: statsError } = await supabase
      .rpc('sg_get_pipeline_stats');

    if (!statsError && stats) {
      response.pipeline_stats = stats;
    }

    // Execute based on mode
    switch (mode) {
      case 'status':
        // Just return stats
        console.log('[SG Orchestrator] Status check - no actions');
        break;

      case 'discovery_only':
        // Run scout only
        console.log('[SG Orchestrator] Running discovery (Scout)');
        const scoutResult = await invokeWorker('sg-scout', { cities, mode: 'discovery' });
        
        if (scoutResult.success) {
          response.actions_taken.push(`Scout: discovered ${(scoutResult.data as any)?.sources_created || 0} sources`);
        } else {
          response.errors.push(`Scout failed: ${scoutResult.error}`);
        }
        break;

      case 'run_stage':
        // Run specific stage
        if (!stage) {
          response.errors.push('Stage parameter required for run_stage mode');
          break;
        }

        console.log(`[SG Orchestrator] Running stage: ${stage}`);
        
        let workerName: string;
        switch (stage) {
          case 'scout':
          case 'discovery':
            workerName = 'sg-scout';
            break;
          case 'strategist':
          case 'analyze':
            workerName = 'sg-strategist';
            break;
          case 'curator':
          case 'extract':
          case 'enrich':
            workerName = 'sg-curator';
            break;
          case 'vectorizer':
          case 'persist':
            workerName = 'sg-vectorizer';
            break;
          default:
            response.errors.push(`Unknown stage: ${stage}`);
            workerName = '';
        }

        if (workerName) {
          const stageResult = await invokeWorker(workerName, { limit });
          if (stageResult.success) {
            response.actions_taken.push(`${workerName}: ${JSON.stringify(stageResult.data)}`);
          } else {
            response.errors.push(`${workerName} failed: ${stageResult.error}`);
          }
        }
        break;

      case 'run_all':
        // Run full pipeline in sequence
        console.log('[SG Orchestrator] Running full pipeline');

        // 1. Scout (if needed)
        const discoveredCount = response.pipeline_stats.find(s => s.stage === 'discovered')?.count || 0;
        if (discoveredCount < 10) {
          console.log('[SG Orchestrator] Low queue, running Scout');
          const scoutRes = await invokeWorker('sg-scout', { cities: cities?.slice(0, 3), mode: 'full' });
          if (scoutRes.success) {
            response.actions_taken.push(`Scout: ${JSON.stringify(scoutRes.data)}`);
          } else {
            response.errors.push(`Scout: ${scoutRes.error}`);
          }
        }

        // 2. Strategist
        const awaitingAnalysis = response.pipeline_stats.find(s => s.stage === 'discovered')?.count || 0;
        if (awaitingAnalysis > 0) {
          console.log('[SG Orchestrator] Running Strategist');
          const stratRes = await invokeWorker('sg-strategist', { limit });
          if (stratRes.success) {
            response.actions_taken.push(`Strategist: ${JSON.stringify(stratRes.data)}`);
          } else {
            response.errors.push(`Strategist: ${stratRes.error}`);
          }
        }

        // 3. Curator
        const awaitingFetch = response.pipeline_stats.find(s => s.stage === 'awaiting_fetch')?.count || 0;
        if (awaitingFetch > 0) {
          console.log('[SG Orchestrator] Running Curator');
          const curatorRes = await invokeWorker('sg-curator', { limit, stage: 'awaiting_fetch' });
          if (curatorRes.success) {
            response.actions_taken.push(`Curator: ${JSON.stringify(curatorRes.data)}`);
          } else {
            response.errors.push(`Curator: ${curatorRes.error}`);
          }
        }

        // 4. Vectorizer
        const readyToPersist = response.pipeline_stats.find(s => s.stage === 'ready_to_persist')?.count || 0;
        if (readyToPersist > 0) {
          console.log('[SG Orchestrator] Running Vectorizer');
          const vecRes = await invokeWorker('sg-vectorizer', { limit });
          if (vecRes.success) {
            response.actions_taken.push(`Vectorizer: ${JSON.stringify(vecRes.data)}`);
          } else {
            response.errors.push(`Vectorizer: ${vecRes.error}`);
          }
        }

        break;

      case 'auto_process':
        // Automated pipeline processing at controlled rate
        // Processes all queued items without discovering new sources
        console.log(`[SG Orchestrator] Auto-processing at ${throttle_pct}% rate, max ${max_cycles} cycles`);
        
        let cyclesRun = 0;
        let totalProcessed = 0;
        
        // Helper to sleep
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Helper to get fresh stats
        const getStats = async () => {
          const { data } = await supabase.rpc('sg_get_pipeline_stats');
          return data as PipelineStats[] || [];
        };
        
        while (cyclesRun < max_cycles) {
          const stats = await getStats();
          
          const discovered = stats.find(s => s.stage === 'discovered')?.count || 0;
          const awaiting = stats.find(s => s.stage === 'awaiting_fetch')?.count || 0;
          const ready = stats.find(s => s.stage === 'ready_to_persist')?.count || 0;
          
          // Nothing left to process
          if (discovered === 0 && awaiting === 0 && ready === 0) {
            response.actions_taken.push(`Cycle ${cyclesRun + 1}: Pipeline empty, stopping`);
            break;
          }
          
          cyclesRun++;
          console.log(`[SG Orchestrator] Cycle ${cyclesRun}: discovered=${discovered}, awaiting=${awaiting}, ready=${ready}`);
          
          // Phase 1: Move discovered → awaiting_fetch (fast, no rate limit)
          if (discovered > 0) {
            const stratRes = await invokeWorker('sg-strategist', { limit: STRATEGIST_BATCH_SIZE });
            if (stratRes.success) {
              const processed = (stratRes.data as any)?.processed || 0;
              totalProcessed += processed;
              response.actions_taken.push(`Cycle ${cyclesRun}: Strategist processed ${processed}`);
            } else {
              response.errors.push(`Cycle ${cyclesRun} Strategist: ${stratRes.error}`);
            }
          }
          
          // Phase 2: Extract & enrich (rate limited due to geocoding)
          if (awaiting > 0) {
            const curatorRes = await invokeWorker('sg-curator', { limit: CURATOR_BATCH_SIZE });
            if (curatorRes.success) {
              const processed = (curatorRes.data as any)?.processed || 0;
              totalProcessed += processed;
              response.actions_taken.push(`Cycle ${cyclesRun}: Curator processed ${processed}`);
            } else {
              response.errors.push(`Cycle ${cyclesRun} Curator: ${curatorRes.error}`);
            }
            
            // Wait for Nominatim rate limit (1 req/sec * batch size)
            if (cyclesRun < max_cycles) {
              console.log(`[SG Orchestrator] Waiting ${CURATOR_DELAY_MS}ms for rate limit`);
              await sleep(CURATOR_DELAY_MS);
            }
          }
          
          // Phase 3: Vectorize & persist (no external rate limit)
          if (ready > 0) {
            const vecRes = await invokeWorker('sg-vectorizer', { limit: VECTORIZER_BATCH_SIZE });
            if (vecRes.success) {
              const indexed = (vecRes.data as any)?.indexed || 0;
              totalProcessed += indexed;
              response.actions_taken.push(`Cycle ${cyclesRun}: Vectorizer indexed ${indexed}`);
            } else {
              response.errors.push(`Cycle ${cyclesRun} Vectorizer: ${vecRes.error}`);
            }
          }
          
          // Phase 4: Run healer every 5 cycles to repair broken sources
          if (cyclesRun % 5 === 0) {
            console.log(`[SG Orchestrator] Running Healer check`);
            const healerRes = await invokeWorker('sg-healer', { mode: 'repair', limit: 2 });
            if (healerRes.success) {
              const repaired = (healerRes.data as any)?.sources_repaired || 0;
              if (repaired > 0) {
                response.actions_taken.push(`Cycle ${cyclesRun}: Healer repaired ${repaired} sources`);
              }
            }
          }
        }
        
        response.actions_taken.push(`Auto-process complete: ${cyclesRun} cycles, ~${totalProcessed} items processed`);
        break;
    }

    // Get updated stats
    const { data: finalStats } = await supabase.rpc('sg_get_pipeline_stats');
    if (finalStats) {
      response.pipeline_stats = finalStats;
    }

    response.duration_ms = Date.now() - startTime;
    response.success = response.errors.length === 0;

    console.log(`[SG Orchestrator] Completed in ${response.duration_ms}ms`);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SG Orchestrator] Fatal error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        mode: 'error',
        error: error instanceof Error ? error.message : "Unknown error",
        pipeline_stats: [],
        actions_taken: [],
        errors: [error instanceof Error ? error.message : "Unknown error"],
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
