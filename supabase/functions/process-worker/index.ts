
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

import { 
  parseDetailedEventWithAI, 
  generateEmbedding,
  type ParsedDetailedEventAI 
} from "../_shared/aiParsing.ts";

import {
  createContentHash,
  createEventFingerprint,
  normalizeEventDateForStorage,
  cheapNormalizeEvent,
  eventToText
} from "../_shared/scraperUtils.ts";

import { logError as _logError } from "../_shared/errorLogging.ts";
import type { RawEventCard, NormalizedEvent } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;
const PROCESSING_TIMEOUT_MS = 60000;

interface StagingRow {
  id: string;
  source_id: string;
  url: string;
  raw_payload: RawEventCard;
  detail_html: string | null;
  status: string;
}

// Helper: Claim pending rows
async function claimPendingRows(supabase: SupabaseClient): Promise<StagingRow[]> {
  // Strategy: Fetch IDs first, then lock them by updating status to 'processing'
  // Note: Race condition exists but minimized for low concurrency.
  // Ideally, use an RPC `claim_staging_rows` if available.
  
  const { data: candidates, error } = await supabase
    .from("raw_event_staging")
    .select("id")
    .eq("status", "pending")
    .limit(BATCH_SIZE)
    .order("created_at", { ascending: true }); // process oldest first

  if (error || !candidates || candidates.length === 0) return [];

  const ids = candidates.map(c => c.id);
  
  // Lock them
  const { data: locked, error: lockError } = await supabase
    .from("raw_event_staging")
    .update({ 
       status: "processing",
       updated_at: new Date().toISOString()
    })
    .in("id", ids)
    .eq("status", "pending") // Ensure they are still pending
    .select("*"); // Select all fields including payloads

  if (lockError) {
    console.error("Failed to lock rows:", lockError);
    return [];
  }

  // Type assertion since `raw_payload` is JSONB
  return (locked || []).map((row: any) => ({
      ...row,
      raw_payload: row.raw_payload as RawEventCard 
  }));
}

// Helper: Complete row
async function completeRow(supabase: SupabaseClient, id: string, eventId?: string) {
  await supabase.from("raw_event_staging").update({
    status: "completed",
    updated_at: new Date().toISOString() // Trigger will handle this too but good practice
  }).eq("id", id);
}

// Helper: Fail row
async function failRow(supabase: SupabaseClient, id: string, errorMsg: string) {
  await supabase.from("raw_event_staging").update({
    status: "failed",
    error_message: errorMsg,
    updated_at: new Date().toISOString()
  }).eq("id", id);
}

// Helper: Check existence (Deduplication)
async function checkDuplicate(supabase: SupabaseClient, contentHash: string, fingerprint: string, sourceId: string): Promise<boolean> {
  // Check content hash
  const { data: hashData } = await supabase.from("events").select("id").eq("content_hash", contentHash).limit(1);
  if (hashData && hashData.length > 0) return true;

  // Check fingerprint
  const { data: fpData } = await supabase.from("events").select("id").eq("source_id", sourceId).eq("event_fingerprint", fingerprint).limit(1);
  if (fpData && fpData.length > 0) return true;

  return false;
}

async function processRow(
  supabase: SupabaseClient, 
  row: StagingRow, 
  aiApiKey: string
): Promise<{ success: boolean; error?: string; parsingMethod?: string }> {
  try {
    const raw = row.raw_payload;
    const sourceId = row.source_id;
    let parsingMethod: string = 'ai'; // Default

    // 0. Check if delta-skipped
    if (row.status === 'skipped_no_change') {
      await completeRow(supabase, row.id);
      // Increment savings counter on source
      try {
        await supabase.rpc('increment_savings_counter', { p_source_id: sourceId });
      } catch { /* ignore if RPC doesn't exist */ }
      return { success: true, parsingMethod: 'skipped_no_change' };
    }

    // 1. HYBRID PARSING: Try JSON-LD first (deterministic)
    let normalized: NormalizedEvent | null = null;
    
    // Import dynamically to avoid circular deps
    const { extractJsonLdEvents, isJsonLdComplete, jsonLdToNormalized } = await import("../_shared/jsonLdParser.ts");
    
    // Try extracting from raw HTML first
    const htmlToSearch = raw.rawHtml || '';
    const jsonLdEvents = extractJsonLdEvents(htmlToSearch);
    
    if (jsonLdEvents && jsonLdEvents.length > 0) {
      // Find first complete event
      const completeEvent = jsonLdEvents.find(isJsonLdComplete);
      if (completeEvent) {
        normalized = jsonLdToNormalized(completeEvent);
        parsingMethod = 'deterministic';
        console.log(`[${row.id}] Using deterministic JSON-LD parsing`);
      }
    }
    
    // 2. FALLBACK: AI Parsing if JSON-LD incomplete/missing
    if (!normalized || !normalized.title || !normalized.event_date) {
      // Try cheap normalization first
      const dummySource = { id: sourceId, name: "Staging", country: "NL", language: "nl" };
      normalized = cheapNormalizeEvent(raw, dummySource as any);
      
      // Then try AI for rich extraction
      try {
        const aiParsed = await parseDetailedEventWithAI(
          aiApiKey, 
          raw, 
          row.detail_html, 
          fetch, 
          { targetYear: new Date().getFullYear(), language: "nl" }
        );
        
        if (aiParsed) {
          normalized = {
            ...(normalized || {}),
            ...aiParsed,
            title: aiParsed.title || normalized?.title || raw.title,
            event_date: aiParsed.event_date || normalized?.event_date,
            description: aiParsed.description || normalized?.description || raw.description,
            image_url: aiParsed.image_url || normalized?.image_url || raw.imageUrl
          };
          parsingMethod = 'ai';
        }
      } catch (e) {
        console.warn(`AI parsing failed for row ${row.id}`, e);
      }
    }

    // 3. Raw fallback if still null
    if (!normalized && raw.title) {
      normalized = {
        title: raw.title,
        description: raw.description || '',
        event_date: raw.date || '',
        event_time: 'TBD',
        image_url: raw.imageUrl || null,
        venue_name: raw.location || '',
        internal_category: 'community' as any
      };
      parsingMethod = 'ai'; // Still counts as non-deterministic
    }

    if (!normalized?.title || !normalized?.event_date) {
      return { success: false, error: "Validation Failed: Missing Title or Date", parsingMethod };
    }

    // Update staging row with parsing method
    await supabase.from("raw_event_staging").update({ parsing_method: parsingMethod }).eq("id", row.id);

    // 3. Deduplication
    const contentHash = await createContentHash(normalized.title, normalized.event_date);
    const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);

    const isDuplicate = await checkDuplicate(supabase, contentHash, fingerprint, sourceId);
    if (isDuplicate) {
      await failRow(supabase, row.id, "Duplicate Detected");
      return { success: false, error: "Duplicate" }; // Not really a failure, but we mark row as failed/skipped
    }

    // 4. Embedding
    let embedding: number[] | null = null;
    try {
      const textToEmbed = eventToText(normalized);
      const embedRes = await generateEmbedding(aiApiKey, textToEmbed, fetch);
      if (embedRes) embedding = embedRes.embedding;
    } catch (e) {
      console.warn(`Embedding failed for ${row.id}`, e);
    }

    // 5. Insert to Production
    const normalizedDate = normalizeEventDateForStorage(
      normalized.event_date,
      normalized.event_time === "TBD" ? "12:00" : normalized.event_time
    );

    const eventInsert: Record<string, unknown> = {
      title: normalized.title,
      description: normalized.description || "",
      category: normalized.internal_category || "community",
      event_type: "anchor",
      venue_name: normalized.venue_name || "",
      location: "POINT(0 0)",
      event_date: normalizedDate.timestamp,
      event_time: normalized.event_time || "TBD",
      image_url: normalized.image_url,
      created_by: null,
      status: "published",
      source_id: sourceId,
      content_hash: contentHash,
      event_fingerprint: fingerprint
    };

    if (embedding) {
      eventInsert.embedding = embedding;
      eventInsert.embedding_generated_at = new Date().toISOString();
      eventInsert.embedding_model = 'text-embedding-3-small'; // or whatever model used
    }

    const { error: insertError } = await supabase.from("events").insert(eventInsert);
    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
         await failRow(supabase, row.id, "Duplicate (Constraint)");
         return { success: false, error: "Duplicate" };
      }
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    // 6. Complete
    await completeRow(supabase, row.id);
    return { success: true };

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await failRow(supabase, row.id, msg);
    return { success: false, error: msg };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;
    
    if (!openaiApiKey) throw new Error("Missing OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Claim
    const rows = await claimPendingRows(supabase);
    if (rows.length === 0) {
      return new Response(JSON.stringify({ message: "No pending rows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Processor: Picked up ${rows.length} rows`);

    // 2. Process Batch
    const results = await Promise.allSettled(rows.map(row => processRow(supabase, row, openaiApiKey)));

    // 3. Stats
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failCount = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    // 4. Chain Trigger if batch was full (to drain queue)
    if (rows.length === BATCH_SIZE) {
       // Fire and forget next batch
       fetch(`${supabaseUrl}/functions/v1/process-worker`, {
            method: "POST",
            headers: { 
              "Authorization": `Bearer ${supabaseKey}`,
              "Content-Type": "application/json"
            }
       }).catch(e => console.error("Chain trigger failed", e));
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: rows.length, 
      succeeded: successCount, 
      failed: failCount 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Processor Critical Failure:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
