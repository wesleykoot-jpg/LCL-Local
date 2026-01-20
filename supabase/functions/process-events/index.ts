// process-events/index.ts
// Processor Edge Function: reads pending rows from raw_event_staging,
// attempts deterministic JSON-LD parsing first, falls back to AI parsing,
// inserts into events table, and updates staging status and parsing_method.

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey, openAiApiKey } from "../_shared/env.ts";
import { cheapNormalizeEvent, parseEventWithAI, createContentHash, createEventFingerprint, checkDuplicate, insertEvent } from "../process-worker/index.ts"; // reuse existing utilities
import { extractJsonLdEvents, isJsonLdComplete, jsonLdToNormalized } from "../_shared/jsonLdParser.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const handler = async (req: Request): Promise<Response> => {
  try {
    // Fetch pending rows
    const { data: rows, error: fetchErr } = await supabase
      .from("raw_event_staging")
      .select("id, source_id, raw_html, status, parsing_method")
      .eq("status", "pending")
      .limit(100);
    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ message: "No pending rows" }), { status: 200 });
    }

    for (const row of rows) {
      const rowId = row.id as string;
      const sourceId = row.source_id as string;
      const rawHtml = row.raw_html as string;
      let parsingMethod: string | null = null;
      let normalized: any = null;

      // 1. Try deterministic JSON-LD parsing
      const jsonLdEvents = extractJsonLdEvents(rawHtml);
      if (jsonLdEvents && jsonLdEvents.length > 0) {
        const complete = jsonLdEvents.find(isJsonLdComplete);
        if (complete) {
          normalized = jsonLdToNormalized(complete);
          parsingMethod = "deterministic";
        }
      }

      // 2. Fallback to cheap normalize + AI if needed
      if (!normalized) {
        // cheap normalize (needs dummy source object)
        const dummySource = { id: sourceId, name: "Staging", country: "NL", language: "nl" } as any;
        normalized = cheapNormalizeEvent({ rawHtml, title: "", description: "", date: "", location: "" } as any, dummySource);
        // AI parsing for richer data
        try {
          const aiResult = await parseEventWithAI(openAiApiKey, { rawHtml, title: "", description: "", date: "", location: "" } as any, "nl");
          if (aiResult) {
            normalized = { ...normalized, ...aiResult };
            parsingMethod = "ai";
          }
        } catch (e) {
          console.warn(`AI parsing failed for row ${rowId}:`, e);
        }
      }

      // Validate required fields
      if (!normalized || !normalized.title || !normalized.event_date) {
        // Mark as failed
        await supabase.from("raw_event_staging").update({ status: "failed", parsing_method: parsingMethod }).eq("id", rowId);
        continue;
      }

      // Deduplication
      const contentHash = await createContentHash(normalized.title, normalized.event_date);
      const fingerprint = await createEventFingerprint(normalized.title, normalized.event_date, sourceId);
      const isDup = await checkDuplicate(supabase, contentHash, fingerprint, sourceId);
      if (isDup) {
        await supabase.from("raw_event_staging").update({ status: "completed", parsing_method: parsingMethod }).eq("id", rowId);
        continue;
      }

      // Insert into events table
      const inserted = await insertEvent(supabase, normalized);
      if (inserted) {
        await supabase.from("raw_event_staging").update({ status: "completed", parsing_method: parsingMethod }).eq("id", rowId);
      } else {
        await supabase.from("raw_event_staging").update({ status: "failed", parsing_method: parsingMethod }).eq("id", rowId);
      }
    }

    return new Response(JSON.stringify({ message: "Processed batch" }), { status: 200 });
  } catch (err) {
    console.error("Processor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
