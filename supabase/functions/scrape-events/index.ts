// scrape-events/index.ts
// Simplified fetcher: fetch raw HTML for each enabled source and stage it.

import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseServiceRoleKey } from "../_shared/env.ts";

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export const handler = async (req: Request): Promise<Response> => {
  try {
    // Fetch enabled sources
    const { data: sources, error: srcErr } = await supabase
      .from("scraper_sources")
      .select("id, url")
      .eq("enabled", true);
    if (srcErr) throw srcErr;
    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ message: "No enabled sources" }), { status: 200 });
    }

    // Process each source
    for (const src of sources) {
      const url = src.url as string;
      const sourceId = src.id as string;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const html = await resp.text();
        
        // Upsert into staging table
        const { error: insErr } = await supabase.from("raw_event_staging").upsert({
          source_url: url,
          raw_html: html,
          source_id: sourceId,
          status: "pending" as any,
        }, { onConflict: "source_url" });
        if (insErr) console.warn(`Staging insert error for ${url}:`, insErr);
      } catch (e) {
        console.warn(`Failed to fetch ${url}:`, e);
      }
    }
    return new Response(JSON.stringify({ message: "Fetched and staged sources" }), { status: 200 });
  } catch (err) {
    console.error("Fetcher error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};
