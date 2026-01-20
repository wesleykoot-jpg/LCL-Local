import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";
import { sha256Hex } from "../_shared/scraperUtils.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const handler = async (req: Request): Promise<Response> => {
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
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        
        // 1. Delta Detection: Hash the raw HTML
        const currentHash = await sha256Hex(html);
        
        if (lastHash === currentHash) {
          console.log(`Source ${sourceId}: HTML unchanged (Delta Skip)`);
          
          // Increment savings counter via RPC (if exists) or just update last_scraped_at
          await supabase.from("scraper_sources").update({ 
            last_scraped_at: new Date().toISOString() 
          }).eq("id", sourceId);
          
          results.push({ sourceId, status: "skipped_unchanged" });
          continue;
        }

        // 2. Upsert into staging table for processing
        const { error: insErr } = await supabase.from("raw_event_staging").upsert({
          source_url: url,
          raw_html: html,
          source_id: sourceId,
          status: "pending" as any,
          parsing_method: null // Reset for new processing
        }, { onConflict: "source_url" });

        if (insErr) {
          console.warn(`Staging insert error for ${url}:`, insErr);
          results.push({ sourceId, status: "error", error: insErr.message });
        } else {
          // Update last_payload_hash on the source
          await supabase.from("scraper_sources").update({ 
            last_payload_hash: currentHash,
            last_scraped_at: new Date().toISOString()
          }).eq("id", sourceId);
          
          results.push({ sourceId, status: "staged" });
        }
      } catch (e) {
        console.warn(`Failed to fetch ${url}:`, e);
        results.push({ sourceId, status: "fetch_error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ message: "Fetcher run complete", results }), { status: 200 });
  } catch (err) {
    console.error("Fetcher error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
