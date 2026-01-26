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

async function runScraper(sourceNameOrId: string) {
  console.log(`Searching for source: ${sourceNameOrId}`);

  const { data: source } = await supabase
    .from("scraper_sources")
    .select("*")
    .or(`id.eq.${sourceNameOrId},name.ilike.%${sourceNameOrId}%`)
    .limit(1)
    .single();

  if (!source) {
    console.error("Source not found. Listing top 10 sources:");
    const { data: all } = await supabase
      .from("scraper_sources")
      .select("name, id")
      .limit(10);
    console.log(all);
    return;
  }

  console.log(`Found source: ${source.name} (${source.url})`);
  const url = source.url;

  // 1. Fetching
  const fetcher = createFetcherForSource(source as any);
  console.log("Fetching page...");
  const { html, statusCode } = await fetcher.fetchPage(url);
  console.log(`Fetched status: ${statusCode}`);

  // 2. Strategy
  const strategy = resolveStrategy(source.config?.strategy, source as any);
  console.log("Parsing listing...");
  const { events: cards, nextPageUrl } = await strategy.parseListing(
    html,
    url,
    { enableDebug: true },
  );

  console.log(`Found ${cards.length} cards.`);
  console.log(`Next Page URL: ${nextPageUrl || "None"}`);

  if (cards.length > 0) {
    console.log("First card:", cards[0]);
  }

  // 3. Stage (Dry Run or Real?)
  // Let's stage them to verify DB interaction
  for (const card of cards) {
    const cardUrl =
      card.detailUrl ||
      `${url}#card-${await sha256Hex(card.title + card.date)}`;
    const { error: insErr } = await supabase.from("raw_event_staging").upsert(
      {
        source_url: cardUrl,
        raw_html: card.rawHtml || JSON.stringify(card),
        source_id: source.id,
        status: "pending",
        parsing_method: card.parsingMethod || null,
        debug_info: card.debugInfo || null,
      },
      { onConflict: "source_url" },
    );

    if (insErr) console.error("Upsert error:", insErr);
  }
}

if (import.meta.main) {
  const target = Deno.args[0] || "Zwolle"; // Default to Zwolle
  await runScraper(target);
}
