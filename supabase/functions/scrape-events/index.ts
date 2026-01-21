import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/scraperUtils.ts";
import { resolveStrategy } from "../_shared/strategies.ts";

export const handler = async (req: Request): Promise<Response> => {
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  try {
    // Fetch enabled sources with their last payload hash
    const { data: sources, error: srcErr } = await supabase
      .from("scraper_sources")
      .select("id, url, last_payload_hash")
      .eq("enabled", true);
      
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ message: "No enabled sources" }), { status: 200 });
    }

    const results = [];

    // Process each source
    for (const src of sources) {
      const url = src.url as string;
      const sourceId = src.id as string;
      const lastHash = src.last_payload_hash as string | null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s for quality over speed
        
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        
        // 1. Delta Detection: Hash the raw HTML of the listing page
        const currentHash = await sha256Hex(html);
        
        if (lastHash === currentHash) {
          console.log(`Source ${sourceId}: Listing HTML unchanged (Delta Skip)`);
          await supabase.from("scraper_sources").update({ 
            last_scraped_at: new Date().toISOString() 
          }).eq("id", sourceId);
          results.push({ sourceId, status: "skipped_unchanged" });
          continue;
        }

        // 2. Discover individual cards
        console.log(`Source ${sourceId}: Discovering cards...`);
        const { data: sourceFull } = await supabase.from("scraper_sources").select("*").eq("id", sourceId).single();
        const strategy = resolveStrategy(sourceFull?.config?.strategy, sourceFull as any);
        const cards = await strategy.parseListing(html, url);
        console.log(`Source ${sourceId}: Found ${cards.length} cards`);

        let stagedCount = 0;
        let errorCount = 0;

        // 3. Stage each card
        for (const card of cards) {
          const cardUrl = card.detailUrl || `${url}#card-${await sha256Hex(card.title + card.date)}`;
          
          const { error: insErr } = await supabase.from("raw_event_staging").upsert({
            source_url: cardUrl,
            raw_html: card.rawHtml || JSON.stringify(card), // Store card HTML or JSON if HTML missing
            source_id: sourceId,
            status: "pending" as any,
            parsing_method: card.parsingMethod || null
          }, { onConflict: "source_url" });

          if (insErr) {
            console.warn(`Staging error for card ${card.title}:`, insErr);
            errorCount++;
          } else {
            stagedCount++;
          }
        }

        // Update last_payload_hash on the source listing
        await supabase.from("scraper_sources").update({ 
          last_payload_hash: currentHash,
          last_scraped_at: new Date().toISOString()
        }).eq("id", sourceId);
        
        results.push({ sourceId, status: "completed", found: cards.length, staged: stagedCount, errors: errorCount });
      } catch (e: any) {
        const isTimeout = e.name === 'AbortError';
        console.warn(`Failed to fetch ${url} (${isTimeout ? 'TIMEOUT' : e.message})`);
        results.push({ sourceId, status: isTimeout ? "timeout" : "fetch_error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ message: "Fetcher run complete", results }), { status: 200 });
  } catch (err) {
    console.error("Fetcher error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
