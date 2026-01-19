import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Settings,
  Activity,
  Clock,
  Loader2,
  ListChecks,
  FileText,
  Download,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Input } from '@/shared/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  getSources, 
  toggleSource, 
  triggerCoordinator,
  triggerWorker,
  retryFailedJobs,
  fetchLogs,
  MAX_RETRY_ATTEMPTS,
  type ScraperSource,
  type LogEntry,
  type LogsResult,
} from './api/scraperService';

// Types
interface ScrapeJob {
  id: string;
  source_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  events_scraped: number;
  events_inserted: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  source_name?: string;
}

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total_scraped: number;
  total_inserted: number;
}

interface LogsSummary {
  total: number;
  fatal: number;
  errors: number;
  warnings: number;
  info: number;
  debug: number;
  by_source: Record<string, number>;
  by_function: Record<string, number>;
}

type HealthStatus = 'healthy' | 'warning' | 'error';

// Utility functions
function isSourceEnabled(source: ScraperSource): boolean {
  return source.enabled && !source.auto_disabled;
}

function getHealthStatus(source: ScraperSource): HealthStatus {
  if (source.auto_disabled) return 'error';
  if ((source.consecutive_failures ?? 0) >= MAX_RETRY_ATTEMPTS) return 'error';
  if ((source.consecutive_failures ?? 0) >= 1) return 'warning';
  if (source.last_success === false) return 'warning';
  return 'healthy';
}

function getHealthBadge(status: HealthStatus) {
  switch (status) {
    case 'healthy':
      return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 size={12} className="mr-1" /> Healthy</Badge>;
    case 'warning':
      return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><AlertTriangle size={12} className="mr-1" /> Warning</Badge>;
    case 'error':
      return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle size={12} className="mr-1" /> Error</Badge>;
  }
}

function formatRelativeTime(date: string | null): string {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function Admin() {
  const navigate = useNavigate();
  
  // Sources state
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Job queue state
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [jobStats, setJobStats] = useState<JobStats>({ 
    pending: 0, processing: 0, completed: 0, failed: 0, total_scraped: 0, total_inserted: 0 
  });
  
  // Logs state
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsSummary, setLogsSummary] = useState<LogsSummary | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logsMinutes, setLogsMinutes] = useState<number>(60);

  // Pipeline control state
  const [pipelineLoading, setPipelineLoading] = useState<Record<string, boolean>>({
    coordinator: false,
    worker: false,
    retryFailed: false,
  });

  // Load functions
  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSources();
      setSources(data);
    } catch (error) {
      toast.error('Failed to load sources');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const { data: statsData } = await supabase
        .from('scrape_jobs')
        .select('status, events_scraped, events_inserted');
      
      if (statsData) {
        const stats: JobStats = { 
          pending: 0, processing: 0, completed: 0, failed: 0, 
          total_scraped: 0, total_inserted: 0 
        };
        statsData.forEach((job) => {
          if (job.status === 'pending') stats.pending++;
          else if (job.status === 'processing') stats.processing++;
          else if (job.status === 'completed') stats.completed++;
          else if (job.status === 'failed') stats.failed++;
          stats.total_scraped += job.events_scraped || 0;
          stats.total_inserted += job.events_inserted || 0;
        });
        setJobStats(stats);
      }

      const { data: jobsData } = await supabase
        .from('scrape_jobs')
        .select('id, source_id, status, attempts, events_scraped, events_inserted, error_message, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (jobsData) {
        const sourceIds = [...new Set(jobsData.map((j) => j.source_id))];
        const { data: sourcesData } = await supabase
          .from('scraper_sources')
          .select('id, name')
          .in('id', sourceIds);
        
        const sourceMap = new Map(sourcesData?.map((s) => [s.id, s.name]) || []);
        
        setJobs(jobsData.map((j) => ({
          id: j.id,
          source_id: j.source_id,
          status: j.status as ScrapeJob['status'],
          attempts: j.attempts ?? 0,
          events_scraped: j.events_scraped ?? 0,
          events_inserted: j.events_inserted ?? 0,
          error_message: j.error_message,
          created_at: j.created_at ?? '',
          completed_at: j.completed_at,
          source_name: sourceMap.get(j.source_id) || 'Unknown'
        })));
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    loadSources();
    loadJobs();
  }, [loadSources, loadJobs]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (jobStats.pending > 0 || jobStats.processing > 0) {
        loadJobs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobStats.pending, jobStats.processing, loadJobs]);

  // Handlers
  async function handleTriggerCoordinator() {
    setPipelineLoading(prev => ({ ...prev, coordinator: true }));
    try {
      const result = await triggerCoordinator();
      if (result.success) {
        toast.success(`Queued ${result.jobsCreated ?? 0} scrape jobs`);
        await loadJobs();
      } else {
        toast.error(result.error || 'Failed to queue jobs');
      }
    } catch {
      toast.error('Failed to trigger coordinator');
    } finally {
      setPipelineLoading(prev => ({ ...prev, coordinator: false }));
    }
  }

  async function handleTriggerWorker() {
    setPipelineLoading(prev => ({ ...prev, worker: true }));
    try {
      const result = await triggerWorker();
      if (result.success) {
        toast.success('Worker processing jobs...');
        await loadJobs();
      } else {
        toast.error(result.error || 'Failed to trigger worker');
      }
    } catch {
      toast.error('Failed to trigger worker');
    } finally {
      setPipelineLoading(prev => ({ ...prev, worker: false }));
    }
  }

  async function handleRetryFailedJobs() {
    setPipelineLoading(prev => ({ ...prev, retryFailed: true }));
    try {
      const result = await retryFailedJobs();
      if (result.success) {
        if (result.retriedCount > 0) {
          toast.success(`Retrying ${result.retriedCount} failed job(s)`);
          await loadJobs();
        } else {
          toast.info('No failed jobs to retry');
        }
      } else {
        toast.error(result.error || 'Failed to retry jobs');
      }
    } catch (error) {
      toast.error('Failed to retry jobs: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPipelineLoading(prev => ({ ...prev, retryFailed: false }));
    }
  }

  async function clearCompletedJobs() {
    try {
      await supabase.from('scrape_jobs').delete().in('status', ['completed', 'failed']);
      toast.success('Cleared completed jobs');
      await loadJobs();
    } catch {
      toast.error('Failed to clear jobs');
    }
  }

  async function handleToggleSource(id: string, enabled: boolean) {
    try {
      await toggleSource(id, enabled);
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, enabled, auto_disabled: enabled ? false : s.auto_disabled } : s
      ));
      toast.success(enabled ? 'Source enabled' : 'Source disabled');
    } catch {
      toast.error('Failed to update source');
    }
  }

  async function handleFetchLogs() {
    setLogsLoading(true);
    try {
      const result = await fetchLogs(logsMinutes);
      if (result.success) {
        setLogs(result.logs || []);
        setLogsSummary(result.summary || null);
        setShowLogs(true);
        const { fatal = 0, errors = 0, warnings = 0, total = 0 } = result.summary || {};
        if (fatal > 0 || errors > 0) {
          toast.error(`Fetched ${total} entries: ${fatal} fatal, ${errors} errors, ${warnings} warnings`);
        } else if (warnings > 0) {
          toast.warning(`Fetched ${total} entries: ${warnings} warnings`);
        } else {
          toast.success(`Fetched ${total} log entries from last ${logsMinutes} min`);
        }
      } else {
        toast.error(result.error || 'Failed to fetch logs');
      }
    } catch {
      toast.error('Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  }

  function downloadLogs() {
    if (logs.length === 0) return;
    const jsonl = logs.map(l => JSON.stringify(l)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase-logs-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
  }

  // Stats
  const enabledCount = sources.filter(isSourceEnabled).length;
  const brokenCount = sources.filter(s => getHealthStatus(s) === 'error').length;
  const warningCount = sources.filter(s => getHealthStatus(s) === 'warning').length;
  
  // Filter sources by search query
  const filteredSources = sources.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/feed')}>
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Settings size={20} />
                Scraper Admin
              </h1>
              <p className="text-xs text-muted-foreground">Pipeline monitoring & control</p>
            </div>
          </div>
          <Button onClick={loadJobs} variant="outline" className="gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Pipeline Control */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
        <div className="mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Zap size={18} /> Pipeline Control
          </h2>
          <p className="text-sm text-muted-foreground">Trigger scraper pipeline components</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Trigger Coordinator */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <Play size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Queue Jobs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trigger coordinator to create jobs for enabled sources
                </p>
              </div>
            </div>
            <Button 
              onClick={handleTriggerCoordinator}
              disabled={pipelineLoading.coordinator || jobStats.pending > 0}
              className="w-full gap-2 mt-2"
              variant="default"
            >
              {pipelineLoading.coordinator ? (
                <><Loader2 size={14} className="animate-spin" /> Queueing...</>
              ) : (
                <><Play size={14} /> Trigger Coordinator</>
              )}
            </Button>
          </div>

          {/* Trigger Worker */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <Activity size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Process Queue</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trigger worker to process pending jobs
                </p>
              </div>
            </div>
            <Button 
              onClick={handleTriggerWorker}
              disabled={pipelineLoading.worker || jobStats.pending === 0}
              className="w-full gap-2 mt-2"
              variant="outline"
            >
              {pipelineLoading.worker ? (
                <><Loader2 size={14} className="animate-spin" /> Processing...</>
              ) : (
                <><Activity size={14} /> Trigger Worker</>
              )}
            </Button>
          </div>

          {/* Retry Failed */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <RotateCcw size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Retry Failed</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reset failed jobs to pending and retry
                </p>
              </div>
            </div>
            <Button 
              onClick={handleRetryFailedJobs}
              disabled={jobStats.failed === 0 || pipelineLoading.retryFailed}
              className="w-full gap-2 mt-2"
              variant="outline"
            >
              {pipelineLoading.retryFailed ? (
                <><Loader2 size={14} className="animate-spin" /> Retrying...</>
              ) : (
                <><RotateCcw size={14} /> Retry {jobStats.failed} Failed</>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Job Queue */}
      <section className="px-4 py-4 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <ListChecks size={18} /> Job Queue
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={loadJobs} className="h-7 px-2">
              <RefreshCw size={12} />
            </Button>
            {(jobStats.completed > 0 || jobStats.failed > 0) && (
              <Button variant="ghost" size="sm" onClick={clearCompletedJobs} className="h-7 px-2 text-muted-foreground">
                Clear Done
              </Button>
            )}
          </div>
        </div>
        
        {(jobStats.pending > 0 || jobStats.processing > 0 || jobStats.completed > 0) && (
          <div className="mb-3">
            <Progress 
              value={((jobStats.completed + jobStats.failed) / Math.max(1, jobStats.pending + jobStats.processing + jobStats.completed + jobStats.failed)) * 100} 
              className="h-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {jobStats.completed + jobStats.failed} / {jobStats.pending + jobStats.processing + jobStats.completed + jobStats.failed} jobs complete
            </p>
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 mb-3">
          {[
            { label: 'Pending', value: jobStats.pending, icon: Clock, color: 'text-amber-500' },
            { label: 'Processing', value: jobStats.processing, icon: Loader2, color: 'text-blue-500', spin: jobStats.processing > 0 },
            { label: 'Completed', value: jobStats.completed, icon: CheckCircle2, color: 'text-green-500' },
            { label: 'Failed', value: jobStats.failed, icon: XCircle, color: 'text-red-500' },
          ].map(({ label, value, icon: Icon, color, spin }) => (
            <div key={label} className="bg-background rounded-lg p-3 text-center border border-border">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Icon size={14} className={`${color} ${spin ? 'animate-spin' : ''}`} />
                <span className="text-2xl font-bold">{value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm mb-3">
          <span className="text-muted-foreground">Total scraped: <strong>{jobStats.total_scraped}</strong></span>
          <span className="text-green-600">New events: <strong>{jobStats.total_inserted}</strong></span>
        </div>

        {jobs.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {jobs.slice(0, 10).map(job => (
              <div 
                key={job.id} 
                className={`flex items-center justify-between py-1.5 px-2 rounded text-xs ${
                  job.status === 'processing' ? 'bg-blue-500/10' : 
                  job.status === 'completed' ? 'bg-green-500/5' : 
                  job.status === 'failed' ? 'bg-red-500/10' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {job.status === 'pending' && <Clock size={12} className="text-amber-500 flex-shrink-0" />}
                  {job.status === 'processing' && <Loader2 size={12} className="text-blue-500 animate-spin flex-shrink-0" />}
                  {job.status === 'completed' && <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />}
                  {job.status === 'failed' && <XCircle size={12} className="text-red-500 flex-shrink-0" />}
                  <span className="truncate">{job.source_name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {job.status === 'completed' && (
                    <span className="text-muted-foreground">{job.events_scraped} scraped, {job.events_inserted} new</span>
                  )}
                  {job.status === 'failed' && job.error_message && (
                    <span className="text-red-500 truncate max-w-32" title={job.error_message}>
                      {job.error_message.slice(0, 30)}...
                    </span>
                  )}
                  {job.attempts > 1 && <Badge variant="outline" className="text-[10px] h-4">Attempt {job.attempts}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Logs Section */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-green-500/5 to-emerald-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={18} /> Edge Function Logs
            </h2>
            <p className="text-sm text-muted-foreground">Fetch and download recent Supabase edge function logs</p>
          </div>
          {logs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">{logs.length} entries</Badge>
              {logsSummary?.fatal ? <Badge variant="destructive" className="gap-1 bg-purple-600"><XCircle size={10} /> {logsSummary.fatal} fatal</Badge> : null}
              {logsSummary?.errors ? <Badge variant="destructive" className="gap-1"><XCircle size={10} /> {logsSummary.errors} errors</Badge> : null}
              {logsSummary?.warnings ? <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30"><AlertTriangle size={10} /> {logsSummary.warnings} warnings</Badge> : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Time range:</label>
            <select value={logsMinutes} onChange={(e) => setLogsMinutes(Number(e.target.value))} className="h-9 px-2 rounded-md border border-input bg-background text-sm">
              <option value={15}>15 min</option>
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>
          <Button onClick={handleFetchLogs} disabled={logsLoading} className="gap-2">
            {logsLoading ? <><Loader2 size={16} className="animate-spin" /> Fetching...</> : <><FileText size={16} /> Fetch Logs</>}
          </Button>
          {logs.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={downloadLogs} className="gap-1">
                <Download size={14} /> Download JSONL
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowLogs(!showLogs)} className="gap-1">
                {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showLogs ? 'Hide' : 'Show'} Logs
              </Button>
            </>
          )}
        </div>

        {logsSummary && Object.keys(logsSummary.by_source || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3 text-xs">
            <span className="text-muted-foreground">By source:</span>
            {Object.entries(logsSummary.by_source).map(([source, count]) => (
              <Badge key={source} variant="secondary" className="text-[10px]">{source}: {count}</Badge>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showLogs && logs.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-background border border-border rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                {logs.slice(0, 50).map((log, i) => (
                  <div key={i} className={`py-1 px-2 rounded ${log.level === 'fatal' ? 'bg-purple-500/10 text-purple-600' : log.level === 'error' ? 'bg-red-500/10 text-red-600' : log.level === 'warn' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted/50'}`}>
                    <span className="text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
                    {log.function_name && <span className="ml-2 text-primary">[{log.function_name}]</span>}
                    <span className="ml-2">{log.message || JSON.stringify(log).slice(0, 200)}</span>
                  </div>
                ))}
                {logs.length > 50 && <p className="text-center text-muted-foreground py-2">... and {logs.length - 50} more entries. Download for full logs.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {logs.length === 0 && !logsLoading && (
          <p className="text-sm text-muted-foreground text-center py-2">Click "Fetch Logs" to load recent edge function logs.</p>
        )}
      </section>

      {/* Source Stats */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Activity size={14} className="text-muted-foreground" /> <strong>{sources.length}</strong> sources</span>
            <span className="text-green-600">{enabledCount} enabled</span>
            {warningCount > 0 && <span className="text-amber-600">{warningCount} warning</span>}
            {brokenCount > 0 && <span className="text-red-600">{brokenCount} broken</span>}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <Input 
          placeholder="Search sources by name or URL..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Sources List */}
      <div className="divide-y divide-border">
        {filteredSources.map(source => {
          const health = getHealthStatus(source);
          
          return (
            <motion.div key={source.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{source.name}</h3>
                    {getHealthBadge(health)}
                  </div>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate">
                    {source.url} <ExternalLink size={10} />
                  </a>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Last: {formatRelativeTime(source.last_scraped_at)}</span>
                    <span>Total: {source.total_events_scraped ?? 0} events</span>
                    {source.consecutive_failures && source.consecutive_failures > 0 && (
                      <span className="text-red-500">{source.consecutive_failures} failures</span>
                    )}
                  </div>
                  {source.last_error && <p className="text-xs text-red-500 mt-1 truncate">{source.last_error}</p>}
                </div>
                <Switch checked={source.enabled && !source.auto_disabled} onCheckedChange={(checked) => handleToggleSource(source.id, checked)} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
