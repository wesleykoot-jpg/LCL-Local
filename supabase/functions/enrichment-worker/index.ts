/**
 * Enrichment Worker - Stage 2 of Waterfall Pipeline
 * 
 * Responsibility:
 * - Processes ONE event at a time (called via webhook or queue)
 * - Fetches detail page HTML if needed
 * - Converts HTML to Markdown
 * - Calls OpenAI for "Social Five" extraction
 * - Updates staging row to READY_TO_INDEX
 * 
 * Trigger: Database webhook on INSERT or scheduled batch
 * 
 * This is DECOUPLED from the indexing step for resilience.
 * If this fails, only 1 event is affected, not the whole batch.
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, openAiApiKey } from "../_shared/env.ts";
import { parseDetailedEventWithAI } from "../_shared/aiParsing.ts";
import { logError, logInfo } from "../_shared/errorLogging.ts";
import { createFetcherForSource } from "../_shared/strategies.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnrichmentPayload {
  id?: string;           // Direct ID to process
  batchSize?: number;    // Process a batch instead
  workerId?: string;     // For tracking
}

interface StagingRow {
  id: string;
  source_id: string;
  source_url: string;
  detail_url: string | null;
  raw_html: string;
  title: string | null;
}

/**
 * Extract structured event data from HTML using AI
 */
async function enrichEvent(
  supabase: ReturnType<typeof createClient>,
  row: StagingRow
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  
  try {
    // Get source configuration for fetcher settings
    const { data: source } = await supabase
      .from("scraper_sources")
      .select("*")
      .eq("id", row.source_id)
      .single();

    let htmlContent = row.raw_html;
    
    // If we have a detail URL and need to fetch it
    if (row.detail_url && (!htmlContent || htmlContent.length < 500)) {
      console.log(`[Enrichment] Fetching detail page: ${row.detail_url}`);
      
      const fetcher = createFetcherForSource(source || { config: {} } as any);
      const { html } = await fetcher.fetchPage(row.detail_url);
      htmlContent = html;
      
      // Store the fetched detail HTML
      await supabase
        .from("raw_event_staging")
        .update({ detail_html: html })
        .eq("id", row.id);
    }

    // Parse with AI to extract the "Social Five" and more
    console.log(`[Enrichment] Parsing event: ${row.title || row.source_url}`);
    
    const parsed = await parseDetailedEventWithAI(htmlContent, {
      sourceUrl: row.source_url,
      existingTitle: row.title,
    });

    if (!parsed || !parsed.title) {
      throw new Error("AI parsing returned empty result");
    }

    // Update staging row with enriched data
    await supabase.rpc("complete_enrichment", {
      p_id: row.id,
      p_structured_data: parsed,
      p_title: parsed.title,
      p_description: parsed.description,
      p_event_date: parsed.event_date,
      p_event_time: parsed.event_time,
      p_venue_name: parsed.venue_name,
      p_category: parsed.category,
      p_image_url: parsed.image_url,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Enrichment] ✓ Completed in ${elapsed}ms: ${parsed.title}`);
    
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Enrichment] ✗ Failed for ${row.id}: ${errorMessage}`);
    
    // Mark as failed (will retry or move to DLQ based on attempt count)
    await supabase.rpc("fail_enrichment", {
      p_id: row.id,
      p_error: errorMessage,
    });
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Main handler - processes events one at a time
 */
export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const workerId = crypto.randomUUID();
  
  try {
    let payload: EnrichmentPayload = {};
    
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine - we'll claim next available
      }
    }

    // Mode 1: Process specific ID (webhook trigger)
    if (payload.id) {
      const { data: row, error } = await supabase
        .from("raw_event_staging")
        .select("id, source_id, source_url, detail_url, raw_html, title")
        .eq("id", payload.id)
        .single();
      
      if (error || !row) {
        return new Response(
          JSON.stringify({ error: "Event not found", id: payload.id }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const result = await enrichEvent(supabase, row as StagingRow);
      return new Response(
        JSON.stringify({ ...result, id: payload.id, workerId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode 2: Claim and process next available (scheduled/batch)
    const batchSize = payload.batchSize || 1;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    
    for (let i = 0; i < batchSize; i++) {
      // Claim one event atomically
      const { data: rows, error: claimError } = await supabase.rpc("claim_for_enrichment", {
        p_worker_id: workerId,
      });
      
      if (claimError) {
        console.error("[Enrichment] Claim error:", claimError);
        break;
      }
      
      if (!rows || rows.length === 0) {
        console.log("[Enrichment] No more events to process");
        break;
      }
      
      const row = rows[0] as StagingRow;
      const result = await enrichEvent(supabase, row);
      results.push({ id: row.id, ...result });
    }

    return new Response(
      JSON.stringify({
        message: `Enrichment complete`,
        processed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
        workerId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Enrichment] Fatal error:", errorMessage);
    
    await logError(
      supabaseUrl,
      supabaseServiceRoleKey,
      "enrichment-worker",
      errorMessage,
      "fatal"
    );
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// Deno serve wrapper
// @ts-expect-error: Deno serve
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(handler);
