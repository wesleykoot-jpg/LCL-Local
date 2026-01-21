#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { createClient } from "npm:@supabase/supabase-js";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

// Load environment variables
const env = await load();
const supabaseUrl = Deno.env.get("SUPABASE_URL") || env.SUPABASE_URL;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PipelineHealth {
  pending_count: number;
  processing_count: number;
  stuck_count: number;
  completed_count: number;
  failed_count: number;
  avg_processing_seconds: number;
}

async function checkHealth(): Promise<PipelineHealth> {
  const { data, error } = await supabase.rpc("get_pipeline_health");
  
  if (error) {
    console.error("❌ Health check failed:", error);
    throw error;
  }
  
  return data[0] as PipelineHealth;
}

async function autoRecover(): Promise<{ reset_count: number; row_ids: string[] }> {
  const { data, error } = await supabase.rpc("reset_stale_processing_rows");
  
  if (error) {
    console.error("❌ Auto-recovery failed:", error);
    throw error;
  }
  
  return data[0] as { reset_count: number; row_ids: string[] };
}

async function main() {
  console.log("🏥 Pipeline Health Check\n");
  
  try {
    // Get health metrics
    const health = await checkHealth();
    
    console.log("📊 Current Status:");
    console.log(`   Pending:    ${health.pending_count}`);
    console.log(`   Processing: ${health.processing_count}`);
    console.log(`   Stuck:      ${health.stuck_count} ⚠️`);
    console.log(`   Completed:  ${health.completed_count}`);
    console.log(`   Failed:     ${health.failed_count}`);
    console.log(`   Avg Time:   ${health.avg_processing_seconds}s\n`);
    
    // Auto-recover if needed
    if (health.stuck_count > 0) {
      console.log(`🔧 Auto-recovering ${health.stuck_count} stuck rows...`);
      const recovery = await autoRecover();
      console.log(`✅ Reset ${recovery.reset_count} rows back to pending\n`);
    } else {
      console.log("✅ No stuck rows detected\n");
    }
    
    // Alert if queue is growing
    if (health.pending_count > 1000) {
      console.log(`⚠️  WARNING: Large pending queue (${health.pending_count} rows)`);
      console.log("   Consider scaling up processing capacity\n");
    }
    
    // Alert if failure rate is high
    const totalProcessed = health.completed_count + health.failed_count;
    if (totalProcessed > 0) {
      const failureRate = (health.failed_count / totalProcessed) * 100;
      if (failureRate > 10) {
        console.log(`⚠️  WARNING: High failure rate (${failureRate.toFixed(1)}%)`);
        console.log("   Check error logs for common issues\n");
      }
    }
    
    console.log("🎉 Health check complete!");
    
  } catch (error) {
    console.error("❌ Health check error:", error);
    Deno.exit(1);
  }
}

main();
