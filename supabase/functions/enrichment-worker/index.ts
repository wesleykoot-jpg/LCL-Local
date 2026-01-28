/**
 * Enrichment Worker - Stage 2 of Waterfall Pipeline (V2)
 * 
 * Responsibility:
 * - Processes ONE event at a time (called via database trigger webhook)
 * - Fetches detail page HTML if needed
 * - Converts HTML to Markdown
 * - Uses Waterfall V2 enrichment for "Social Five" extraction
 * - Updates staging row to READY_TO_INDEX
 * 
 * Trigger: Database trigger on INSERT/UPDATE to awaiting_enrichment status
 * 
 * Architecture: Push-based (DB triggers worker immediately on insert)
 * 
 * This is DECOUPLED from the indexing step for resilience.
 * If this fails, only 1 event is affected, not the whole batch.
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, openAiApiKey } from "../_shared/env.ts";
import { enrichWithSocialFive, type EnrichmentResult } from "../_shared/waterfallV2.ts";
import { logError, logInfo } from "../_shared/errorLogging.ts";
import { createFetcherForSource } from "../_shared/strategies.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Database Webhook Payload from trigger
 * Sent when a row enters awaiting_enrichment status
 */
interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE";
  table: string;
  schema: string;
  record: {
    id: string;
    source_id: string;
    source_url: string;
    detail_url: string | null;
    title: string | null;
    raw_html: string;
    pipeline_status: string;
    created_at: string;
  };
  old_record: null | Record<string, unknown>;
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
 * Extract structured event data from HTML using Waterfall V2 AI
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

    // Use Waterfall V2 enrichment for Social Five extraction
    console.log(`[Enrichment] Processing with Waterfall V2: ${row.title || row.source_url}`);
    
    const enrichmentResult: EnrichmentResult = await enrichWithSocialFive(
      openAiApiKey,
      {
        detailHtml: htmlContent,
        baseUrl: row.source_url,
        hints: {
          title: row.title || undefined,
          location: undefined,
          date: undefined,
        },
      },
      fetch
    );

    if (!enrichmentResult.success || !enrichmentResult.event) {
      throw new Error(enrichmentResult.error || "Waterfall V2 enrichment returned empty result");
    }

    const parsed = enrichmentResult.event;

    // Update staging row with enriched data
    await supabase.rpc("complete_enrichment", {
      p_id: row.id,
      p_structured_data: parsed,
      p_title: parsed.title,
      p_description: parsed.description,
      p_event_date: parsed.event_date,
      p_event_time: parsed.start_time || parsed.event_time,
      p_venue_name: parsed.venue_name,
      p_category: parsed.category,
      p_image_url: parsed.image_url,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Enrichment] ✓ Completed in ${elapsed}ms (score: ${enrichmentResult.socialFiveScore}/5): ${parsed.title}`);
    
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
 * Check if payload is a Database Webhook payload (from trigger)
 */
function isDatabaseWebhookPayload(payload: unknown): payload is DatabaseWebhookPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    "record" in payload &&
    typeof (payload as DatabaseWebhookPayload).record?.id === "string"
  );
}

/**
 * Main handler - processes events one at a time
 * 
 * Supports one mode:
 * 1. Database Webhook (Push): Triggered by database trigger on INSERT/UPDATE
 *    - Payload: { type: "INSERT", record: { id, source_id, ... } }
 *    - Returns 200 OK immediately to prevent trigger timeout
 */
export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const workerId = crypto.randomUUID();
  
  try {
    let rawPayload: unknown = {};
    
    if (req.method === "POST") {
      try {
        rawPayload = await req.json();
      } catch {
        // Empty body is fine - we'll claim next available
      }
    }

    // MODE 1: Database Webhook Payload (Push-based from trigger)
    if (isDatabaseWebhookPayload(rawPayload)) {
      const eventId = rawPayload.record.id;
      console.log(`[Enrichment] Received webhook for event: ${eventId}`);
      
      // Fetch full row data (trigger payload may be minimal)
      const { data: row, error } = await supabase
        .from("raw_event_staging")
        .select("id, source_id, source_url, detail_url, raw_html, title")
        .eq("id", eventId)
        .single();
      
      if (error || !row) {
        console.error(`[Enrichment] Event not found: ${eventId}`, error);
        // Return 200 to prevent trigger retry on missing rows
        return new Response(
          JSON.stringify({ error: "Event not found", id: eventId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Process the event
      const result = await enrichEvent(supabase, row as StagingRow);
      
      // Always return 200 to prevent database trigger from retrying
      return new Response(
        JSON.stringify({ 
          ...result, 
          id: eventId, 
          workerId,
          mode: "webhook"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid payload: expected database webhook" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
