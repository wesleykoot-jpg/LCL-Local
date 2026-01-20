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
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { resolveStrategy } from "../_shared/strategies.ts";
import { RawEventCard } from "../_shared/types.ts";

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

        // 1. Discovery Phase: Use Strategy to find cards in the raw HTML
        addLog("Starting discovery phase...");
        const strategy = resolveStrategy(source.config?.strategy, source as any);
        const cards = await strategy.parseListing(rawHtml, source.url, { enableDebug: true });
        addLog(`Discovered ${cards.length} cards`);

          if (jsonLdEvents?.length) {
            addLog("Whole page contains JSON-LD event(s)");
            cards.push(...jsonLdEvents.map(e => ({ title: (e as any).name || "Unknown", rawHtml } as any)));
          }

        for (const card of cards) {
          let normalized: any = null;
          let parsingMethod: string | null = null;
          addLog(`Processing card: ${card.title}`);

          // A. JSON-LD for this specific card HTML
          try {
            const cardJsonLd = extractJsonLdEvents(card.rawHtml || rawHtml);
            if (cardJsonLd?.length) {
              const complete = cardJsonLd.find(isJsonLdComplete);
              if (complete) {
                normalized = jsonLdToNormalized(complete);
                parsingMethod = "deterministic";
                addLog(`- JSON-LD success for ${card.title}`);
              }
            }
          } catch (e) { addLog(`- JSON-LD card error: ${e}`); }

          // B. AI Fallback
          if (!normalized) {
            try {
              addLog(`- Attempting AI for ${card.title}`);
              const aiResult = await parseEventWithAI(openAiApiKey, { 
                rawHtml: card.rawHtml || rawHtml, 
                title: card.title, 
                description: card.description || "", 
                date: card.date || "", 
                location: card.location || source.name,
                detailUrl: card.detailUrl || "" 
              } as any, fetch, { language: source.language || "nl" });
              
              if (aiResult?.title && aiResult?.event_date) {
                normalized = aiResult;
                parsingMethod = "ai";
                addLog(`  - AI success for ${card.title}`);
              }
            } catch (e) { addLog(`  - AI error for ${card.title}: ${e}`); }
          }

          // C. DOM Heuristic
          if (!normalized) {
            normalized = cheapNormalizeEvent(card, source as any);
            if (normalized?.title && normalized?.event_date) {
              parsingMethod = "dom_heuristic";
              addLog(`- Heuristic success for ${card.title}`);
            }
          }

          // D. Validation & Insertion
          if (normalized?.title && normalized?.event_date) {
            const contentHash = await createContentHash(normalized.title, normalized.event_date);
            const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);
            const isDup = await checkDuplicate(supabase, contentHash, fingerprint, sourceId);
            
            if (!isDup) {
              const defaultCoords = source.default_coordinates || source.config?.default_coordinates;
              const point = defaultCoords ? `POINT(${defaultCoords.lng} ${defaultCoords.lat})` : "POINT(6.5665 53.2192)";
              
              const success = await insertEvent(supabase, {
                ...normalized,
                venue_name: normalized.venue_name || source.name,
                location: point,
                source_id: sourceId,
                event_fingerprint: fingerprint,
                content_hash: contentHash,
                status: "published"
              });
              if (success) totalSuccess++;
            } else {
              addLog(`- Skipped ${card.title} (Duplicate)`);
            }
          } else {
            addLog(`- Failed ${card.title} (Missing title/date)`);
          }
        }

        // Finalize Row
        const status = (cards.length > 0 && totalSuccess > 0) ? "completed" : (cards.length > 0 ? "failed" : "failed");
        // Actually, if we found cards but none were new/valid, maybe "completed" if duplicates, or "failed" if all invalid.
        await supabase.from("raw_event_staging").update({
          status: totalSuccess > 0 ? "completed" : (cards.length > 0 ? "completed" : "failed"),
          processing_log: log,
          parsing_method: "multi_hybrid"
        }).eq("id", rowId);

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
