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
  mode?: 'status' | 'run_all' | 'run_stage' | 'discovery_only';
  stage?: string;
  cities?: string[];
  limit?: number;
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
    } = payload;

    console.log(`[SG Orchestrator] Mode: ${mode}`);

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
