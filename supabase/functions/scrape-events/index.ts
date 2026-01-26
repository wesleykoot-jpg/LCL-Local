import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/scraperUtils.ts";
import {
  resolveStrategy,
  createFetcherForSource,
} from "../_shared/strategies.ts";
import { withAuth } from "../_shared/auth.ts";
import { withRateLimiting } from "../_shared/serverRateLimiting.ts";
import { withAuth } from "../_shared/auth.ts";
import { withRateLimiting } from "../_shared/serverRateLimiting.ts";

export const handler = withRateLimiting(withAuth(async (req: Request): Promise<Response> => {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  // Parse payload (handle both cron GET and manual POST)
  let payload: { sourceId?: string; url?: string; depth?: number } = {};
  if (req.method === "POST") {
    try {
      payload = await req.json();
    } catch {
      // ignore empty body
    }
  }

  const { sourceId: targetSourceId, url: overrideUrl, depth = 0 } = payload;
  const MAX_DEPTH = 3; // Limit recursion depth for safety

  try {
    if (!targetSourceId) {
      return new Response(
        JSON.stringify({ error: "sourceId is required in single-source mode" }),
        {
          status: 400,
        },
      );
    }

    // Single source mode
    const { data: src, error } = await supabase
      .from("scraper_sources")
      .select("id, url, last_payload_hash")
      .eq("id", targetSourceId)
      .single();

    if (error || !src)
      throw new Error(`Source ${targetSourceId} not found or inactive`);

    const results = [];
    const sourceId = src.id as string;
    // Use override URL if provided (for pagination), otherwise source config URL
    const currentUrl =
      targetSourceId && overrideUrl ? overrideUrl : (src.url as string);
    const lastHash = src.last_payload_hash as string | null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s

      // 1. Fetching
      const fetcher = createFetcherForSource(src as any);
      const { html, statusCode } = await fetcher.fetchPage(currentUrl);

      if (statusCode >= 400) throw new Error(`HTTP ${statusCode}`);

      // 2. Delta Detection (Only apply on depth 0 to avoid false positives on subpages)
      // Or apply per-URL if we tracked subpage hashes? For now, only check delta on main URL.
      const currentHash = await sha256Hex(html);
      if (depth === 0 && lastHash === currentHash && !overrideUrl) {
        console.log(`Source ${sourceId}: Listing HTML unchanged (Delta Skip)`);
        await supabase
          .from("scraper_sources")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", sourceId);
        return new Response(
          JSON.stringify({
            message: "Skipped unchanged",
            results: [{ sourceId, status: "skipped_unchanged" }],
          }),
          { status: 200 },
        );
      }

      // 3. Parse & Discover
      console.log(
        `Source ${sourceId} (d${depth}): Discovering cards from ${currentUrl}...`,
      );
      const { data: sourceFull } = await supabase
        .from("scraper_sources")
        .select("*")
        .eq("id", sourceId)
        .single();
      const strategy = resolveStrategy(
        sourceFull?.config?.strategy,
        sourceFull as any,
      );

      // DESTUCTURE RESULT (this supports the new interface)
      const { events: cards, nextPageUrl } = await strategy.parseListing(
        html,
        currentUrl,
      );

      console.log(
        `Source ${sourceId} (d${depth}): Found ${cards.length} cards. NextPage: ${nextPageUrl || "None"}`,
      );

      let stagedCount = 0;
      let errorCount = 0;

      // 4. Stage Cards
      for (const card of cards) {
        const cardUrl =
          card.detailUrl ||
          `${currentUrl}#card-${await sha256Hex(card.title + card.date)}`;
        const { error: insErr } = await supabase
          .from("raw_event_staging")
          .upsert(
            {
              source_url: cardUrl,
              raw_html: card.rawHtml || JSON.stringify(card),
              source_id: sourceId,
              status: "pending" as any,
              parsing_method: card.parsingMethod || null,
            },
            { onConflict: "source_url" },
          );

        if (insErr) {
          console.warn(`Staging error for card ${card.title}:`, insErr);
          errorCount++;
        } else {
          stagedCount++;
        }
      }

      // 5. Update Source State (Only update main hash if depth 0)
      if (depth === 0 && !overrideUrl) {
        await supabase
          .from("scraper_sources")
          .update({
            last_payload_hash: currentHash,
            last_scraped_at: new Date().toISOString(),
          })
          .eq("id", sourceId);
      }

      // 6. Pagination Recursion
      if (nextPageUrl && depth < MAX_DEPTH) {
        console.log(`[Pagination] Recursing to depth ${depth + 1}...`);
        // Invoke self asynchronously (fire and forget-ish, but better to await if we want serial)
        // But we don't want to block this function too long.
        // Using fetch to trigger separate execution context.
        await fetch(`${supabaseUrl}/functions/v1/scrape-events`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceId: sourceId,
            url: nextPageUrl,
            depth: depth + 1,
          }),
        }).catch((err) => console.error("Pagination recursion failed:", err));
      }

      results.push({
        sourceId,
        status: "completed",
        found: cards.length,
        staged: stagedCount,
        errors: errorCount,
        nextPage: !!nextPageUrl,
      });
    } catch (e: any) {
      const isTimeout = e.name === "AbortError";
      console.warn(`Failed to fetch ${currentUrl}:`, e.message);
      results.push({
        sourceId,
        status: isTimeout ? "timeout" : "fetch_error",
        error: String(e),
      });
    }

    return new Response(
      JSON.stringify({ message: "Fetcher run complete", results }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Fetcher error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }
}, {
  allowedKeyTypes: ['service', 'worker'], // Only service and worker keys can trigger fetcher
}), 'scrape-events'); // Apply rate limiting with default config for fetcher
