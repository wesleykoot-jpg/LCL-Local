import { supabase } from "@/integrations/supabase/client";

export interface ScraperSource {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
  last_scraped_at: string | null;
  last_success: boolean | null;
  total_events_scraped: number | null;
  consecutive_failures: number | null;
  last_error: string | null;
  auto_disabled: boolean | null;
}

export interface LogEntry {
  timestamp: string;
  level?: string;
  message?: string;
  function_name?: string;
  [key: string]: unknown;
}

export interface LogsResult {
  success: boolean;
  from?: string;
  to?: string;
  minutes?: number;
  count?: number;
  summary?: {
    total: number;
    fatal: number;
    errors: number;
    warnings: number;
    info: number;
    debug: number;
    by_source: Record<string, number>;
    by_function: Record<string, number>;
  };
  logs?: LogEntry[];
  error?: string;
}

export interface CoordinatorResult {
  success: boolean;
  jobsCreated?: number;
  error?: string;
}

/**
 * Fetch all scraper sources with their stats
 */
export async function getSources(): Promise<ScraperSource[]> {
  const { data, error } = await supabase
    .from("scraper_sources")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as unknown as ScraperSource[];
}

/**
 * Toggle source enabled status
 */
export async function toggleSource(
  id: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("scraper_sources")
    .update({
      enabled,
      // Reset auto_disabled if manually re-enabling
      auto_disabled: enabled ? false : undefined,
      consecutive_failures: enabled ? 0 : undefined,
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Trigger scrape coordinator to queue jobs for enabled sources
 */
export async function triggerCoordinator(): Promise<CoordinatorResult> {
  const { data, error } = await supabase.functions.invoke("scrape-coordinator");

  if (error) {
    return { success: false, error: error.message };
  }

  return (
    (data as CoordinatorResult) ?? { success: false, error: "Unknown error" }
  );
}

/**
 * Fetch recent Supabase logs (errors, jobs, discovery)
 */
export async function fetchLogs(minutes: number = 60): Promise<LogsResult> {
  // Use fetch directly to support query params
  const url = `https://mlpefjsbriqgxcaqxhic.supabase.co/functions/v1/fetch-last-15min-logs?minutes=${minutes}`;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA"}`,
      apikey:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scGVmanNicmlxZ3hjYXF4aGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTMwNjMsImV4cCI6MjA4MzQ4OTA2M30.UxuID8hbNO4ZS9qEOJ95QabLPcZ4V_lMXEvp9EuxYZA",
    },
  });

  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status}` };
  }

  const data = await response.json();
  return {
    success: true,
    from: data?.from,
    to: data?.to,
    minutes: data?.minutes,
    count:
      data?.summary?.total ??
      (Array.isArray(data?.logs) ? data.logs.length : 0),
    summary: data?.summary,
    logs: data?.logs || [],
  };
}
