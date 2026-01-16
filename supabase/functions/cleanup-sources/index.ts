import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ArchiveResult {
  archived: number;
  disabled: number;
  sources: Array<{ id: string; name: string; reason: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // Default to dry run for safety
    const archiveNeverWorked = body.archive_never_worked !== false;
    const archiveHighFailures = body.archive_high_failures !== false;
    const failureThreshold = body.failure_threshold || 3;

    console.log(`Cleanup sources: dry_run=${dryRun}, archive_never_worked=${archiveNeverWorked}, archive_high_failures=${archiveHighFailures}`);

    const result: ArchiveResult = {
      archived: 0,
      disabled: 0,
      sources: [],
    };

    // Find sources to archive
    let query = supabase
      .from("scraper_sources")
      .select("*")
      .eq("enabled", true);

    const { data: sources, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch sources: ${fetchError.message}`);
    }

    const toArchive: typeof sources = [];

    for (const source of sources || []) {
      let reason = "";

      // Never scraped successfully
      if (archiveNeverWorked && source.total_events_scraped === 0) {
        reason = "never_scraped_successfully";
      }
      // High consecutive failures
      else if (archiveHighFailures && source.consecutive_failures >= failureThreshold) {
        reason = `consecutive_failures_${source.consecutive_failures}`;
      }

      if (reason) {
        toArchive.push({ ...source, archive_reason: reason });
      }
    }

    console.log(`Found ${toArchive.length} sources to archive`);

    if (dryRun) {
      // Just report what would be archived
      return new Response(
        JSON.stringify({
          dry_run: true,
          would_archive: toArchive.length,
          sources: toArchive.map((s) => ({
            id: s.id,
            name: s.name,
            url: s.url,
            reason: s.archive_reason,
            total_events: s.total_events_scraped,
            failures: s.consecutive_failures,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Actually archive sources
    for (const source of toArchive) {
      // Insert into archive
      const { error: archiveError } = await supabase
        .from("scraper_sources_archive")
        .insert({
          original_source_id: source.id,
          name: source.name,
          url: source.url,
          config: source.config,
          country: source.country,
          language: source.language,
          location_name: source.location_name,
          default_coordinates: source.default_coordinates,
          archive_reason: source.archive_reason,
          consecutive_failures: source.consecutive_failures,
          last_error: source.last_error,
          last_scraped_at: source.last_scraped_at,
          last_success: source.last_success,
          total_events_scraped: source.total_events_scraped,
          original_created_at: source.created_at,
        });

      if (archiveError) {
        console.error(`Failed to archive ${source.name}:`, archiveError.message);
        continue;
      }

      // Disable the source
      const { error: disableError } = await supabase
        .from("scraper_sources")
        .update({
          enabled: false,
          disabled_reason: source.archive_reason,
          auto_disabled: true,
        })
        .eq("id", source.id);

      if (disableError) {
        console.error(`Failed to disable ${source.name}:`, disableError.message);
        continue;
      }

      result.archived++;
      result.disabled++;
      result.sources.push({
        id: source.id,
        name: source.name,
        reason: source.archive_reason,
      });
    }

    console.log(`Archived and disabled ${result.archived} sources`);

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: false,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
