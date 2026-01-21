
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
      try {
        await supabase.rpc('increment_savings_counter', { p_source_id: sourceId });
      } catch { /* ignore */ }
      return { success: true, parsingMethod: 'skipped_no_change' };
    }

    // 1. HYBRID PARSING (The Sorting Arm)
    let normalized: NormalizedEvent | null = null;
    
    // Import dynamically
    const { extractJsonLdEvents, isJsonLdComplete, jsonLdToNormalized } = await import("../_shared/jsonLdParser.ts");
    
    // Fast Path: JSON-LD
    const htmlToSearch = raw.rawHtml || '';
    const jsonLdEvents = extractJsonLdEvents(htmlToSearch);
    
    if (jsonLdEvents && jsonLdEvents.length > 0) {
      const completeEvent = jsonLdEvents.find(isJsonLdComplete);
      if (completeEvent) {
        normalized = jsonLdToNormalized(completeEvent);
        parsingMethod = 'deterministic';
        console.log(`[${row.id}] Fast Path: JSON-LD`);
      }
    }
    
    // Slow Path: AI
    if (!normalized || !normalized.title || !normalized.event_date) {
      // Cheap fallback
      const dummySource = { id: sourceId, name: "Staging", country: "NL", language: "nl" };
      normalized = cheapNormalizeEvent(raw, dummySource as any);
      
      // AI Extraction
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
            image_url: aiParsed.image_url || normalized?.image_url || raw.imageUrl,
            persona_tags: aiParsed.persona_tags
          };
          parsingMethod = 'ai';
          console.log(`[${row.id}] Slow Path: AI Extraction`);
        }
      } catch (e) {
        console.warn(`AI parsing failed for row ${row.id}`, e);
      }
    }

    // Fallback
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
      parsingMethod = 'ai_fallback';
    }

    if (!normalized?.title || !normalized?.event_date) {
      return { success: false, error: "Validation Failed: Missing Title or Date", parsingMethod };
    }

    await supabase.from("raw_event_staging").update({ parsing_method: parsingMethod }).eq("id", row.id);

    // 2. THE POLISHER (Enrichment)
    
    // Geocoding
    const { geocodeLocation, optimizeImage } = await import("../_shared/enrichment.ts");
    // Get Mapbox token from env or somewhere. Ideally strictly managed.
    // For now assuming it might be in env or we skip if missing.
    const mapboxToken = Deno.env.get("MAPBOX_ACCESS_TOKEN"); 
    
    if (mapboxToken && normalized.venue_name && (!normalized.venue_address || normalized.venue_address.length < 5)) {
        // If we have a venue name but no good address, OR we just want to geocode the string we have
        const query = normalized.venue_address || normalized.venue_name; 
        if (query) {
             const geo = await geocodeLocation(query, mapboxToken);
             if (geo) {
                 // Store geo somewhere? normalized.location is string "POINT(..)" legacy.
                 // We construct it below.
                 // We can attach it to normalized to be used in construction.
                 (normalized as any)._geo = geo;
             }
        }
    }

    // Image Optimization
    // Download and upload to storage to prevent link rot
    // Only if image is remote and not already ours
    if (normalized.image_url && normalized.image_url.startsWith('http') && !normalized.image_url.includes('supabase.co')) {
        const optimizedUrl = await optimizeImage(supabase, normalized.image_url, row.id);
        if (optimizedUrl) {
            normalized.image_url = optimizedUrl;
        }
    }

    // 3. THE VAULT (Merge/Upsert)
    const contentHash = await createContentHash(normalized.title, normalized.event_date);
    const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);

    // Check for existing event by fingerprint (Golden Record logic)
    // We want to merge if exists.
    const { data: existingEvents } = await supabase
        .from("events")
        .select("id, description, tickets_url, image_url, venue_name, source_id")
        .eq("event_fingerprint", fingerprint)
        .limit(1);

    const existing = existingEvents?.[0];

    const normalizedDate = normalizeEventDateForStorage(
      normalized.event_date,
      normalized.event_time === "TBD" ? "12:00" : normalized.event_time
    );

    // Construct common payload
    const eventPayload: any = {
      title: normalized.title,
      category: normalized.internal_category || "community",
      event_type: "anchor",
      event_date: normalizedDate.timestamp,
      event_time: normalized.event_time || "TBD",
      status: "published",
      source_id: sourceId,
      content_hash: contentHash,
      event_fingerprint: fingerprint,
      updated_at: new Date().toISOString()
    };
    
    // Handle Location (PostGIS)
    const geo = (normalized as any)._geo;
    if (geo) {
        eventPayload.location = `POINT(${geo.lng} ${geo.lat})`;
    } else {
        // Default 0,0 or keep existing if merge? 
        // If new, 0,0.
        if (!existing) eventPayload.location = "POINT(0 0)";
    }

    // Embedding
    let embedding: number[] | null = null;
    try {
      const textToEmbed = eventToText(normalized);
      const embedRes = await generateEmbedding(aiApiKey, textToEmbed, fetch);
      if (embedRes) {
          eventPayload.embedding = embedRes.embedding;
          eventPayload.embedding_generated_at = new Date().toISOString();
          eventPayload.embedding_model = 'text-embedding-3-small';
      }
    } catch (e) { console.warn("Embedding failed", e); }

    if (existing) {
        // MERGE LOGIC
        // 1. Description: Prefer existing if existing source is "Venue" (we need to know tier, simple heuristic: longer description wins?)
        // Let's say we prefer the NEW description if it's significantly longer, otherwise keep existing.
        // OR: just append/overwrite based on simple rule.
        // Plan says: "Keep description from Venue (better quality) but add ticket link from Facebook".
        // Implementation: We don't know source tiers here easily without DB lookup on source.
        // Simple merge: 
        if (!existing.description || (normalized.description && normalized.description.length > existing.description.length)) {
             eventPayload.description = normalized.description;
        }
        
        if (normalized.image_url) eventPayload.image_url = normalized.image_url;
        if (normalized.venue_name) eventPayload.venue_name = normalized.venue_name;
        
        // Persona Tags - currently storing in separate table or array?
        // Plan says "Add persona_tags column to events".
        if (normalized.persona_tags) eventPayload.persona_tags = normalized.persona_tags;

        // Perform Update
        const { error: updateError } = await supabase
            .from("events")
            .update(eventPayload)
            .eq("id", existing.id);
            
        if (updateError) throw new Error(`Merge failed: ${updateError.message}`);
        console.log(`[${row.id}] Merged into existing event ${existing.id}`);

    } else {
        // INSERT NEW
        eventPayload.description = normalized.description || "";
        eventPayload.venue_name = normalized.venue_name || "";
        eventPayload.image_url = normalized.image_url;
        if (normalized.persona_tags) eventPayload.persona_tags = normalized.persona_tags;
        
        const { error: insertError } = await supabase.from("events").insert(eventPayload);
        if (insertError) {
             // Handle race condition where it was created in between
             if (insertError.code === '23505') {
                 console.log(`[${row.id}] Duplicate detected during insert (race condition), marking done.`);
             } else {
                 throw new Error(`Insert failed: ${insertError.message}`);
             }
        }
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
