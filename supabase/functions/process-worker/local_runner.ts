import { createClient } from "npm:@supabase/supabase-js@2.49.1";
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
import { geocodeLocation, optimizeImage } from "../_shared/enrichment.ts";
import {
  mapToCategoryKey,
  extractTags,
  isProbableEvent,
} from "../_shared/categorizer.ts";
import {
  extractJsonLdEvents,
  isJsonLdComplete,
  jsonLdToNormalized,
} from "../_shared/jsonLdParser.ts";

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
const BATCH_SIZE = 5;

// -------- COPIED PROCESSING LOGIC ADAPTED --------

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
  // Minimal mock of the full logic to ensure it runs
  // In reality we should import the actual processor function but it's not exported nicely or has deps.
  // I copied the imports above, so I can reconstruct the core flow.

  try {
    let raw = row.raw_payload;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = { rawHtml: raw };
      }
    } else if (row.raw_html) {
      // Handle raw_html as text
      raw = { rawHtml: row.raw_html };
    }

    let normalized = null;

    // 1. JSON-LD Fast Path (since I imported it)
    if (raw.rawHtml) {
      const jsonLdEvents = extractJsonLdEvents(raw.rawHtml);
      if (jsonLdEvents && Array.isArray(jsonLdEvents)) {
        const complete = jsonLdEvents.find(isJsonLdComplete);
        if (complete) {
          normalized = jsonLdToNormalized(complete);
          console.log(`  ⚡️ JSON-LD found: ${normalized.title}`);
        }
      }
    }

    // 2. AI Fallback
    if (!normalized && OPENAI_API_KEY) {
      console.log("  🤖 AI Parsing...");
      try {
        const aiRes = await parseDetailedEventWithAI(
          OPENAI_API_KEY,
          raw,
          row.detail_html,
          fetch,
          { targetYear: 2026, language: "nl" },
        );
        if (aiRes) {
          normalized = { ...aiRes, title: aiRes.title || raw.title };
          console.log(`  🤖 AI Success: ${normalized.title}`);
        }
      } catch (e) {
        console.error("  ❌ AI Failed:", e.message);
      }
    }

    if (!normalized && raw.title) {
      normalized = {
        title: raw.title,
        event_date: raw.date || new Date().toISOString(),
        description: raw.description,
        image_url: raw.imageUrl,
        venue_name: raw.location,
      };
    }

    if (!normalized || !normalized.title) {
      console.warn("  ⚠️ Could not normalize event. Marking failed.");
      await supabase
        .from("raw_event_staging")
        .update({ status: "failed", error_message: "No title extracted" })
        .eq("id", row.id);
      return;
    }

    // Categorize
    const category = mapToCategoryKey(
      `${normalized.title} ${normalized.description}`,
      null,
      row.url,
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

    const payload = {
      title: normalized.title,
      description: normalized.description,
      category: category,
      event_type: "anchor",
      event_date: normalizeEventDateForStorage(
        normalized.event_date,
        normalized.event_time,
      ).timestamp,
      event_time: normalized.event_time || "TBD",
      status: "published",
      source_id: row.source_id,
      content_hash: hash,
      event_fingerprint: fp,
      image_url: normalized.image_url,
      venue_name: normalized.venue_name,
      detail_url: normalized.detail_url || row.url,
      location: "POINT(0 0)", // Default if no geo
    };

    // Geocode
    try {
      if (payload.venue_name) {
        const geo = await geocodeLocation(payload.venue_name);
        if (geo) payload.location = `POINT(${geo.lng} ${geo.lat})`;
      }
    } catch {}

    // Insert
    const { error: insErr } = await supabase
      .from("events")
      .upsert(payload, { onConflict: "event_fingerprint" }); // or content_hash
    if (insErr) {
      console.error("  ❌ DB Insert Error:", insErr.message);
      await supabase
        .from("raw_event_staging")
        .update({ status: "failed", error_message: insErr.message })
        .eq("id", row.id);
    } else {
      console.log("  ✅ Event Created!");
      await supabase
        .from("raw_event_staging")
        .update({ status: "completed" })
        .eq("id", row.id);
    }
  } catch (e) {
    console.error("  ❌ Process Error:", e);
    await supabase
      .from("raw_event_staging")
      .update({ status: "failed", error_message: String(e) })
      .eq("id", row.id);
  }
}

async function main() {
  console.log("🚀 Starting Local Processor...");
  let idleCount = 0;

  while (true) {
    const rows = await claimPendingRows();
    if (!rows || rows.length === 0) {
      console.log("Waiting for rows...");
      await new Promise((r) => setTimeout(r, 2000));
      idleCount++;
      if (idleCount > 30) {
        console.log("Idle timeout.");
        break;
      } // stop if nothing for 1 min
      continue;
    }
    idleCount = 0;

    console.log(`Picked up ${rows.length} rows`);
    await Promise.all(rows.map(processRow));
  }
}

main();
