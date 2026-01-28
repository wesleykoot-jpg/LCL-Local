import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/scraperUtils.ts";
import {
  resolveStrategy,
  createFetcherForSource,
} from "../_shared/strategies.ts";
import { withAuth } from "../_shared/auth.ts";
import { withRateLimiting } from "../_shared/serverRateLimiting.ts";
import {
  isCircuitClosed,
  recordFailure,
  getCircuitState,
} from "../_shared/circuitBreaker.ts";
import { logError, logInfo } from "../_shared/errorLogging.ts";

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

        // Single source mode
        const { data: src, error } = await supabase
          .from("scraper_sources")
          .select("*")
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

        // Check if circuit breaker allows this source
        const circuitState = await getCircuitState(
          supabaseUrl,
          supabaseServiceRoleKey,
          targetSourceId,
        );
        if (circuitState?.state === "OPEN") {
          console.log(
            `Source ${targetSourceId}: Circuit breaker OPEN, skipping`,
          );
          await supabase
            .from("scraper_sources")
            .update({ last_scraped_at: new Date().toISOString() })
            .eq("id", targetSourceId);

          return new Response(
            JSON.stringify({
              message: "Skipped due to circuit breaker",
              results: [{ sourceId: targetSourceId, status: "circuit_open" }],
            }),
            { status: 200 },
          );
        }

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
            console.log(
              `Source ${sourceId}: Listing HTML unchanged (Delta Skip)`,
            );
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
          const strategy = resolveStrategy(src?.config?.strategy, src as any);

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

          // Record failure for circuit breaker
          await recordFailure(
            supabaseUrl,
            supabaseServiceRoleKey,
            sourceId,
            e.message,
            5, // failureThreshold
          );

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
        // Log top-level errors with context
        await logError({
          level: "fatal",
          source: "scrape-events",
          function_name: "handler",
          message: `Fetcher critical error: ${err.message || String(err)}`,
          error_type: "critical_failure",
          stack_trace: err.stack,
          context: {
            source_id: targetSourceId,
            stage: "initialization",
          },
        });

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
