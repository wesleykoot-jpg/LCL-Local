/**
 * SG Vectorizer - Stage 4: Embed & Index
 * 
 * Social Graph Intelligence Pipeline - The Vectorizer
 * 
 * Responsibilities:
 * - Generates embeddings for semantic search
 * - Persists events to production table
 * - Final validation and quality checks
 * 
 * @module sg-vectorizer
 */

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { 
  supabaseUrl, 
  supabaseServiceRoleKey, 
  openAiApiKey,
  validateEnv 
} from "../_shared/sgEnv.ts";
import type { VectorizerResponse, SocialEvent } from "../_shared/sgTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// EMBEDDING GENERATION
// ============================================================================

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // Token limit
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Embeddings error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.data?.[0]?.embedding || [];
}

/**
 * Build embedding text from extracted event data
 */
function buildEmbeddingText(event: SocialEvent): string {
  const parts = [
    event.what?.title,
    event.what?.description,
    event.what?.category,
    event.what?.tags?.join(' '),
    event.where?.venue_name,
    event.where?.city,
    event.vibe?.social_context?.join(' '),
    event.who?.target_audience?.join(' '),
  ].filter(Boolean);

  return parts.join(' ').slice(0, 2000);
}

// ============================================================================
// EVENT MAPPING
// ============================================================================

interface EventRow {
  title: string;
  description: string | null;
  category: string;
  event_type: 'anchor' | 'fork' | 'signal';
  location: string; // PostGIS POINT
  venue_name: string;
  event_date: string;
  event_time: string;
  image_url: string | null;
  tags: string[];
  source_url: string;
  embedding: number[] | null;
}

const CATEGORY_MAP: Record<string, string> = {
  MUSIC: 'music',
  CULTURE: 'culture',
  COMMUNITY: 'community',
  SOCIAL: 'social',
  ACTIVE: 'active',
  FOOD: 'food',
  NIGHTLIFE: 'nightlife',
  FAMILY: 'family',
  OUTDOOR: 'outdoor',
  OUTDOORS: 'outdoor',
  SPORTS: 'sports',
  CINEMA: 'cinema',
  CRAFTS: 'crafts',
  GAMING: 'gaming',
  MARKET: 'market',
  WELLNESS: 'wellness',
};

function normalizeCategory(category: string | undefined | null): string {
  if (!category) return 'community';
  const upper = category.toUpperCase();
  return CATEGORY_MAP[upper] || category.toLowerCase();
}

function mapToEventRow(event: SocialEvent, embedding: number[] | null): EventRow {
  // Create PostGIS POINT - CRITICAL: lng first!
  const lat = event.where?.lat || 52.3676;  // Amsterdam fallback
  const lng = event.where?.lng || 4.9041;
  const location = `POINT(${lng} ${lat})`;

  // Parse datetime
  const startDate = event.when?.start_datetime ? new Date(event.when.start_datetime) : new Date();
  const eventDate = startDate.toISOString();
  const eventTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return {
    title: event.what?.title || 'Untitled Event',
    description: event.what?.description || null,
    category: normalizeCategory(event.what?.category),
    event_type: 'anchor', // Scraped events are anchors
    location,
    venue_name: event.where?.venue_name || 'TBD',
    event_date: eventDate,
    event_time: eventTime,
    image_url: event.image_url || null,
    tags: event.what?.tags || [],
    source_url: event.source_url,
    embedding,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

interface VectorizerPayload {
  limit?: number;
  skip_embedding?: boolean;
  worker_id?: string;
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
    let payload: VectorizerPayload = {};
    if (req.method === "POST") {
      try {
        payload = await req.json();
      } catch {
        // Empty body is fine
      }
    }

    const { 
      limit = 50, 
      skip_embedding = false,
      worker_id 
    } = payload;
    const workerId = worker_id || crypto.randomUUID();

    console.log(`[SG Vectorizer] Processing up to ${limit} items`);

    const response: VectorizerResponse = {
      success: true,
      items_vectorized: 0,
      items_persisted: 0,
      errors: [],
    };

    // Claim items from 'ready_to_persist' stage
    const { data: claimed, error: claimError } = await supabase
      .rpc('sg_claim_for_stage', {
        p_stage: 'ready_to_persist',
        p_worker_id: workerId,
        p_limit: limit,
      });

    if (claimError) {
      throw new Error(`Failed to claim items: ${claimError.message}`);
    }

    if (!claimed || claimed.length === 0) {
      console.log('[SG Vectorizer] No items to process');
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SG Vectorizer] Claimed ${claimed.length} items`);

    // Process each item
    for (const item of claimed) {
      try {
        const extractedData = item.extracted_data as SocialEvent;

        if (!extractedData) {
          throw new Error('No extracted data found');
        }

        // Generate embedding
        let embedding: number[] | null = null;
        if (!skip_embedding) {
          console.log(`[SG Vectorizer] Generating embedding for: ${extractedData.what?.title}`);
          const embeddingText = buildEmbeddingText(extractedData);
          
          try {
            embedding = await generateEmbedding(embeddingText);
            response.items_vectorized++;
          } catch (embError) {
            console.warn('[SG Vectorizer] Embedding failed, continuing without:', embError);
          }
        }

        // Store embedding in queue
        if (embedding) {
          await supabase
            .from('sg_pipeline_queue')
            .update({ embedding })
            .eq('id', item.id);
        }

        // Map to events table format
        const eventRow = mapToEventRow(extractedData, embedding);

        // Insert into events table
        console.log(`[SG Vectorizer] Persisting: ${eventRow.title}`);
        const { data: newEvent, error: insertError } = await supabase
          .from('events')
          .insert({
            title: eventRow.title,
            description: eventRow.description || '',
            category: eventRow.category,
            event_type: eventRow.event_type,
            location: eventRow.location,
            venue_name: eventRow.venue_name,
            event_date: eventRow.event_date,
            event_time: eventRow.event_time,
            status: 'published',
            image_url: eventRow.image_url,
            tags: eventRow.tags,
            source_url: eventRow.source_url,
            embedding: eventRow.embedding,
          })
          .select('id')
          .single();

        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }

        // Update queue item to indexed
        await supabase
          .from('sg_pipeline_queue')
          .update({
            stage: 'indexed',
            event_id: newEvent?.id,
            persisted_at: new Date().toISOString(),
            worker_id: null,
            claimed_at: null,
          })
          .eq('id', item.id);

        response.items_persisted++;
        console.log(`[SG Vectorizer] ✓ Persisted: ${eventRow.title} (id: ${newEvent?.id})`);

      } catch (error) {
        console.error(`[SG Vectorizer] Failed processing item:`, error);
        
        await supabase.rpc('sg_record_failure', {
          p_item_id: item.id,
          p_failure_level: 'transient',
          p_error_message: error instanceof Error ? error.message : 'Unknown error',
        });

        response.errors.push(error instanceof Error ? error.message : 'Unknown');
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SG Vectorizer] Completed in ${elapsed}ms: ${response.items_persisted} persisted`);

    return new Response(
      JSON.stringify({
        ...response,
        duration_ms: elapsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[SG Vectorizer] Fatal error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        items_vectorized: 0,
        items_persisted: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
