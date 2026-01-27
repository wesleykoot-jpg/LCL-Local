import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import * as cheerio from "npm:cheerio@1.0.0-rc.12";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/scraperUtils.ts";
import { createFetcherForSource } from "../_shared/strategies.ts";
import { withAuth } from "../_shared/auth.ts";
import { withRateLimiting } from "../_shared/serverRateLimiting.ts";
import { logError, logInfo } from "../_shared/errorLogging.ts";
import type { ExtractionRecipe } from "../_shared/aiParsing.ts";
import type { RawEventCard } from "../_shared/types.ts";

/**
 * Extracts events using a deterministic recipe (Cheerio + CSS selectors).
 * This is the "Executor" tier - cheap, fast, no AI tokens required.
 */
function extractWithRecipe(
  html: string,
  recipe: ExtractionRecipe,
  baseUrl: string,
): { events: RawEventCard[]; success: boolean; error?: string } {
  try {
    const $ = cheerio.load(html);
    const events: RawEventCard[] = [];

    // Handle JSON-LD mode
    if (recipe.mode === "JSON_LD") {
      const jsonLdScripts = $('script[type="application/ld+json"]');
      jsonLdScripts.each((_, el) => {
        try {
          const content = $(el).html();
          if (!content) return;

          const data = JSON.parse(content);
          const items = Array.isArray(data) ? data : data["@graph"] || [data];

          for (const item of items) {
            if (item["@type"] === "Event" || item["@type"]?.includes("Event")) {
              events.push({
                title: item.name || "",
                date: item.startDate || "",
                location:
                  item.location?.name ||
                  item.location?.address?.streetAddress ||
                  "",
                description: item.description || "",
                detailUrl: item.url || "",
                imageUrl: item.image?.url || item.image || null,
                rawHtml: JSON.stringify(item),
                parsingMethod: "json_ld",
              });
            }
          }
        } catch {
          // Ignore parsing errors for individual scripts
        }
      });

      return { events, success: events.length > 0 };
    }

    // Handle CSS_SELECTOR mode
    const { container, item, mapping } = recipe.config;

    // Find event items
    const containerEl = container ? $(container) : $("body");
    const items = containerEl.find(item);

    if (items.length === 0) {
      return {
        events: [],
        success: false,
        error: `No items found with selector: ${container} ${item}`,
      };
    }

    items.each((_, el) => {
      const $item = $(el);

      // Extract fields using mapping - cache selectors for efficiency
      const $titleEl = $item.find(mapping.title).first();
      const title = $titleEl.text().trim() || $titleEl.attr("title") || "";

      const $dateEl = $item.find(mapping.date).first();
      const date =
        $dateEl.text().trim() ||
        $dateEl.attr("datetime") ||
        $dateEl.attr("content") ||
        "";

      // Get link - try href attribute
      const $linkEl = $item.find(mapping.link).first();
      let link = $linkEl.attr("href") || "";
      if (link && !link.startsWith("http")) {
        try {
          link = new URL(link, baseUrl).href;
        } catch {
          // Keep relative URL if can't resolve
        }
      }

      // Get image - try multiple attributes
      const $imageEl = $item.find(mapping.image).first();
      let image =
        $imageEl.attr("src") ||
        $imageEl.attr("data-src") ||
        $imageEl.attr("data-lazy-src") ||
        null;
      if (image && !image.startsWith("http")) {
        try {
          image = new URL(image, baseUrl).href;
        } catch {
          // Keep relative URL if can't resolve
        }
      }

      // Optional fields
      const description = mapping.description
        ? $item.find(mapping.description).first().text().trim()
        : "";

      const location = mapping.location
        ? $item.find(mapping.location).first().text().trim()
        : "";

      const time = mapping.time
        ? $item.find(mapping.time).first().text().trim()
        : "";

      // Only add if we have at least title and date
      if (title && (date || link)) {
        events.push({
          title,
          date: date || "",
          location,
          description,
          detailUrl: link,
          imageUrl: image,
          rawHtml: $item.html() || "",
          detailPageTime: time || undefined,
          parsingMethod: "recipe",
        });
      }
    });

    return { events, success: true };
  } catch (error) {
    return {
      events: [],
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const handler = withRateLimiting(
  withAuth(
    async (req: Request): Promise<Response> => {
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
      const MAX_PAGINATION_DEPTH = 5; // Maximum pagination depth per source to prevent excessive processing
      const startTime = Date.now(); // Track execution time for insights

      try {
        if (!targetSourceId) {
          return new Response(
            JSON.stringify({
              error: "sourceId is required in single-source mode",
            }),
            {
              status: 400,
            },
          );
        }

        // Single source mode - fetch recipe and status for smart extraction
        const { data: src, error } = await supabase
          .from("scraper_sources")
          .select(
            "id, url, last_payload_hash, extraction_recipe, scout_status, config, fetcher_type",
          )
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

        // Removed legacy circuit breaker check

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s

          // 1. Fetching
          const fetcher = createFetcherForSource(src as any);
          const { html, statusCode } = await fetcher.fetchPage(currentUrl);

          if (statusCode >= 400) throw new Error(`HTTP ${statusCode}`);

          // Calculate hash for delta detection and state updates
          const currentHash = await sha256Hex(html);

          // 3. Parse & Discover - Use Recipe-based extraction if available
          console.log(
            `Source ${sourceId} (d${depth}): Discovering cards from ${currentUrl}...`,
          );

          // Get full source config for strategy resolution
          const { data: sourceFull } = await supabase
            .from("scraper_sources")
            .select("*")
            .eq("id", sourceId)
            .single();

          const extractionRecipe =
            sourceFull?.extraction_recipe as ExtractionRecipe | null;
          const scoutStatus = sourceFull?.scout_status as string | null;

          let cards: RawEventCard[] = [];
          let nextPageUrl: string | undefined;
          let extractionMethod = "legacy";

          // === RECIPE-BASED EXTRACTION (V2 - Executor Tier) ===
          if (extractionRecipe && scoutStatus === "active") {
            console.log(
              `Source ${sourceId}: Using recipe-based extraction (mode: ${extractionRecipe.mode})`,
            );

            const { events, success, error } = extractWithRecipe(
              html,
              extractionRecipe,
              currentUrl,
            );

            if (success && events.length > 0) {
              cards = events;
              extractionMethod = "recipe";
              console.log(
                `Source ${sourceId}: Recipe extraction found ${cards.length} events`,
              );

              // Handle pagination hints from recipe
              if (extractionRecipe.hints?.pagination !== "none") {
                // Try to find next page URL using common patterns
                const $ = cheerio.load(html);
                const nextEl = $(
                  'a[rel="next"], .pagination .next, a:contains("Volgende"), a:contains("Next"), .next-page a',
                ).first();
                const relativeUrl = nextEl.attr("href");
                if (relativeUrl) {
                  try {
                    nextPageUrl = new URL(relativeUrl, currentUrl).href;
                  } catch {
                    // Ignore invalid URLs
                  }
                }
              }
            } else {
              // Recipe identified but no events found or parsing error
              console.warn(
                `Source ${sourceId}: Recipe extraction failed - ${error || "no events found"}`,
              );
              // Trigger re-scout if nothing was found (self-healing)
              await supabase.rpc("check_and_trigger_re_scout", {
                p_source_id: sourceId,
                p_events_found: 0,
                p_http_status: 200,
              });
            }
          } else {
            // No recipe available or scout not yet complete
            console.log(
              `Source ${sourceId}: Awaiting scout (status: ${scoutStatus}), cannot extract yet.`,
            );
            return new Response(
              JSON.stringify({
                message: "Source awaiting scouting",
                status: "pending_scout",
              }),
              { status: 200 },
            );
          }

          console.log(
            `Source ${sourceId} (d${depth}): Found ${cards.length} cards via ${extractionMethod}. NextPage: ${nextPageUrl || "None"}`,
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

          // 6. Pagination Recursion (with depth limit enforcement)
          if (nextPageUrl && depth < MAX_PAGINATION_DEPTH - 1) {
            console.log(
              `[Pagination] Recursing to depth ${depth + 1} (max: ${MAX_PAGINATION_DEPTH})...`,
            );
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
            }).catch((err) =>
              console.error("Pagination recursion failed:", err),
            );
          } else if (nextPageUrl && depth >= MAX_PAGINATION_DEPTH - 1) {
            console.log(
              `[Pagination] Reached page limit (${MAX_PAGINATION_DEPTH}), stopping pagination for source ${sourceId}`,
            );
          }

          // Log scraper insights for monitoring
          const executionTimeMs = Date.now() - startTime;
          await logInfo(
            "scrape-events",
            "handler",
            `Scrape completed for source ${sourceId}`,
            {
              source_id: sourceId,
              depth,
              cards_found: cards.length,
              staged_count: stagedCount,
              error_count: errorCount,
              has_next_page: !!nextPageUrl,
              execution_time_ms: executionTimeMs,
              html_size_bytes: html.length,
              url: currentUrl,
              extraction_method: extractionMethod,
            },
          );

          results.push({
            sourceId,
            status: "completed",
            found: cards.length,
            staged: stagedCount,
            errors: errorCount,
            nextPage: !!nextPageUrl,
            executionTimeMs,
            extractionMethod,
          });
        } catch (e: any) {
          const isTimeout = e.name === "AbortError";
          const errorType = isTimeout ? "timeout" : "fetch_error";
          const executionTimeMs = Date.now() - startTime;

          console.warn(`Failed to fetch ${currentUrl}:`, e.message);

          // Log error with full context for debugging
          await logError({
            level: "error",
            source: "scrape-events",
            function_name: "handler",
            message: `Scrape failed for source ${sourceId}: ${e.message}`,
            error_type: errorType,
            stack_trace: e.stack,
            context: {
              source_id: sourceId,
              url: currentUrl,
              depth,
              execution_time_ms: executionTimeMs,
              stage: "fetch",
            },
          });

          // Removed legacy circuit breaker call to record failure

          results.push({
            sourceId,
            status: errorType,
            error: String(e),
            executionTimeMs,
          });
        }

        return new Response(
          JSON.stringify({ message: "Fetcher run complete", results }),
          { status: 200 },
        );
      } catch (err: any) {
        console.error("Fetcher error:", err);
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
        });
      }
    },
    {
      allowedKeyTypes: ["service", "worker"], // Only service and worker keys can trigger fetcher
    },
  ),
  "scrape-events",
); // Apply rate limiting with default config for fetcher
