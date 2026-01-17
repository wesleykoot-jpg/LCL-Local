import { supabase } from '@/integrations/supabase/client';

const SUCCESS_STATUSES = new Set(['success', 'partial', 'registry_match']);

export async function getEnrichmentStats() {
  const { count: needsEnrichment, error: needsError } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .in('time_mode', ['window', 'anytime'])
    .or('contact_phone.is.null,opening_hours.is.null')
    .is('enrichment_attempted_at', null);

  if (needsError) throw needsError;

  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentFailures, error: failuresError } = await supabase
    .from('enrichment_logs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('created_at', last24Hours);

  if (failuresError) throw failuresError;

  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: statusRows, error: statusError } = await supabase
    .from('enrichment_logs')
    .select('status')
    .gte('created_at', last7Days);

  if (statusError) throw statusError;

  const totalLogs = statusRows?.length ?? 0;
  const successLogs = statusRows?.filter((row) => SUCCESS_STATUSES.has(row.status)).length ?? 0;
  const successRate = totalLogs > 0 ? successLogs / totalLogs : 0;

  return {
    needsEnrichment: needsEnrichment ?? 0,
    recentFailures: recentFailures ?? 0,
    successRate,
  };
}
