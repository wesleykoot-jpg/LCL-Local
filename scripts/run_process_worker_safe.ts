import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  parseDetailedEventWithAI,
  generateEmbedding,
} from "../supabase/functions/_shared/aiParsing.ts";
import {
  createContentHash,
  createEventFingerprint,
  normalizeEventDateForStorage,
  cheapNormalizeEvent,
  eventToText,
} from "../supabase/functions/_shared/scraperUtils.ts";
import {
  geocodeLocation,
  optimizeImage,
} from "../supabase/functions/_shared/enrichment.ts";
import {
  mapToCategoryKey,
  extractTags,
  isProbableEvent,
} from "../supabase/functions/_shared/categorizer.ts";
import {
  extractJsonLdEvents,
  isJsonLdComplete,
  jsonLdToNormalized,
} from "../supabase/functions/_shared/jsonLdParser.ts";
import { runExtractionWaterfall } from "../supabase/functions/_shared/dataExtractors.ts";

// Helper to load .env manually
try {
  const text = await Deno.readTextFile(".env"); // Run from root
  for (const line of text.split("\n")) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.slice(1, -1);
      Deno.env.set(match[1], value);
    }
  }
} catch (e) {
  console.log("⚠️ .env load failed or not found");
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase Keys");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BATCH_SIZE = 20;

// -------- LOGIC ADAPTED --------

async function claimPendingRows() {
  const { data, error } = await supabase.rpc("claim_staging_rows", {
    p_batch_size: BATCH_SIZE,
  });
  if (error) {
    console.error("Claim error:", error);
    return [];
  }
  return data || [];
}

async function processRow(row: any) {
  console.log(`Processing row ${row.id}...`);

  try {
    let raw = row.raw_payload;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = { rawHtml: raw };
      }
    } else if (row.raw_html) {
      raw = { rawHtml: row.raw_html };
    }

    // GET SOURCE PREFERENCE
    const { data: source } = await supabase
      .from("scraper_sources")
      .select("preferred_method")
      .eq("id", row.source_id)
      .single();

    // WATERFALL EXTRACTION
    console.log(`  🌊 Running Waterfall...`);
    const waterfallResult = await runExtractionWaterfall(raw.rawHtml, {
      baseUrl: row.source_url || row.url,
      sourceName: "LocalRunner",
      preferredMethod: (source?.preferred_method as any) || "auto",
      feedDiscovery: false,
      fetcher: {
        fetch: async (url: string) => {
          console.log(`[Waterfall] Fetching ${url}`);
          const res = await fetch(url);
          return { html: await res.text(), status: res.status };
        },
      },
    });

    console.log(
      `  🌊 Winner: ${waterfallResult.winningStrategy} | Events: ${waterfallResult.totalEvents}`,
    );

    if (waterfallResult.events.length === 0) {
      if (OPENAI_API_KEY) {
        // Fallback to AI if waterfall failed completely
        console.log("  🤖 Waterfall failed. Trying AI Fallback...");
        try {
          const aiRes = await parseDetailedEventWithAI(
            OPENAI_API_KEY,
            raw,
            row.detail_html,
            fetch,
            { targetYear: 2026, language: "nl" },
          );
          if (aiRes) {
            const normalized = { ...aiRes, title: aiRes.title || raw.title };
            // Cast to any to satisfy TS for now
            waterfallResult.events.push({
              title: normalized.title,
              date: normalized.event_date,
              location: normalized.venue_name,
              description: normalized.description,
              detailUrl: normalized.detail_url,
              imageUrl: normalized.image_url,
              rawHtml: "",
              parsingMethod: "ai_fallback",
            } as any);
          }
        } catch (e) {
          console.error("  ❌ AI Failed as well");
        }
      }

      if (waterfallResult.events.length === 0) {
        console.warn("  ⚠️ No events found. Marking failed.");
        await supabase
          .from("raw_event_staging")
          .update({ status: "failed", error_message: "No events extracted" })
          .eq("id", row.id);
        return;
      }
    }

    // Process found events
    for (const evt of waterfallResult.events) {
      let finalDescription = evt.description;
      let finalImageUrl = evt.imageUrl;
      let finalVenue = evt.location;

      // DETAIL-FIRST ENRICHMENT: Proactively fetch detail page if possible
      const shouldFetchDetail =
        evt.detailUrl &&
        (!finalDescription || finalDescription.length < 500 || !finalImageUrl);

      if (shouldFetchDetail && evt.detailUrl) {
        console.log(`  🔍 Proactive Enrichment: ${evt.detailUrl}`);
        try {
          const res = await fetch(evt.detailUrl);
          if (res.ok) {
            const detailHtml = await res.text();
            const deepResult = await runExtractionWaterfall(detailHtml, {
              baseUrl: evt.detailUrl,
              sourceName: "ProactiveEnricher",
              preferredMethod: "auto",
              feedDiscovery: false,
            });

            if (deepResult.totalEvents > 0) {
              // Look for best match (by title similarity)
              const bestMatch =
                deepResult.events.find(
                  (e) =>
                    e.title.toLowerCase().includes(evt.title.toLowerCase()) ||
                    evt.title.toLowerCase().includes(e.title.toLowerCase()),
                ) || deepResult.events[0];

              // Priority 1: Description (Detail always wins if non-empty)
              if (
                bestMatch.description &&
                bestMatch.description.length > (finalDescription?.length || 0)
              ) {
                console.log(
                  `  ✨ Enhanced Description: ${bestMatch.description.length} chars.`,
                );
                finalDescription = bestMatch.description;
              }

              // Priority 2: High-res Images
              if (bestMatch.imageUrl && !finalImageUrl) {
                finalImageUrl = bestMatch.imageUrl;
              }

              // Priority 3: Specific Venue
              if (
                bestMatch.location &&
                (!finalVenue || finalVenue === "Onbekend" || finalVenue === "")
              ) {
                finalVenue = bestMatch.location;
              }
            }
          }
        } catch (e) {
          console.error(`  ❌ Detail fetch failed: ${evt.detailUrl}`);
        }
      }

      // Validate Date
      let storageDate;
      try {
        const cleanDate = (evt.date || "").trim();
        storageDate = normalizeEventDateForStorage(cleanDate, "TBD");
      } catch (e) {
        console.warn(`  ⚠️ Skipping invalid date: "${evt.date}"`);
        continue;
      }

      // Map to normalized structure
      const normalized = {
        title: evt.title,
        event_date: storageDate.dateOnly || evt.date,
        description: stripHtml(finalDescription),
        image_url: finalImageUrl,
        venue_name: finalVenue || "TBD",
        detail_url: evt.detailUrl,
        event_time: "TBD",
      };

      // Categorize
      const category = mapToCategoryKey(
        `${normalized.title} ${normalized.description}`,
        null,
        evt.detailUrl || row.url,
      );

      // Final Save
      const hash = await createContentHash(
        normalized.title,
        normalized.event_date,
      );
      const fp = await createEventFingerprint(
        normalized.title,
        normalized.event_date,
        row.source_id,
      );

      const payload: any = {
        title: normalized.title,
        description: normalized.description,
        category: category,
        event_type: "anchor",
        event_date: storageDate.timestamp,
        event_time: normalized.event_time || "TBD",
        status: "published",
        source_id: row.source_id,
        content_hash: hash,
        event_fingerprint: fp,
        image_url: normalized.image_url,
        venue_name: normalized.venue_name,
        source_url: normalized.detail_url || row.source_url,
        location: "POINT(0 0)",
      };

      // Geocode
      try {
        if (payload.venue_name) {
          const geo = await geocodeLocation(supabase, payload.venue_name);
          if (geo) payload.location = `POINT(${geo.lng} ${geo.lat})`;
        }
      } catch {}

      // SMART DEDUPLICATION & PROMOTION
      const { data: existingEvent } = await supabase
        .from("events")
        .select("*")
        .eq("title", normalized.title)
        .eq("event_date", storageDate.timestamp)
        .eq("venue_name", normalized.venue_name)
        .maybeSingle();

      if (existingEvent) {
        console.log(`  🔄 Existing event found. Comparing for promotion...`);
        const existingDescLen = (existingEvent.description || "").length;
        const newDescLen = (normalized.description || "").length;

        // Merge source URLs
        const existingUrls = existingEvent.all_source_urls || [];
        const newUrl = normalized.detail_url || row.source_url;
        const mergedUrls = Array.from(
          new Set([...existingUrls, newUrl]),
        ).filter(Boolean);
        payload.all_source_urls = mergedUrls;

        // PROMOTION LOGIC: Only overwrite if the new data is significantly better
        const isBetterDesc = newDescLen > existingDescLen + 50; // Threshold to prevent tiny jitter updates
        const isBetterImage = !existingEvent.image_url && payload.image_url;

        if (isBetterDesc || isBetterImage) {
          if (isBetterDesc)
            console.log(
              `  ✨ Promoting superior description (+${newDescLen - existingDescLen} chars)`,
            );
          if (isBetterImage)
            console.log(`  🖼️ Adding missing image from new source`);

          const { error: updErr } = await supabase
            .from("events")
            .update(payload)
            .eq("id", existingEvent.id);

          if (updErr) console.error("  ❌ Promotion Error:", updErr.message);
        } else {
          // Just update URLs if no promotion happened
          await supabase
            .from("events")
            .update({ all_source_urls: mergedUrls })
            .eq("id", existingEvent.id);
          console.log("  🤝 Event exists. Metadata preserved, URLs merged.");
        }
      } else {
        // Insert new record
        payload.all_source_urls = [normalized.detail_url || row.source_url];
        const { error: insErr } = await supabase.from("events").insert(payload);

        if (insErr) {
          console.error("  ❌ DB Insert Error:", insErr.message);
        } else {
          console.log("  ✅ Event Created!");
        }
      }

      // STRATEGY PERSISTENCE: Record the winning method for the source
      if (waterfallResult.winningStrategy) {
        await supabase
          .from("scraper_sources")
          .update({ preferred_method: waterfallResult.winningStrategy })
          .eq("id", row.source_id);
      }
    }

    // Success
    await supabase
      .from("raw_event_staging")
      .update({
        status: "completed",
        parsing_method: waterfallResult.winningStrategy,
      })
      .eq("id", row.id);
  } catch (e) {
    console.error("  ❌ Process Error:", e);
    await supabase
      .from("raw_event_staging")
      .update({ status: "failed", error_message: String(e) })
      .eq("id", row.id);
  }
}

/**
 * Simple HTML stripping utility
 */
function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>?/gm, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Global fingerprint for cross-source deduplication
 */
async function createGlobalFingerprint(
  title: string,
  date: string,
  venue: string,
): Promise<string> {
  const clean = `${title}-${date}-${venue}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function main() {
  console.log("🚀 Starting Local Processor...");

  while (true) {
    const rows = await claimPendingRows();
    if (!rows || rows.length === 0) {
      console.log("No more rows to process.");
      break;
    }

    console.log(`Picked up ${rows.length} rows`);
    await Promise.all(rows.map(processRow));
    console.log("Batch complete. Checking for more...");
  }
}

main();
