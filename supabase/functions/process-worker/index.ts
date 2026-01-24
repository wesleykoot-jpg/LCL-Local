// @ts-expect-error: Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

import {
  parseDetailedEventWithAI,
  generateEmbedding,
} from "../_shared/aiParsing.ts";

import {
  createContentHash,
  createEventFingerprint,
  normalizeEventDateForStorage,
  cheapNormalizeEvent,
  eventToText,
} from "../_shared/scraperUtils.ts";

import { logError as _logError } from "../_shared/errorLogging.ts";
import type { RawEventCard, NormalizedEvent } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 10;

interface StagingRow {
  id: string;
  source_id: string;
  source_url: string;
  raw_html: string | null;
  detail_html: string | null;
  status: string;
  parsing_method: string | null;
  raw_payload: RawEventCard; // Add raw_payload back as it's added by mapping logic
}

/**
 * Calculates a quality score for an event based on field completeness.
 */
function calculateQualityScore(event: any): number {
  let score = 0;

  // Weights: Title (mandatory), Date (mandatory) - handled by validation

  // Description: +0.3
  if (event.description && event.description.length > 50) {
    score += 0.3;
  } else if (event.description) {
    score += 0.15;
  }

  // Image URL: +0.2
  // Check if it's a real image and not a placeholder or empty
  if (
    event.image_url &&
    event.image_url.startsWith("http") &&
    !event.image_url.includes("placeholder")
  ) {
    score += 0.2;
  }

  // Venue Name: +0.2
  if (
    event.venue_name &&
    event.venue_name !== "TBD" &&
    event.venue_name.length > 2
  ) {
    score += 0.2;
  }

  // Coordinates (Location): +0.2
  // If location is provided and it's not the default POINT(0 0)
  if (event.location && event.location !== "POINT(0 0)") {
    score += 0.2;
  }

  // Correct Year / Metadata: +0.1
  // If the event date is within the next 2 years (reasonable window)
  const eventDate = new Date(event.event_date);
  const now = new Date();
  const twoYearsOut = new Date();
  twoYearsOut.setFullYear(now.getFullYear() + 2);

  if (eventDate >= now && eventDate <= twoYearsOut) {
    score += 0.1;
  }

  return score;
}

// Helper: Claim pending rows atomically using RPC
async function claimPendingRows(
  supabase: SupabaseClient,
): Promise<StagingRow[]> {
  const { data, error } = await supabase.rpc("claim_staging_rows", {
    p_batch_size: BATCH_SIZE,
  });

  if (error) {
    console.error("Failed to claim rows:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Type assertion and schema compatibility layer
  // Handle both old schema (raw_payload JSONB) and new schema (raw_html TEXT)
  return (data || []).map((row: any) => {
    let payload: RawEventCard;

    // Check if we have the old schema (raw_payload as JSONB object)
    if (row.raw_payload && typeof row.raw_payload === "object") {
      payload = row.raw_payload as RawEventCard;
    }
    // New schema: raw_html as TEXT column
    else if (row.raw_html) {
      // Try to parse as JSON first (in case it's structured data)
      if (
        row.raw_html.trim().startsWith("{") ||
        row.raw_html.trim().startsWith("[")
      ) {
        try {
          const parsed = JSON.parse(row.raw_html);
          // If it's an object with event data, use it
          payload = parsed.rawHtml
            ? parsed
            : ({ rawHtml: row.raw_html, ...parsed } as any);
        } catch {
          // Not valid JSON, treat as raw HTML
          payload = { rawHtml: row.raw_html } as any;
        }
      } else {
        // Plain HTML string
        payload = { rawHtml: row.raw_html } as any;
      }
    }
    // Fallback: empty payload
    else {
      console.warn(`Row ${row.id} has no raw_payload or raw_html`);
      payload = { rawHtml: "" } as any;
    }

    return {
      ...row,
      source_url: row.source_url || (payload as any).detailUrl || "",
      raw_payload: payload,
    };
  });
}

// Helper: Complete row
async function completeRow(
  supabase: SupabaseClient,
  id: string,
  _eventId?: string,
) {
  await supabase
    .from("raw_event_staging")
    .update({
      status: "completed",
      updated_at: new Date().toISOString(), // Trigger will handle this too but good practice
    })
    .eq("id", id);
}

// Helper: Fail row with retry logic
async function failRow(supabase: SupabaseClient, id: string, errorMsg: string) {
  // 1. Get current retry count
  const { data: row } = await supabase
    .from("raw_event_staging")
    .select("retry_count")
    .eq("id", id)
    .single();

  const currentRetries = row?.retry_count || 0;
  const newRetries = currentRetries + 1;
  const maxRetries = 3;

  // 2. Decide status
  // If we hit max retries, we stay 'failed'.
  // If less, we set back to 'pending' to retry, OR keep 'failed' but allow a mechanic to pick it up?
  // Requirements say "failed" usually implies intervention. But "Do not retry indefinitely" implies we DO retry.
  // Standard pattern: Set to 'pending' for immediate retry, or 'pending' with a delay (updated_at future?).
  // For simplicity, we set to 'pending' to try again next batch.
  const newStatus = newRetries >= maxRetries ? "failed" : "pending";

  await supabase
    .from("raw_event_staging")
    .update({
      status: newStatus,
      retry_count: newRetries,
      error_message: errorMsg,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  console.log(
    `[${id}] Failed. Retry ${newRetries}/${maxRetries}. Status: ${newStatus}. Error: ${errorMsg}`,
  );
}

// Helper: Check existence (Deduplication) - Used for pre-check if needed, but we do merge now.
// Keeping for reference or fallback if needed, but marking unused in linter if we drop usage.
async function _checkDuplicate(
  supabase: SupabaseClient,
  contentHash: string,
  fingerprint: string,
  sourceId: string,
): Promise<boolean> {
  // Check content hash
  const { data: hashData } = await supabase
    .from("events")
    .select("id")
    .eq("content_hash", contentHash)
    .limit(1);
  if (hashData && hashData.length > 0) return true;

  // Check fingerprint
  const { data: fpData } = await supabase
    .from("events")
    .select("id")
    .eq("source_id", sourceId)
    .eq("event_fingerprint", fingerprint)
    .limit(1);
  if (fpData && fpData.length > 0) return true;

  return false;
}

async function processRow(
  supabase: SupabaseClient,
  row: StagingRow,
  aiApiKey: string,
): Promise<{ success: boolean; error?: string; parsingMethod?: string }> {
  try {
    const raw = row.raw_payload;
    const sourceId = row.source_id;
    const sourceUrl = row.source_url;

    // 1. HYBRID PARSING (The Sorting Arm)
    let normalized: NormalizedEvent | null = null;
    let parsingMethod: string = "ai"; // Default
    let healingAttempted = false;

    // Helper to run AI parsing
    const runAIParsing = async (htmlContent: string | null) => {
      try {
        return await parseDetailedEventWithAI(
          aiApiKey,
          raw,
          htmlContent,
          fetch,
          { targetYear: new Date().getFullYear(), language: "nl" },
        );
      } catch (e) {
        console.warn(`AI parsing failed for row ${row.id}`, e);
        return null;
      }
    };

    // Check if we have a trusted method from the scraper
    // TRUSTED METHODS: If we already have high-fidelity data, skip expensive AI extraction
    const trustedMethods = ["hydration", "json_ld", "microdata", "feed"];
    // Cast to check properties that might exist on row (if we updated the StagingRow interface) or in raw_payload
    const rowAny = row as any;
    const existingMethod =
      rowAny.parsing_method || (row.raw_payload as any).parsingMethod;

    if (existingMethod && trustedMethods.includes(existingMethod)) {
      console.log(
        `[${row.id}] Trusted Method: ${existingMethod} (Skipping AI)`,
      );
      parsingMethod = existingMethod;

      const dummySource = {
        id: sourceId,
        name: "Staging",
        country: "NL",
        language: "nl",
      };
      const norm = cheapNormalizeEvent(raw, dummySource as any);

      if (norm && norm.title && norm.event_date) {
        normalized = norm;
      }
    }

    // Fast Path: JSON-LD (Only if not already normalized by trusted path)
    if (!normalized) {
      // Import dynamically
      const { extractJsonLdEvents, isJsonLdComplete, jsonLdToNormalized } =
        await import("../_shared/jsonLdParser.ts");

      const htmlToSearch = raw.rawHtml || "";
      const jsonLdEvents = extractJsonLdEvents(htmlToSearch);

      if (jsonLdEvents && jsonLdEvents.length > 0) {
        const completeEvent = jsonLdEvents.find(isJsonLdComplete);
        if (completeEvent) {
          normalized = jsonLdToNormalized(completeEvent);
          parsingMethod = "deterministic";
          console.log(`[${row.id}] Fast Path: JSON-LD`);
        }
      }
    }

    // Slow Path: AI
    if (!normalized || !normalized.title || !normalized.event_date) {
      // Cheap fallback
      const dummySource = {
        id: sourceId,
        name: "Staging",
        country: "NL",
        language: "nl",
      };
      normalized = cheapNormalizeEvent(raw, dummySource as any);

      // AI Extraction
      const aiParsed = await runAIParsing(row.detail_html);

      if (aiParsed) {
        normalized = {
          ...(normalized || {}),
          ...aiParsed,
          title: aiParsed.title || normalized?.title || raw.title,
          event_date: aiParsed.event_date || normalized?.event_date,
          description:
            aiParsed.description || normalized?.description || raw.description,
          image_url:
            aiParsed.image_url || normalized?.image_url || raw.imageUrl,
          persona_tags: aiParsed.persona_tags,
        };
        parsingMethod = "ai";
        console.log(`[${row.id}] Slow Path: AI Extraction`);
      }
    }

    // 1.5 SELF-HEALING (The Second Chance)
    // If score is low and we haven't fetched detail_html yet, try to fetch it and re-parse
    if (
      normalized &&
      !row.detail_html &&
      sourceUrl &&
      sourceUrl.startsWith("http")
    ) {
      const tempScore = calculateQualityScore({
        ...normalized,
        location: (normalized as any)._geo
          ? `POINT(${(normalized as any)._geo.lng} ${(normalized as any)._geo.lat})`
          : "POINT(0 0)",
        event_date: normalizeEventDateForStorage(
          normalized.event_date,
          normalized.event_time === "TBD" ? "12:00" : normalized.event_time,
        ).timestamp,
      });

      if (tempScore < 0.6) {
        console.log(
          `[${row.id}] Low quality score (${tempScore}), triggering self-healing...`,
        );
        try {
          const { StaticPageFetcher } =
            await import("../_shared/strategies.ts");
          const fetcher = new StaticPageFetcher();
          const { html: detailHtml } = await fetcher.fetchPage(sourceUrl);

          if (detailHtml && detailHtml.length > 500) {
            // Store detail HTML for future use
            await supabase
              .from("raw_event_staging")
              .update({ detail_html: detailHtml })
              .eq("id", row.id);

            // Re-run AI extraction with full detail HTML
            const healedParsed = await runAIParsing(detailHtml);
            if (healedParsed) {
              normalized = {
                ...normalized,
                ...healedParsed,
                title: healedParsed.title || normalized.title,
                event_date: healedParsed.event_date || normalized.event_date,
                description: healedParsed.description || normalized.description,
                image_url: healedParsed.image_url || normalized.image_url,
              };
              healingAttempted = true;
              console.log(`[${row.id}] Self-healing successful.`);
            }
          }
        } catch (healError) {
          console.warn(`[${row.id}] Self-healing failed:`, healError);
        }
      }
    }

    // Fallback
    if (!normalized && raw.title) {
      normalized = {
        title: raw.title,
        description: raw.description || "",
        event_date: raw.date || "",
        event_time: "TBD",
        image_url: raw.imageUrl || null,
        venue_name: raw.location || "",
        category: "COMMUNITY" as any,
      };
      parsingMethod = "ai_fallback";
    }

    if (!normalized?.title || !normalized?.event_date) {
      return {
        success: false,
        error: "Validation Failed: Missing Title or Date",
        parsingMethod,
      };
    }

    await supabase
      .from("raw_event_staging")
      .update({ parsing_method: parsingMethod })
      .eq("id", row.id);

    // 2. THE POLISHER (Enrichment)
    const { geocodeLocation, optimizeImage } =
      await import("../_shared/enrichment.ts");

    if (
      normalized.venue_name &&
      (!normalized.venue_address || normalized.venue_address.length < 5)
    ) {
      try {
        const query = normalized.venue_address || normalized.venue_name;
        if (query) {
          const geo = await geocodeLocation(query);
          if (geo) {
            (normalized as any)._geo = geo;
          }
        }
      } catch (geoError) {
        // Non-blocking: Continue with default location if geocoding fails
        console.warn(`[${row.id}] Geocoding failed (non-blocking):`, geoError);
      }
    }

    // Image Optimization (non-blocking - quality over speed)
    // Download and upload to storage to prevent link rot
    // Only if image is remote and not already ours
    if (
      normalized.image_url &&
      normalized.image_url.startsWith("http") &&
      !normalized.image_url.includes("supabase.co")
    ) {
      try {
        const optimizedUrl = await optimizeImage(
          supabase,
          normalized.image_url,
          row.id,
        );
        if (optimizedUrl) {
          normalized.image_url = optimizedUrl;
        }
      } catch (imgError) {
        // Non-blocking: Continue with original URL if optimization fails
        console.warn(
          `[${row.id}] Image optimization failed (non-blocking):`,
          imgError,
        );
      }
    }

    // 3. THE VAULT (Merge/Upsert)
    const contentHash = await createContentHash(
      normalized.title,
      normalized.event_date,
    );
    const fingerprint = await createEventFingerprint(
      normalized.title,
      normalized.event_date,
      sourceId,
    );

    // Check for existing event by fingerprint (Golden Record logic)
    // Universal Deduplication: Check across ALL sources, not just the current sourceId
    const { data: existingEvents } = await supabase
      .from("events")
      .select("id, description, tickets_url, image_url, venue_name, source_id")
      .eq("event_fingerprint", fingerprint) // Fingerprint is title|date|sourceId, wait...
      // Actually, for universal dedup, we should check content_hash (title|date)
      .or(`content_hash.eq.${contentHash},event_fingerprint.eq.${fingerprint}`)
      .limit(1);

    const existing = existingEvents?.[0];

    // 7. Categorize and Tag
    const { mapToCategoryKey, extractTags, isProbableEvent } =
      await import("../_shared/categorizer.ts");
    const { CATEGORY_KEYS } = await import("../_shared/types.ts");

    // Attempt to get source category key if available
    const { data: source } = await supabase
      .from("scraper_sources")
      .select("category_key")
      .eq("id", sourceId)
      .single();

    const categoryKey = mapToCategoryKey(
      `${normalized.title} ${normalized.description}`,
      source?.category_key as any,
      row.url,
    );

    // Performance: Only extract tags if we have content
    const tags = extractTags(
      `${normalized.title} ${normalized.description}`,
      categoryKey as any,
    );

    // 8. Quality Check: Filter out noise (comments, etc.)
    if (!isProbableEvent(normalized.title, normalized.description)) {
      console.log(`Skipping non-event row ${row.id}: "${normalized.title}"`);
      await supabase
        .from("raw_event_staging")
        .update({
          status: "completed",
          processing_log: [
            ...(rowAny.processing_log || []),
            `Skipped as non-event noise: ${normalized.title}`,
          ],
        })
        .eq("id", row.id);
      return { success: true, parsingMethod }; // Return success as it's "processed" by being skipped
    }

    normalized.category = categoryKey as any;
    normalized.tags = tags;

    // Final Enrichment & Post-Processing
    const normalizedDate = normalizeEventDateForStorage(
      normalized.event_date,
      normalized.event_time === "TBD" ? "12:00" : normalized.event_time,
    );

    // Construct common payload
    const eventPayload: any = {
      title: normalized.title,
      description: normalized.description || "",
      category: normalized.category || "COMMUNITY",
      event_type: "anchor",
      event_date: normalizedDate.timestamp,
      event_time: normalized.event_time || "TBD",
      status: "published",
      source_id: sourceId,
      content_hash: contentHash,
      event_fingerprint: fingerprint,
      updated_at: new Date().toISOString(),
      image_url: normalized.image_url,
      venue_name: normalized.venue_name || "",
      source_url: normalized.detail_url || raw.detailUrl || sourceUrl, // FIX: Mapped to source_url
      tags: normalized.tags || [],
    };

    // Calculate quality score
    const finalQualityScore = calculateQualityScore({
      ...eventPayload,
      location: eventPayload.location || "POINT(0 0)",
      event_date: normalizedDate.timestamp,
    });

    // 9. Description Scrubbing (Data Hygiene)
    const SCRUB_PATTERNS = [
      "Controleer ticketprijs bij evenement",
      "Geen omschrijving beschikbaar",
      "no description available",
    ];
    if (
      eventPayload.description &&
      SCRUB_PATTERNS.some((p) => eventPayload.description.includes(p))
    ) {
      console.log(`[${row.id}] Scrubbing placeholder description`);
      eventPayload.description = null;
    }

    // Handle Location (PostGIS)
    const geo = (normalized as any)._geo;
    if (geo) {
      eventPayload.location = `POINT(${geo.lng} ${geo.lat})`;
    } else {
      // Validation for frontend usage:
      // Attempt to re-geocode if we have a venue name but no coordinates
      if (eventPayload.venue_name && !existing) {
        const { geocodeLocation } = await import("../_shared/enrichment.ts");
        try {
          const newGeo = await geocodeLocation(eventPayload.venue_name);
          if (newGeo) {
            eventPayload.location = `POINT(${newGeo.lng} ${newGeo.lat})`;
          } else {
            eventPayload.location = "POINT(0 0)";
          }
        } catch {
          eventPayload.location = "POINT(0 0)";
        }
      } else if (!existing) {
        eventPayload.location = "POINT(0 0)";
      }
    }

    // Embedding (non-blocking - quality over speed, allow up to 60s)
    try {
      const textToEmbed = eventToText(normalized);
      const embedRes = await generateEmbedding(aiApiKey, textToEmbed, fetch);
      if (embedRes) {
        eventPayload.embedding = embedRes.embedding;
        eventPayload.embedding_generated_at = new Date().toISOString();
        eventPayload.embedding_model = "text-embedding-3-small";
      }
    } catch (embedError) {
      // Non-blocking: Event will be created without embedding, can be generated async later
      console.warn(
        `[${row.id}] Embedding generation failed (non-blocking):`,
        embedError,
      );
    }

    if (existing) {
      // MERGE LOGIC
      // 1. Description: Prefer existing if existing source is "Venue" (we need to know tier, simple heuristic: longer description wins?)
      // Let's say we prefer the NEW description if it's significantly longer, otherwise keep existing.
      // OR: just append/overwrite based on simple rule.
      // Plan says: "Keep description from Venue (better quality) but add ticket link from Facebook".
      // Implementation: We don't know source tiers here easily without DB lookup on source.
      // Simple merge:
      if (
        !existing.description ||
        (normalized.description &&
          normalized.description.length > existing.description.length)
      ) {
        eventPayload.description = normalized.description;
      }

      if (normalized.image_url) eventPayload.image_url = normalized.image_url;
      if (normalized.venue_name)
        eventPayload.venue_name = normalized.venue_name;

      // Persona Tags - currently storing in separate table or array?
      // Plan says "Add persona_tags column to events".
      if (normalized.persona_tags)
        eventPayload.persona_tags = normalized.persona_tags;

      // Perform Update
      const { error: updateError } = await supabase
        .from("events")
        .update({
          ...eventPayload,
          quality_score: eventPayload.quality_score,
          last_healed_at: healingAttempted
            ? new Date().toISOString()
            : existing.last_healed_at,
        })
        .eq("id", existing.id);

      if (updateError) throw new Error(`Merge failed: ${updateError.message}`);
      console.log(`[${row.id}] Merged into existing event ${existing.id}`);
    } else {
      // INSERT NEW
      eventPayload.description = normalized.description || "";
      eventPayload.venue_name = normalized.venue_name || "";
      eventPayload.image_url = normalized.image_url;
      if (normalized.persona_tags)
        eventPayload.persona_tags = normalized.persona_tags;

      const { error: insertError } = await supabase.from("events").insert({
        ...eventPayload,
        quality_score: eventPayload.quality_score,
        last_healed_at: healingAttempted ? new Date().toISOString() : null,
      });
      if (insertError) {
        // Handle race condition where it was created in between
        if (insertError.code === "23505") {
          console.log(
            `[${row.id}] Duplicate detected during insert (race condition), marking done.`,
          );
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

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processor: Picked up ${rows.length} rows`);

    // 2. Process Batch
    const results = await Promise.allSettled(
      rows.map((row) => processRow(supabase, row, openaiApiKey)),
    );

    // 3. Stats
    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success,
    ).length;
    const failCount = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success),
    ).length;

    // 4. Chain Trigger if batch was full (to drain queue)
    if (rows.length === BATCH_SIZE) {
      // Fire and forget next batch
      fetch(`${supabaseUrl}/functions/v1/process-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      }).catch((e) => console.error("Chain trigger failed", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: rows.length,
        succeeded: successCount,
        failed: failCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("Processor Critical Failure:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

if (import.meta.main) {
  serve(handler);
} else {
  console.log("Process Worker imported as module");
}
