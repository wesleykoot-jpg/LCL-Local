// process-events/index.ts
// Processor Edge Function: reads pending rows from raw_event_staging,
// attempts deterministic JSON-LD parsing first, falls back to AI parsing,
// inserts into events table, and updates staging status and parsing_method.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
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

export const handler = async (req: Request): Promise<Response> => {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  try {
    // Fetch pending rows
    const { data: rows, error: fetchErr } = await supabase
      .from("raw_event_staging")
      .select("id, source_id, raw_html, status, parsing_method, source_url")
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
      const log: any[] = [];
      let totalSuccess = 0;

      const addLog = (msg: string, data?: any) => {
        const entry = { time: new Date().toISOString(), msg, ...data };
        log.push(entry);
        console.log(`Processor [${rowId}]: ${msg}`);
      };

      try {
        const { data: source } = await supabase.from("scraper_sources").select("*").eq("id", sourceId).single();
        if (!source) throw new Error("Source not found");

        let normalized: any = null;
        let parsingMethod: string | null = null;

        // 1. JSON-LD for this specific card HTML
        try {
          const cardJsonLd = extractJsonLdEvents(rawHtml);
          if (cardJsonLd?.length) {
            const complete = cardJsonLd.find(isJsonLdComplete);
            if (complete) {
              normalized = jsonLdToNormalized(complete);
              parsingMethod = "deterministic";
              addLog("- JSON-LD success");
            }
          }
        } catch (e) { addLog(`- JSON-LD card error: ${e}`); }

        // 2. AI Fallback
        if (!normalized) {
          try {
            addLog("- Attempting AI extraction...");
            const aiResult = await parseEventWithAI(openAiApiKey, { 
              rawHtml, 
              title: "", // It's just a card, let AI find the title
              description: "", 
              date: "", 
              location: source.name,
              detailUrl: row.source_url || "" 
            } as any, fetch, { language: source.language || "nl" });
            
            if (aiResult?.title && aiResult?.event_date) {
              normalized = aiResult;
              parsingMethod = "ai";
              addLog("  - AI success");
            }
          } catch (e) { addLog(`  - AI error: ${e}`); }
        }

        // 3. DOM Heuristic
        if (!normalized) {
          addLog("- Attempting DOM Heuristic fallback...");
          normalized = cheapNormalizeEvent({ rawHtml, title: "Unknown", detailUrl: row.source_url } as any, source as any);
          if (normalized?.title && normalized?.event_date) {
            parsingMethod = "dom_heuristic";
            addLog("- Heuristic success");
          }
        }

        // 4. Validation & Insertion
        if (normalized?.title && normalized?.event_date) {
          const contentHash = await createContentHash(normalized.title, normalized.event_date);
          const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);
          const isDup = await checkDuplicate(supabase, contentHash, fingerprint, sourceId);
          
          if (!isDup) {
            const defaultCoords = source.default_coordinates || source.config?.default_coordinates;
            const point = defaultCoords ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})` : "POINT(6.5665 53.2192)";
            
            // Sanitize payload: explicitly select known fields to avoid schema errors
            const eventPayload = {
              title: normalized.title,
              description: normalized.description,
              event_type: "anchor", // Must be 'anchor', 'fork', or 'signal'
              event_date: normalized.event_date,
              event_time: normalized.start_time || "00:00:00",
              location: point,
              venue_name: normalized.venue_name || source.name,
              source_url: row.source_url,
              image_url: normalized.image_url,
              price: normalized.price,
              ticket_url: normalized.ticket_url,
              category: normalized.category,
              tags: normalized.tags,
              start_time: normalized.start_time,
              end_time: normalized.end_time,
              source_id: sourceId,
              event_fingerprint: fingerprint,
              content_hash: contentHash,
              status: "published"
            };

            const success = await insertEvent(supabase, eventPayload);
            
            if (success) {
              addLog("Successfully inserted event");
              totalSuccess++;
              await supabase.from("raw_event_staging").update({
                status: "completed",
                processing_log: log,
                parsing_method: parsingMethod
              }).eq("id", rowId);
            } else {
              addLog("Insertion failed");
              await supabase.from("raw_event_staging").update({ status: "failed", processing_log: log }).eq("id", rowId);
            }
          } else {
            addLog("Skipped (Duplicate)");
            await supabase.from("raw_event_staging").update({ status: "completed", processing_log: log, parsing_method: "duplicate" }).eq("id", rowId);
          }
        } else {
          addLog("Failed (Missing title/date)");
          await supabase.from("raw_event_staging").update({ status: "failed", processing_log: log }).eq("id", rowId);
        }

      } catch (err) {
        addLog(`Top-level row error: ${err}`);
        await supabase.from("raw_event_staging").update({ status: "failed", processing_log: log }).eq("id", rowId);
      }
    }

    return new Response(JSON.stringify({ message: "Processed batch" }), { status: 200 });
  } catch (err) {
    console.error("Processor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
