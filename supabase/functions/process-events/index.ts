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
      const log: any[] = [];

      // Helper to log
      const addLog = (msg: string, data?: any) => {
        const entry = { time: new Date().toISOString(), msg, ...data };
        log.push(entry);
        console.log(`Processor [${rowId}]: ${msg}`);
      };

      // 1. Try deterministic JSON-LD parsing
      try {
        const jsonLdEvents = extractJsonLdEvents(rawHtml);
        if (jsonLdEvents && jsonLdEvents.length > 0) {
          const complete = jsonLdEvents.find(isJsonLdComplete);
          if (complete) {
            normalized = jsonLdToNormalized(complete);
            parsingMethod = "deterministic";
            addLog("JSON-LD extraction successful");
          } else {
            addLog("JSON-LD found but incomplete", { count: jsonLdEvents.length });
          }
        } else {
          addLog("No JSON-LD found");
        }
      } catch (e) {
        addLog("JSON-LD extraction error", { error: String(e) });
      }

      // 2. Fallback to AI if needed
      if (!normalized) {
        try {
          addLog("Attempting AI extraction...");
          const aiResult = await parseEventWithAI(openAiApiKey, { 
            rawHtml, 
            title: "", 
            description: "", 
            date: "", 
            location: "",
            detailUrl: "" 
          } as any, fetch, { language: "nl" });
          
          if (aiResult && aiResult.title && aiResult.event_date) {
            normalized = aiResult;
            parsingMethod = "ai";
            addLog("AI extraction successful");
          } else {
            addLog("AI extraction returned incomplete data", { result: aiResult });
          }
        } catch (e) {
          addLog("AI extraction error", { error: String(e) });
        }
      }

      // 3. Last fallback: Heuristic normalize (DOM-based)
      if (!normalized) {
        try {
          addLog("Attempting Heuristic (DOM) fallback...");
          const { data: source } = await supabase.from("scraper_sources").select("*").eq("id", sourceId).single();
          if (source) {
            // For DOM-based, we need a better guess than "Unknown/TBD" if possible
            // But if it's a raw page, we'll try to find a title in the HTML
            const $ = cheerio.load(rawHtml);
            const pageTitle = $("title").text() || "Unknown";
            
            normalized = cheapNormalizeEvent({ 
              rawHtml, 
              title: pageTitle, 
              description: "", 
              date: "TBD", // scraperUtils handles date extraction if we pass TBD? No.
              location: source.name,
              detailUrl: source.url 
            } as any, source as any);
            
            if (normalized && normalized.title && normalized.event_date) {
              parsingMethod = "dom_heuristic";
              addLog("Heuristic fallback successful");
            } else {
              addLog("Heuristic fallback failed to produce title/date");
            }
          }
        } catch (e) {
          addLog("Heuristic fallback error", { error: String(e) });
        }
      }

      // Update staging with log and outcome
      const updateData: any = { processing_log: log, parsing_method: parsingMethod };

      if (!normalized || !normalized.title || !normalized.event_date) {
        addLog("Marking as failed: Missing title or date");
        await supabase.from("raw_event_staging").update({ ...updateData, status: "failed" }).eq("id", rowId);
        continue;
      }

      // Deduplication
      const contentHash = await createContentHash(normalized.title, normalized.event_date);
      const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);
      const isDup = await checkDuplicate(supabase, contentHash, fingerprint, sourceId);
      
      if (isDup) {
        addLog("Marking as completed: Duplicate found");
        await supabase.from("raw_event_staging").update({ ...updateData, status: "completed" }).eq("id", rowId);
        continue;
      }

      // Final Prep for Insertion
      const { data: sourceObj } = await supabase.from("scraper_sources").select("*").eq("id", sourceId).single();
      const defaultCoords = sourceObj?.default_coordinates || sourceObj?.config?.default_coordinates;
      const point = defaultCoords ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})` : "POINT(5.3265 53.2104)";

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

      const inserted = await insertEvent(supabase, eventInsert);
      if (inserted) {
        addLog("Successfully inserted event");
        await supabase.from("raw_event_staging").update({ ...updateData, status: "completed" }).eq("id", rowId);
      } else {
        addLog("Insertion failed");
        await supabase.from("raw_event_staging").update({ ...updateData, status: "failed" }).eq("id", rowId);
      }
    }

    return new Response(JSON.stringify({ message: "Processed batch" }), { status: 200 });
  } catch (err) {
    console.error("Processor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
