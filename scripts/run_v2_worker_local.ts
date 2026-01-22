import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import "jsr:@std/dotenv/load";
import {
  resolveStrategy,
  createFetcherForSource,
} from "../supabase/functions/_shared/strategies.ts";
import { sha256Hex } from "../supabase/functions/_shared/scraperUtils.ts";

const supabaseUrl =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function processSource(source: any, depth = 0) {
  console.log(`[${source.name}] Processing level ${depth}...`);
  const url = source.url;

  try {
    const fetcher = createFetcherForSource(source as any);
    const { html, statusCode } = await fetcher.fetchPage(url);
    if (statusCode >= 400) {
      console.warn(`  ❌ ${source.name}: HTTP ${statusCode}`);
      return;
    }

    const strategy = resolveStrategy(source.config?.strategy, source as any);
    const { events: cards, nextPageUrl } = await strategy.parseListing(
      html,
      url,
    );

    console.log(`  ✅ ${source.name}: Found ${cards.length} cards.`);

    for (const card of cards) {
      const cardUrl =
        card.detailUrl ||
        `${url}#card-${await sha256Hex(card.title + card.date)}`;
      await supabase.from("raw_event_staging").upsert(
        {
          source_url: cardUrl,
          raw_html: card.rawHtml || JSON.stringify(card),
          source_id: source.id,
          status: "pending",
          parsing_method: card.parsingMethod || null,
        },
        { onConflict: "source_url" },
      );
    }

    // Pagination recursion (depth 1 only for local bulk test to save time)
    if (nextPageUrl && depth < 1) {
      console.log(`  ➡️ ${source.name}: Following next page: ${nextPageUrl}`);
      await processSource({ ...source, url: nextPageUrl }, depth + 1);
    }
  } catch (err) {
    console.error(`  ❌ ${source.name}: Error`, err.message);
  }
}

async function main() {
  const target = Deno.args[0];

  if (target) {
    // Single mode
    console.log(`Targeting: ${target}`);
    let query = supabase.from("scraper_sources").select("*");
    if (target.includes("-")) {
      // ID likeliness
      query = query.eq("id", target);
    } else {
      query = query.ilike("name", `%${target}%`);
    }
    const { data: source } = await query.limit(1).single();
    if (!source) {
      console.error("Source not found");
      return;
    }
    await processSource(source);
  } else {
    // Bulk mode: Process PENDING jobs from scrape_jobs
    console.log("Bulk mode: Processing PENDING jobs...");
    const { data: jobs } = await supabase
      .from("scrape_jobs")
      .select("*, scraper_sources(*)")
      .eq("status", "pending")
      .limit(20); // Process only 20 at a time locally

    if (!jobs || jobs.length === 0) {
      console.log("No pending jobs found.");
      return;
    }

    console.log(`Processing ${jobs.length} jobs...`);

    for (const job of jobs) {
      const source = job.scraper_sources;
      if (!source) continue;

      // Mark as processing
      await supabase
        .from("scrape_jobs")
        .update({ status: "processing" })
        .eq("id", job.id);

      await processSource(source);

      // Mark as completed
      await supabase
        .from("scrape_jobs")
        .update({ status: "completed" })
        .eq("id", job.id);
    }
  }
}

main();
