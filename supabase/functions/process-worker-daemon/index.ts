import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { sendSlackAlert } from "../_shared/slack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Import the process-worker handler
async function processBatch(supabase: any) {
  const { handler } = await import("../process-worker/index.ts");
  
  // Create a mock request to trigger the processor
  const mockRequest = new Request("http://localhost/process-worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  
  const response = await handler(mockRequest);
  const result = await response.json();
  
  return result;
}

async function checkForStall(supabase: any) {
  // Get pipeline health
  const { data: health, error: healthError } = await supabase.rpc("get_pipeline_health");
  
  if (healthError) {
    console.warn("Health check failed:", healthError);
    return { isStalled: false };
  }
  
  const { pending_count, completed_count, failed_count } = health[0];
  
  // Check recent event creation (last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: recentEvents, error: countError } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .gte("created_at", fiveMinutesAgo);
  
  if (countError) {
    console.warn("Recent events check failed:", countError);
    return { isStalled: false };
  }
  
  // STALL DETECTED: Pending work but no recent progress
  const isStalled = pending_count > 0 && recentEvents === 0;
  
  // Check for high failure rate
  const totalProcessed = completed_count + failed_count;
  const failureRate = totalProcessed > 0 ? (failed_count / totalProcessed) * 100 : 0;
  
  return {
    isStalled,
    pending: pending_count,
    completed: completed_count,
    failed: failed_count,
    recentEvents,
    failureRate,
    shouldAlert: isStalled || (failureRate > 15 && pending_count > 100)
  };
}

async function processWithKeepAlive(supabase: any, supabaseUrl: string, supabaseKey: string) {
  let keepRunning = true;
  let consecutiveEmptyBatches = 0;
  let totalProcessed = 0;
  const startTime = Date.now();
  
  console.log("🚀 Worker Daemon started");
  
  // Check for stalls before starting
  const stallCheck = await checkForStall(supabase);
  if (stallCheck.shouldAlert) {
    if (stallCheck.isStalled) {
      await sendSlackAlert({
        type: "error",
        message: `⚠️ **Pipeline Stalled**\n${stallCheck.pending} pending events, but 0 created in last 5 minutes`,
        details: {
          pending: stallCheck.pending,
          completed: stallCheck.completed,
          failed: stallCheck.failed
        }
      });
    } else if (stallCheck.failureRate > 15) {
      await sendSlackAlert({
        type: "warning",
        message: `⚠️ **High Failure Rate**\nFailure rate: ${stallCheck.failureRate.toFixed(1)}% with ${stallCheck.pending} pending`,
        details: {
          failureRate: `${stallCheck.failureRate.toFixed(1)}%`,
          pending: stallCheck.pending,
          failed: stallCheck.failed
        }
      });
    }
  }
  
  while (keepRunning) {
    try {
      const result = await processBatch(supabase);
      
      if (result.processed) {
        totalProcessed += result.processed;
        consecutiveEmptyBatches = 0;
        
        console.log(`✓ Processed batch: ${result.succeeded || 0} succeeded, ${result.failed || 0} failed`);
        
        // Check if more work exists
        const { count: pendingCount } = await supabase
          .from("raw_event_staging")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        
        if (pendingCount > 10) {
          // Self-trigger to keep processing
          console.log(`🔄 Self-triggering (${pendingCount} pending)...`);
          fetch(`${supabaseUrl}/functions/v1/process-worker-daemon`, {
            method: "POST",
            headers: { 
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
          }).catch(() => {}); // Fire and forget
        }
      } else {
        consecutiveEmptyBatches++;
        console.log(`⏸️  No work found (${consecutiveEmptyBatches}/3)`);
      }
      
      // Shutdown if no work for 3 consecutive checks
      if (consecutiveEmptyBatches >= 3) {
        const runtime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ No more work. Processed ${totalProcessed} total. Runtime: ${runtime}s`);
        keepRunning = false;
      }
      
      // Throttle to avoid overwhelming the system
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (error) {
      console.error("❌ Batch processing error:", error);
      consecutiveEmptyBatches++;
      
      // Send alert on repeated failures
      if (consecutiveEmptyBatches >= 2) {
        await sendSlackAlert({
          type: "error",
          message: `❌ **Worker Daemon Error**\nRepeated processing failures`,
          details: { error: String(error) }
        });
      }
    }
  }
  
  return { totalProcessed };
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const result = await processWithKeepAlive(supabase, supabaseUrl, supabaseKey);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        totalProcessed: result.totalProcessed,
        message: "Worker daemon completed successfully"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Worker daemon error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
