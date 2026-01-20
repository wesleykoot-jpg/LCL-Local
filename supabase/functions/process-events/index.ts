// process-events/index.ts
// Processor Edge Function: reads pending rows from raw_event_staging,
// attempts deterministic JSON-LD parsing first, falls back to AI parsing,
// inserts into events table, and updates staging status and parsing_method.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey, openAiApiKey } from "../_shared/env.ts";
import { 
  cheapNormalizeEvent, 
  createContentHash, 
  createEventFingerprint, 
  checkDuplicate, 
  insertEvent 
} from "../_shared/scraperUtils.ts";
import { parseEventWithAI } from "../_shared/aiParsing.ts";
import { 
  extractJsonLdEvents, 
  isJsonLdComplete, 
  jsonLdToNormalized 
} from "../_shared/jsonLdParser.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const handler = async (req: Request): Promise<Response> => {
  try {
    // Fetch pending rows
    const { data: rows, error: fetchErr } = await supabase
      .from("raw_event_staging")
      .select("id, source_id, raw_html, status, parsing_method")
      .eq("status", "pending")
      .limit(10); // Batch size
    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ message: "No pending rows" }), { status: 200 });
    }

    console.log(`Processor: Picked up ${rows.length} rows`);

    for (const row of rows) {
      const rowId = row.id as string;
      const sourceId = row.source_id as string;
      const rawHtml = row.raw_html as string;
      let parsingMethod: string | null = null;
      let normalized: any = null;

      // 1. Try deterministic JSON-LD parsing
      try {
        const jsonLdEvents = extractJsonLdEvents(rawHtml);
        if (jsonLdEvents && jsonLdEvents.length > 0) {
          const complete = jsonLdEvents.find(isJsonLdComplete);
          if (complete) {
            normalized = jsonLdToNormalized(complete);
            parsingMethod = "deterministic";
            console.log(`Row ${rowId}: JSON-LD successful`);
          }
        }
      } catch (e) {
        console.warn(`JSON-LD extraction failed for row ${rowId}:`, e);
      }

      // 2. Fallback to AI if needed
      if (!normalized) {
        // AI parsing needs some context, we'll try to extract what we can
        try {
          // parseEventWithAI needs a fetcher (dummy fetch for now as it's not fetching anything external)
          const aiResult = await parseEventWithAI(openAiApiKey, { 
            rawHtml, 
            title: "", 
            description: "", 
            date: "", 
            location: "",
            detailUrl: "" 
          } as any, "nl", fetch);
          
          if (aiResult) {
            normalized = aiResult;
            parsingMethod = "ai";
            console.log(`Row ${rowId}: AI parsing successful`);
          }
        } catch (e) {
          console.warn(`AI parsing failed for row ${rowId}:`, e);
        }
      }

      // 3. Last fallback: Cheap normalize (DOM-based)
      if (!normalized) {
        try {
          // Fetch source info for coordinates/name
          const { data: source } = await supabase.from("scraper_sources").select("*").eq("id", sourceId).single();
          if (source) {
            normalized = cheapNormalizeEvent({ 
              rawHtml, 
              title: "Unknown", 
              description: "", 
              date: "TBD", 
              location: source.name,
              detailUrl: "" 
            } as any, source as any);
            parsingMethod = "cheap";
            console.log(`Row ${rowId}: Cheap normalize fallback`);
          }
        } catch (e) {
          console.warn(`Cheap normalize failed for row ${rowId}:`, e);
        }
      }

      // Validate required fields
      if (!normalized || !normalized.title || !normalized.event_date) {
        console.warn(`Row ${rowId}: Missing title or date, marking as failed`);
        await supabase.from("raw_event_staging").update({ status: "failed", parsing_method: parsingMethod }).eq("id", rowId);
        continue;
      }

      // Deduplication
      const contentHash = await createContentHash(normalized.title, normalized.event_date);
      const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);
      const isDup = await checkDuplicate(supabase, contentHash, fingerprint, sourceId);
      if (isDup) {
        console.log(`Row ${rowId}: Duplicate found, marking as completed`);
        await supabase.from("raw_event_staging").update({ status: "completed", parsing_method: parsingMethod }).eq("id", rowId);
        continue;
      }

      // Final Prep for Insertion
      // We need to fetch source coordinates again if we haven't already
      const { data: sourceObj } = await supabase.from("scraper_sources").select("*").eq("id", sourceId).single();
      const defaultCoords = sourceObj?.default_coordinates || sourceObj?.config?.default_coordinates;
      const point = defaultCoords ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})` : "POINT(5.3265 53.2104)"; // Dummy Harlingen fallback

      const eventInsert = {
        title: normalized.title,
        description: normalized.description || "",
        category: normalized.internal_category || "community",
        event_type: "anchor",
        venue_name: normalized.venue_name || sourceObj?.name || "Unknown",
        location: point,
        event_date: normalized.event_date,
        event_time: normalized.event_time,
        image_url: normalized.image_url,
        status: "published",
        source_id: sourceId,
        event_fingerprint: fingerprint,
        content_hash: contentHash,
      };

      // Insert into events table
      const inserted = await insertEvent(supabase, eventInsert);
      if (inserted) {
        console.log(`Row ${rowId}: Successfully inserted event`);
        await supabase.from("raw_event_staging").update({ status: "completed", parsing_method: parsingMethod }).eq("id", rowId);
      } else {
        console.warn(`Row ${rowId}: Insertion failed`);
        await supabase.from("raw_event_staging").update({ status: "failed", parsing_method: parsingMethod }).eq("id", rowId);
      }
    }

    return new Response(JSON.stringify({ message: "Processed batch" }), { status: 200 });
  } catch (err) {
    console.error("Processor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
