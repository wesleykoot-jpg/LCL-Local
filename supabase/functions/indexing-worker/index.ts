/**
 * Indexing Worker - Stage 3 of Waterfall Pipeline
 * 
 * Responsibility:
 * - Batch processes READY_TO_INDEX events
 * - Generates embeddings (OpenAI batch API for speed)
 * - Upserts to production events table
 * - Marks staging rows as PROCESSED
 * 
 * Trigger: Scheduled (every 5 minutes)
 * 
 * This worker is FAST because:
 * - No network fetching (already done by enrichment-worker)
 * - No AI parsing (already done by enrichment-worker)
 * - Just embeddings + database writes (highly parallelizable)
 */

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, openAiApiKey } from "../_shared/env.ts";
import { generateEmbedding } from "../_shared/aiParsing.ts";
import { createEventFingerprint, eventToText } from "../_shared/scraperUtils.ts";
import { logError, logInfo } from "../_shared/errorLogging.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;

interface EnrichedRow {
  id: string;
  source_id: string;
  source_url: string;
  structured_data: any;
  title: string;
  description: string;
  event_date: string;
  event_time: string;
  venue_name: string;
  venue_address: string;
  coordinates: any;
  category: string;
  image_url: string;
  price: string;
  tickets_url: string;
}

/**
 * Generate embedding text from event data
 */
function buildEmbeddingText(row: EnrichedRow): string {
  const parts = [
    row.title,
    row.description,
    row.venue_name,
    row.venue_address,
    row.category,
  ].filter(Boolean);
  
  return parts.join(" | ");
}

/**
 * Transform staging row to events table format
 */
function stagingToEvent(row: EnrichedRow, embedding: number[] | null): any {
  const fingerprint = createEventFingerprint({
    title: row.title,
    event_date: row.event_date,
    venue_name: row.venue_name,
    source_url: row.source_url,
  });

  return {
    title: row.title,
    description: row.description,
    event_date: row.event_date,
    event_time: row.event_time,
    venue_name: row.venue_name,
    venue_address: row.venue_address,
    location: row.coordinates,
    category: row.category,
    image_url: row.image_url,
    price: row.price,
    tickets_url: row.tickets_url,
    source_url: row.source_url,
    event_fingerprint: fingerprint,
    embedding: embedding,
    event_type: "anchor", // Scraped events are anchors
    is_public: true,
    scraped_data: row.structured_data,
  };
}

/**
 * Main handler - batch indexes enriched events
 */
export async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const startTime = Date.now();
  
  try {
    // Claim batch of READY_TO_INDEX events
    const { data: rows, error: claimError } = await supabase.rpc("claim_for_indexing", {
      p_batch_size: BATCH_SIZE,
    });
    
    if (claimError) {
      throw new Error(`Claim failed: ${claimError.message}`);
    }
    
    if (!rows || rows.length === 0) {
      return new Response(
        JSON.stringify({ message: "No events ready for indexing" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Indexing] Processing ${rows.length} events...`);

    const results: Array<{ id: string; success: boolean; eventId?: string; error?: string }> = [];
    const successfulIds: string[] = [];

    // Process each event
    for (const row of rows as EnrichedRow[]) {
      try {
        // Generate embedding (this is the only AI call)
        const embeddingText = buildEmbeddingText(row);
        let embedding: number[] | null = null;
        
        if (openAiApiKey && embeddingText.length > 10) {
          try {
            embedding = await generateEmbedding(embeddingText);
          } catch (e) {
            console.warn(`[Indexing] Embedding failed for ${row.id}, continuing without`);
          }
        }

        // Transform to events table format
        const eventData = stagingToEvent(row, embedding);

        // Upsert to events table (using fingerprint for deduplication)
        const { data: inserted, error: insertError } = await supabase
          .from("events")
          .upsert(eventData, { 
            onConflict: "event_fingerprint",
            ignoreDuplicates: false 
          })
          .select("id")
          .single();

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        results.push({ 
          id: row.id, 
          success: true, 
          eventId: inserted?.id 
        });
        successfulIds.push(row.id);

        console.log(`[Indexing] ✓ ${row.title}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Indexing] ✗ ${row.id}: ${errorMessage}`);
        
        results.push({ 
          id: row.id, 
          success: false, 
          error: errorMessage 
        });

        // Mark individual row as failed (for retry)
        await supabase
          .from("raw_event_staging")
          .update({ 
            pipeline_status: "ready_to_index", // Put back for retry
            last_error: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq("id", row.id);
      }
    }

    // Mark successful rows as processed
    if (successfulIds.length > 0) {
      await supabase.rpc("complete_indexing", {
        p_ids: successfulIds,
      });
    }

    const elapsed = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[Indexing] Complete: ${successful}/${rows.length} in ${elapsed}ms`);

    // Log to insights
    await logInfo(
      supabaseUrl,
      supabaseServiceRoleKey,
      "indexing-worker",
      `Indexed ${successful} events, ${failed} failed in ${elapsed}ms`
    );

    return new Response(
      JSON.stringify({
        message: "Indexing complete",
        processed: rows.length,
        successful,
        failed,
        elapsedMs: elapsed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Indexing] Fatal error:", errorMessage);
    
    await logError(
      supabaseUrl,
      supabaseServiceRoleKey,
      "indexing-worker",
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
