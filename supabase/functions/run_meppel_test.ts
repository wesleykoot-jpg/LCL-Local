/**
 * Auto-select 3 Meppel sources, scrape event links, stage rows, queue AI enrichment.
 * Usage:
 *   deno run --allow-net --allow-env supabase/functions/run_meppel_test.ts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { queueEnrichmentJob } from "./_shared/social-five-enrichment.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMeppelSources(limit = 3) {
  const { data, error } = await supabase
    .from('scraper_sources')
    .select('id, url, name')
    .or('url.ilike.%meppel%,name.ilike.%meppel%')
    .limit(limit);

  if (error) throw error;
  return data || [];
}

function extractLinks(html: string, base: string) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    if (!doc) return [];
    const anchors = Array.from(doc.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const urls = anchors.map(a => {
      try { return new URL(a.getAttribute('href') || '', base).toString(); } catch { return null; }
    }).filter(Boolean) as string[];
    // Deduplicate
    return Array.from(new Set(urls));
  } catch (e) {
    return [];
  }
}

async function stageDetail(supabaseAny: any, sourceId: string, listingUrl: string, detailUrl: string, detailHtml: string) {
  const { data, error } = await supabaseAny
    .from('raw_event_staging')
    .insert([{
      source_id: sourceId,
      status: 'awaiting_enrichment',
      source_url: listingUrl,
      detail_url: detailUrl,
      raw_html: null,
      detail_html: detailHtml,
      parsing_method: 'link-scrape',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function run() {
  const sources = await findMeppelSources(3);
  if (!sources || sources.length === 0) {
    console.error('No Meppel sources found in scraper_sources');
    Deno.exit(1);
  }

  console.log(`Selected ${sources.length} Meppel sources`);

  let totalStaged = 0;

  for (const src of sources) {
    if (totalStaged >= 30) break;
    console.log(`Processing source: ${src.url}`);

    let listingHtml = '';
    try {
      const resp = await fetch(src.url, { redirect: 'follow' });
      listingHtml = await resp.text();
    } catch (err) {
      console.error(`Failed to fetch ${src.url}: ${err}`);
      continue;
    }

    const links = extractLinks(listingHtml, src.url).filter(u => u.startsWith(new URL(src.url).origin));
    console.log(`Found ${links.length} candidate links on ${src.url}`);

    // Try links until we stage enough events
    for (const link of links) {
      if (totalStaged >= 30) break;
      try {
        const resp = await fetch(link, { redirect: 'follow' });
        if (!resp.ok) continue;
        const detailHtml = await resp.text();

        const stagingId = await stageDetail(supabase, src.id, src.url, link, detailHtml);

        // Queue enrichment job for the staging row
        await queueEnrichmentJob(supabase, stagingId, detailHtml, link, 100);

        totalStaged++;
        console.log(`Staged and queued enrichment for ${link} (staging ${stagingId}) — total ${totalStaged}`);
      } catch (err) {
        console.warn(`Skipping ${link}: ${err}`);
      }
    }
  }

  console.log(`Done. Total staged: ${totalStaged}. Enrichment jobs queued.`);
}

run().catch(err => { console.error(err); Deno.exit(1); });
