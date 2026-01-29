/**
 * SG Quality Dashboard - Daily per-source stats
 *
 * Returns daily metrics: success rate, avg description length, geocode hit rate.
 * Optional filters: days (default 14), city, source_id, refresh.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DashboardRequest {
  days?: number;
  city?: string;
  source_id?: string;
  refresh?: boolean;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing environment variables" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: DashboardRequest = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  const url = new URL(req.url);
  const daysParam = Number(url.searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0
    ? Math.min(daysParam, 90)
    : Math.min(body.days ?? 14, 90);

  const city = url.searchParams.get("city") ?? body.city;
  const sourceId = url.searchParams.get("source_id") ?? body.source_id;
  const refresh = url.searchParams.get("refresh") === "true" || body.refresh === true;

  try {
    if (refresh) {
      await supabase.rpc("refresh_sg_source_daily_stats");
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    const startIso = startDate.toISOString().slice(0, 10);

    let query = supabase
      .from("sg_source_daily_stats")
      .select("day, source_id, source_name, city, total_attempts, indexed_count, failed_count, success_rate, avg_description_length, geocode_hit_rate")
      .gte("day", startIso)
      .order("day", { ascending: false })
      .order("success_rate", { ascending: false });

    if (city) {
      query = query.eq("city", city);
    }

    if (sourceId) {
      query = query.eq("source_id", sourceId);
    }

    const { data, error } = await query;
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        days,
        count: data?.length ?? 0,
        data: data ?? [],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
