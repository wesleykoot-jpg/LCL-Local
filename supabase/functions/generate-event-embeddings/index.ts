import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Generate Event Embeddings Edge Function
 * 
 * Generates semantic embeddings for events using Gemini or OpenAI.
 * Can be triggered:
 * 1. On event creation (via database trigger)
 * 2. Via direct API call for batch processing
 * 3. Via scheduler for catching up on events without embeddings
 * 
 * Usage:
 * POST /functions/v1/generate-event-embeddings
 * Body: { "event_id": "uuid" } or { "batch": true, "limit": 100 }
 */

interface EmbeddingResponse {
  embedding: number[];
  model: string;
  version: number;
}

/**
 * Generate embedding using Gemini API (text-embedding-004 model)
 * Gemini embeddings are 768 dimensions, we'll pad to 1536 for compatibility
 */
async function generateEmbeddingWithGemini(
  apiKey: string,
  text: string
): Promise<EmbeddingResponse | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: {
            parts: [{ text }],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const embedding = data.embedding?.values;

    if (!embedding || !Array.isArray(embedding)) {
      console.error("Invalid embedding response from Gemini");
      return null;
    }

    // Gemini embeddings are 768 dimensions, pad to 1536 with zeros for compatibility
    const paddedEmbedding = [...embedding, ...new Array(1536 - embedding.length).fill(0)];

    return {
      embedding: paddedEmbedding,
      model: "gemini-text-embedding-004",
      version: 1,
    };
  } catch (error) {
    console.error("Error generating Gemini embedding:", error);
    return null;
  }
}

/**
 * Generate embedding using OpenAI API (text-embedding-3-small model)
 * Returns 1536 dimensions natively
 */
async function generateEmbeddingWithOpenAI(
  apiKey: string,
  text: string
): Promise<EmbeddingResponse | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 1536,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      console.error("Invalid embedding response from OpenAI");
      return null;
    }

    return {
      embedding,
      model: "openai-text-embedding-3-small",
      version: 1,
    };
  } catch (error) {
    console.error("Error generating OpenAI embedding:", error);
    return null;
  }
}

/**
 * Create text representation of event for embedding
 */
function eventToText(event: any): string {
  const parts = [
    event.title,
    event.description || "",
    event.category || "",
    event.venue_name || "",
  ];

  return parts.filter(Boolean).join(" ").trim();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase env vars");
    }

    if (!geminiApiKey && !openaiApiKey) {
      throw new Error("No embedding API key found (GEMINI_API_KEY or OPENAI_API_KEY)");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { event_id, batch = false, limit = 100 } = body;

    let eventsToProcess: any[] = [];

    if (batch) {
      // Batch mode: process events without embeddings
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, category, venue_name")
        .is("embedding", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      eventsToProcess = data || [];
    } else if (event_id) {
      // Single event mode
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, category, venue_name")
        .eq("id", event_id)
        .single();

      if (error) throw error;
      eventsToProcess = [data];
    } else {
      throw new Error("Must provide event_id or batch=true");
    }

    if (eventsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No events to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process events
    let processed = 0;
    let failed = 0;

    for (const event of eventsToProcess) {
      try {
        const text = eventToText(event);
        if (!text) {
          console.warn(`Event ${event.id} has no text content, skipping`);
          failed++;
          continue;
        }

        // Try OpenAI first (native 1536 dims), fallback to Gemini
        let embeddingResult: EmbeddingResponse | null = null;
        
        if (openaiApiKey) {
          embeddingResult = await generateEmbeddingWithOpenAI(openaiApiKey, text);
        }
        
        if (!embeddingResult && geminiApiKey) {
          embeddingResult = await generateEmbeddingWithGemini(geminiApiKey, text);
        }

        if (!embeddingResult) {
          console.error(`Failed to generate embedding for event ${event.id}`);
          failed++;
          continue;
        }

        // Store embedding in database
        const { error: updateError } = await supabase
          .from("events")
          .update({
            embedding: embeddingResult.embedding,
            embedding_generated_at: new Date().toISOString(),
            embedding_model: embeddingResult.model,
            embedding_version: embeddingResult.version,
          })
          .eq("id", event.id);

        if (updateError) {
          console.error(`Failed to update event ${event.id}:`, updateError);
          failed++;
          continue;
        }

        processed++;

        // Rate limiting: small delay between API calls
        if (eventsToProcess.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: eventsToProcess.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating embeddings:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
