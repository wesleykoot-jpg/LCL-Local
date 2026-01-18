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
  Trash2,
  Search,
  Globe,
  MapPin,
  FileText,
  Download,
  Play,
  PlayCircle,
  RotateCcw,
  Target,
  Wrench,
  Server
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  getSources, 
  toggleSource, 
  triggerScraper, 
  testSource,
  disableBrokenSources,
  resetSourceHealth,
  triggerCoordinator,
  updateSourceConfig,
  pruneEvents,
  triggerSourceDiscovery,
  getDiscoveredSources,
  fetchLogs,
  runScraperTests,
  triggerRunScraper,
  triggerScrapeWorker,
  retryFailedJobs,
  queueSourcesForScraping,
  triggerSelectedSources,
  type ScraperSource,
  type ScrapeResult,
  type DryRunResult,
  type DiscoveredSource,
  type LogEntry,
  type IntegrityTestReport
} from './api/scraperService';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/shared/components/ui/alert-dialog';
import { Input } from '@/shared/components/ui/input';

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
function getHealthStatus(source: ScraperSource): HealthStatus {
  if (source.auto_disabled) return 'error';
  if ((source.consecutive_failures ?? 0) >= 3) return 'error';
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
  const [scraping, setScraping] = useState(false);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScrapeResult | null>(null);
  const [testResults, setTestResults] = useState<Record<string, DryRunResult>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  
  // Scheduler state
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [lastScheduledRun, setLastScheduledRun] = useState<string | null>(null);
  
  // Config dialog state
  const [configDialogSource, setConfigDialogSource] = useState<ScraperSource | null>(null);
  const [configValue, setConfigValue] = useState('');
  const [configSaving, setConfigSaving] = useState(false);
  
  // Prune dialog state
  const [pruneDialogOpen, setPruneDialogOpen] = useState(false);
  const [pruning, setPruning] = useState(false);
  
  // Source discovery state
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveredSources, setDiscoveredSources] = useState<DiscoveredSource[]>([]);
  const [maxMunicipalities, setMaxMunicipalities] = useState<number>(10);
  const [minPopulation, setMinPopulation] = useState<number>(50000);
  
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

  // Integrity test state
  const [testRunning, setTestRunning] = useState(false);
  const [testReport, setTestReport] = useState<IntegrityTestReport | null>(null);
  const [showTestResults, setShowTestResults] = useState(false);

  // Error state for API failures
  const [apiError, setApiError] = useState<string | null>(null);
  const [showErrorBanner, setShowErrorBanner] = useState(true);

  // Pipeline control state
  const [pipelineLoading, setPipelineLoading] = useState<Record<string, boolean>>({
    runScraper: false,
    scrapeWorker: false,
    selectedSources: false,
    queueSources: false,
    retryFailed: false,
  });

  // Load functions
  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSources();
      setSources(data);
      setApiError(null); // Clear error on success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Failed to fetch')) {
        setApiError('API calls blocked - check browser extensions or network settings');
      } else {
        setApiError(errorMessage);
      }
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
        setLastScheduledRun(jobsData[0]?.created_at ?? null);
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

  const loadDiscoveredSources = useCallback(async () => {
    try {
      const data = await getDiscoveredSources();
      setDiscoveredSources(data);
    } catch (error) {
      console.error('Failed to load discovered sources:', error);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    loadSources();
    loadJobs();
    loadDiscoveredSources();
  }, [loadSources, loadJobs, loadDiscoveredSources]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (jobStats.pending > 0 || jobStats.processing > 0) {
        loadJobs();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobStats.pending, jobStats.processing, loadJobs]);

  // Handlers
  async function handleTriggerDiscovery() {
    setDiscoveryLoading(true);
    try {
      const result = await triggerSourceDiscovery({ maxMunicipalities, minPopulation });
      if (result.success) {
        toast.success(`Discovery started! Found ${result.sourcesDiscovered ?? 0} sources, ${result.sourcesEnabled ?? 0} enabled`);
        setTimeout(() => { loadDiscoveredSources(); loadSources(); }, 5000);
      } else if (result.error?.includes('timeout') || result.error?.includes('context canceled')) {
        toast.info('Discovery running in background - check back in a few minutes');
        setTimeout(() => { loadDiscoveredSources(); loadSources(); }, 30000);
      } else {
        toast.error(result.error || 'Discovery failed');
      }
    } catch {
      toast.info('Discovery running in background - check back in a few minutes');
      setTimeout(() => { loadDiscoveredSources(); loadSources(); }, 30000);
    } finally {
      setDiscoveryLoading(false);
    }
  }

  async function handleTriggerScheduler() {
    setSchedulerLoading(true);
    try {
      const result = await triggerCoordinator();
      if (result.success) {
        toast.success(`Queued ${result.jobsCreated ?? 0} scrape jobs`);
        await loadJobs();
      } else {
        toast.error(result.error || 'Failed to queue jobs');
      }
    } catch {
      toast.error('Failed to trigger scheduler');
    } finally {
      setSchedulerLoading(false);
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

  async function handleRunAll() {
    setScraping(true);
    try {
      const result = await triggerScraper();
      setLastResult(result);
      setShowResults(true);
      toast.success(`Scraped ${result.totals?.inserted ?? result.inserted ?? 0} new events`);
      await loadSources();
    } catch (error) {
      toast.error('Scraping failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setScraping(false);
    }
  }

  async function handleTestSource(sourceId: string) {
    setTestingSourceId(sourceId);
    try {
      const result = await testSource(sourceId);
      setTestResults(prev => ({ ...prev, [sourceId]: result }));
      if (result.success) toast.success(`Found ${result.eventsFound} events`);
      else toast.error(result.error || 'Test failed');
    } catch {
      toast.error('Test failed');
    } finally {
      setTestingSourceId(null);
    }
  }

  async function handleDisableBroken() {
    try {
      const count = await disableBrokenSources();
      if (count > 0) { toast.success(`Disabled ${count} broken source(s)`); await loadSources(); }
      else toast.info('No broken sources to disable');
    } catch {
      toast.error('Failed to disable sources');
    }
  }

  async function handleResetHealth(id: string) {
    try {
      await resetSourceHealth(id);
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, consecutive_failures: 0, last_error: null, auto_disabled: false } : s
      ));
      toast.success('Health reset');
    } catch {
      toast.error('Failed to reset health');
    }
  }

  function openConfigDialog(source: ScraperSource) {
    setConfigDialogSource(source);
    setConfigValue(JSON.stringify(source.config ?? {}, null, 2));
  }

  async function handleSaveConfig() {
    if (!configDialogSource) return;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(configValue); } catch { toast.error('Config must be valid JSON'); return; }
    try {
      setConfigSaving(true);
      await updateSourceConfig(configDialogSource.id, parsed);
      setSources(prev => prev.map(s => s.id === configDialogSource.id ? { ...s, config: parsed } : s));
      toast.success('Config updated');
      setConfigDialogSource(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update configuration');
    } finally {
      setConfigSaving(false);
    }
  }

  async function handlePruneEvents() {
    try {
      setPruning(true);
      const deleted = await pruneEvents();
      toast.success(`Deleted ${deleted} stale event(s)`);
    } catch {
      toast.error('Failed to prune events');
    } finally {
      setPruning(false);
      setPruneDialogOpen(false);
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

  async function handleRunIntegrityTests() {
    setTestRunning(true);
    try {
      const report = await runScraperTests();
      setTestReport(report);
      setShowTestResults(true);
      
      if (report.success) {
        toast.success(`All ${report.summary.passed} tests passed!`);
      } else {
        toast.error(`${report.summary.failed} of ${report.summary.total} tests failed`);
      }
    } catch (error) {
      toast.error('Failed to run integrity tests');
      console.error(error);
    } finally {
      setTestRunning(false);
    }
  }

  // Pipeline control handlers
  async function handleTriggerRunScraper() {
    setPipelineLoading(prev => ({ ...prev, runScraper: true }));
    try {
      const result = await triggerRunScraper();
      setLastResult(result);
      setShowResults(true);
      toast.success(`Run-scraper: Scraped ${result.totals?.inserted ?? result.inserted ?? 0} new events`);
      await loadSources();
      await loadJobs();
    } catch (error) {
      toast.error('Run-scraper failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPipelineLoading(prev => ({ ...prev, runScraper: false }));
    }
  }

  async function handleTriggerScrapeWorker(sourceId: string) {
    setPipelineLoading(prev => ({ ...prev, scrapeWorker: true }));
    try {
      const result = await triggerScrapeWorker(sourceId);
      setLastResult(result);
      setShowResults(true);
      toast.success(`Scrape-worker: Scraped ${result.totals?.inserted ?? result.inserted ?? 0} new events`);
      await loadSources();
    } catch (error) {
      toast.error('Scrape-worker failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPipelineLoading(prev => ({ ...prev, scrapeWorker: false }));
    }
  }

  async function handleRunSelectedSources() {
    if (selectedSources.size === 0) {
      toast.error('No sources selected');
      return;
    }
    
    setPipelineLoading(prev => ({ ...prev, selectedSources: true }));
    try {
      const sourceIds = Array.from(selectedSources);
      const result = await triggerSelectedSources(sourceIds);
      setLastResult(result);
      setShowResults(true);
      toast.success(`Ran ${sourceIds.length} sources: ${result.totals?.inserted ?? result.inserted ?? 0} new events`);
      await loadSources();
    } catch (error) {
      toast.error('Failed to run selected sources: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPipelineLoading(prev => ({ ...prev, selectedSources: false }));
    }
  }

  async function handleQueueSelectedSources() {
    if (selectedSources.size === 0) {
      toast.error('No sources selected');
      return;
    }
    
    setPipelineLoading(prev => ({ ...prev, queueSources: true }));
    try {
      const sourceIds = Array.from(selectedSources);
      const result = await queueSourcesForScraping(sourceIds);
      if (result.success) {
        toast.success(`Queued ${result.jobsCreated} sources for scraping`);
        await loadJobs();
        setSelectedSources(new Set()); // Clear selection
      } else {
        toast.error(result.error || 'Failed to queue sources');
      }
    } catch (error) {
      toast.error('Failed to queue sources: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setPipelineLoading(prev => ({ ...prev, queueSources: false }));
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

  function handleSelectAll() {
    if (selectedSources.size === sources.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(sources.map(s => s.id)));
    }
  }

  function handleSelectEnabled() {
    const enabledSourceIds = sources.filter(s => s.enabled && !s.auto_disabled).map(s => s.id);
    setSelectedSources(new Set(enabledSourceIds));
  }

  function handleSelectBroken() {
    const brokenSourceIds = sources.filter(s => getHealthStatus(s) === 'error').map(s => s.id);
    setSelectedSources(new Set(brokenSourceIds));
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

  function toggleSelectSource(id: string) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Stats
  const enabledCount = sources.filter(s => s.enabled && !s.auto_disabled).length;
  const brokenCount = sources.filter(s => getHealthStatus(s) === 'error').length;
  const warningCount = sources.filter(s => getHealthStatus(s) === 'warning').length;
  const lastScrapedAt = sources
    .filter(s => s.last_scraped_at)
    .sort((a, b) => new Date(b.last_scraped_at!).getTime() - new Date(a.last_scraped_at!).getTime())[0]?.last_scraped_at;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* API Error Banner */}
      {apiError && showErrorBanner && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-600">API Connection Failed</p>
                <p className="text-xs text-red-500 mt-1">
                  {apiError}. This is likely caused by:
                </p>
                <ul className="text-xs text-red-500 mt-1 space-y-0.5 list-disc list-inside">
                  <li>Browser extension blocking requests (ad blocker, privacy tool)</li>
                  <li>Network firewall or VPN blocking Supabase domain</li>
                  <li>Missing or incorrect environment variables</li>
                </ul>
                <p className="text-xs text-red-500 mt-2">
                  <strong>Try:</strong> Disable browser extensions, check .env configuration, or try a different browser.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { loadSources(); loadJobs(); loadDiscoveredSources(); }} 
                className="h-8 gap-1 text-xs"
              >
                <RefreshCw size={12} /> Retry
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowErrorBanner(false)} 
                className="h-8 w-8"
              >
                <XCircle size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95  border-b border-border">
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
              <p className="text-xs text-muted-foreground">Manage event sources</p>
            </div>
          </div>
          <Button onClick={handleRunAll} disabled={scraping} variant="outline" className="gap-2">
            <RefreshCw size={16} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'Running...' : 'Run Legacy'}
          </Button>
        </div>
      </header>

      {/* Scraper Pipeline Control */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Wrench size={18} /> Scraper Pipeline Control
            </h2>
            <p className="text-sm text-muted-foreground">Manual triggers and troubleshooting tools for the scraper pipeline</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Server size={12} /> {selectedSources.size} selected
          </Badge>
        </div>

        {/* Selection Controls */}
        <div className="mb-4 p-3 bg-background/80 rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm font-medium">Source Selection</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="h-7 px-2 text-xs">
                {selectedSources.size === sources.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectEnabled} className="h-7 px-2 text-xs">
                <CheckCircle2 size={12} className="mr-1" /> Enabled ({sources.filter(s => s.enabled && !s.auto_disabled).length})
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectBroken} className="h-7 px-2 text-xs">
                <XCircle size={12} className="mr-1" /> Broken ({sources.filter(s => getHealthStatus(s) === 'error').length})
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Select sources from the list below, then use the action buttons to run or queue them
          </p>
        </div>

        {/* Pipeline Triggers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Run Selected Sources */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <Play size={16} className="text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Run Selected Sources</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Execute scraper immediately for selected sources (bypasses queue)
                </p>
              </div>
            </div>
            <Button 
              onClick={handleRunSelectedSources}
              disabled={selectedSources.size === 0 || pipelineLoading.selectedSources}
              className="w-full gap-2 mt-2"
              variant="default"
            >
              {pipelineLoading.selectedSources ? (
                <><Loader2 size={14} className="animate-spin" /> Running...</>
              ) : (
                <><Play size={14} /> Run {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>

          {/* Queue Selected Sources */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <ListChecks size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Queue Selected Sources</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add selected sources to scrape job queue for async processing
                </p>
              </div>
            </div>
            <Button 
              onClick={handleQueueSelectedSources}
              disabled={selectedSources.size === 0 || pipelineLoading.queueSources}
              className="w-full gap-2 mt-2"
              variant="outline"
            >
              {pipelineLoading.queueSources ? (
                <><Loader2 size={14} className="animate-spin" /> Queueing...</>
              ) : (
                <><ListChecks size={14} /> Queue {selectedSources.size} Source{selectedSources.size !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>

          {/* Run-Scraper Function */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <Server size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Trigger run-scraper</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Execute run-scraper edge function (all enabled sources)
                </p>
              </div>
            </div>
            <Button 
              onClick={handleTriggerRunScraper}
              disabled={pipelineLoading.runScraper}
              className="w-full gap-2 mt-2"
              variant="outline"
            >
              {pipelineLoading.runScraper ? (
                <><Loader2 size={14} className="animate-spin" /> Running...</>
              ) : (
                <><Server size={14} /> Trigger run-scraper</>
              )}
            </Button>
          </div>

          {/* Retry Failed Jobs */}
          <div className="p-3 bg-background/80 rounded-lg border border-border">
            <div className="flex items-start gap-2 mb-2">
              <RotateCcw size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">Retry Failed Jobs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reset failed jobs to pending status and retry them (max 3 attempts)
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
                <><RotateCcw size={14} /> Retry {jobStats.failed} Failed Job{jobStats.failed !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </div>

        {/* Pipeline Status Indicators */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2 bg-background/50 rounded border border-border text-center">
            <div className="text-xs text-muted-foreground mb-1">Selected</div>
            <div className="text-lg font-bold text-blue-600">{selectedSources.size}</div>
          </div>
          <div className="p-2 bg-background/50 rounded border border-border text-center">
            <div className="text-xs text-muted-foreground mb-1">Enabled</div>
            <div className="text-lg font-bold text-green-600">{sources.filter(s => s.enabled && !s.auto_disabled).length}</div>
          </div>
          <div className="p-2 bg-background/50 rounded border border-border text-center">
            <div className="text-xs text-muted-foreground mb-1">Warning</div>
            <div className="text-lg font-bold text-amber-600">{sources.filter(s => getHealthStatus(s) === 'warning').length}</div>
          </div>
          <div className="p-2 bg-background/50 rounded border border-border text-center">
            <div className="text-xs text-muted-foreground mb-1">Broken</div>
            <div className="text-lg font-bold text-red-600">{sources.filter(s => getHealthStatus(s) === 'error').length}</div>
          </div>
        </div>
      </section>

      {/* Automation & Scheduling */}
      <section className="px-4 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Clock size={18} /> Automation & Scheduling
            </h2>
            <p className="text-sm text-muted-foreground">Trigger the daily scheduler and monitor automation</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock size={14} />
            <span>Last Run: {formatRelativeTime(lastScheduledRun)}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button 
            onClick={handleTriggerScheduler} 
            disabled={schedulerLoading || jobStats.pending > 0 || jobStats.processing > 0}
            size="lg" className="gap-2"
          >
            <Zap size={18} className={schedulerLoading ? 'animate-spin' : ''} />
            {schedulerLoading ? 'Triggering...' : 'Trigger Daily Scheduler'}
          </Button>
          <Button variant="outline" size="sm" onClick={loadJobs} className="gap-1">
            <RefreshCw size={14} /> Refresh Queue
          </Button>
        </div>
      </section>

      {/* Job Queue */}
      <section className="px-4 py-4 bg-gradient-to-r from-primary/5 to-accent/5 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <ListChecks size={18} /> Scrape Job Queue
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

        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">Total scraped: <strong>{jobStats.total_scraped}</strong></span>
          <span className="text-green-600">New events: <strong>{jobStats.total_inserted}</strong></span>
        </div>

        {jobs.length > 0 && (
          <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
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

      {/* Source Discovery */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Search size={18} /> Source Discovery
            </h2>
            <p className="text-sm text-muted-foreground">Automatically find new event sources from Dutch municipalities</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Globe size={12} /> {discoveredSources.length} discovered
          </Badge>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground block mb-1">Max Municipalities</label>
            <Input type="number" min={1} max={100} value={maxMunicipalities} onChange={(e) => setMaxMunicipalities(Number(e.target.value) || 10)} className="h-9 w-full" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-muted-foreground block mb-1">Min Population</label>
            <Input type="number" min={1000} step={10000} value={minPopulation} onChange={(e) => setMinPopulation(Number(e.target.value) || 50000)} className="h-9 w-full" />
          </div>
          <Button onClick={handleTriggerDiscovery} disabled={discoveryLoading} className="gap-2">
            {discoveryLoading ? <><Loader2 size={16} className="animate-spin" /> Discovering...</> : <><Search size={16} /> Start Discovery</>}
          </Button>
          <Button variant="outline" size="sm" onClick={loadDiscoveredSources} className="gap-1">
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>

        {discoveredSources.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2"><MapPin size={14} /> Recently Discovered</h3>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
              {discoveredSources.slice(0, 8).map((source) => (
                <div key={source.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-border text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe size={14} className="text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{source.name}</span>
                      {source.location_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin size={10} /> {source.location_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={source.enabled ? "default" : "secondary"} className="text-[10px]">
                      {source.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {discoveredSources.length === 0 && !discoveryLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No sources discovered yet. Click "Start Discovery" to find new event sources.
          </p>
        )}
      </section>

      {/* Logs Section */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-green-500/5 to-emerald-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={18} /> Edge Function Logs
            </h2>
            <p className="text-sm text-muted-foreground">Fetch and download recent Supabase edge function logs for error triage</p>
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

      {/* Integrity Tests Section */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-purple-500/5 to-pink-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Activity size={18} /> Scraper Integrity Tests
            </h2>
            <p className="text-sm text-muted-foreground">Run diagnostic tests to verify scraper logic and resilience</p>
          </div>
          {testReport && (
            <div className="flex gap-2 flex-wrap">
              <Badge variant={testReport.success ? "default" : "destructive"} className="gap-1">
                {testReport.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {testReport.summary.passed}/{testReport.summary.total} Passed
              </Badge>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <Button onClick={handleRunIntegrityTests} disabled={testRunning} className="gap-2">
            {testRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Running diagnostic tests...
              </>
            ) : (
              <>
                <Activity size={16} /> Run Scraper Integrity Test
              </>
            )}
          </Button>
          {testReport && (
            <Button variant="ghost" size="sm" onClick={() => setShowTestResults(!showTestResults)} className="gap-1">
              {showTestResults ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showTestResults ? 'Hide' : 'Show'} Results
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showTestResults && testReport && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center gap-2">
                    Test Results
                    <span className="text-xs text-muted-foreground">
                      {new Date(testReport.timestamp).toLocaleString()}
                    </span>
                  </h3>
                  <Badge variant={testReport.success ? "default" : "destructive"}>
                    {testReport.success ? 'All Passed' : 'Some Failed'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {testReport.results.map((result, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-start justify-between py-2 px-3 rounded-lg border ${
                        result.status === 'PASS' 
                          ? 'bg-green-500/5 border-green-500/30' 
                          : 'bg-red-500/5 border-red-500/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.status === 'PASS' ? (
                            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle size={16} className="text-red-600 flex-shrink-0" />
                          )}
                          <span className="font-medium">{result.test}</span>
                        </div>
                        {result.message && (
                          <p className="text-sm text-muted-foreground ml-6">{result.message}</p>
                        )}
                        {result.details && Object.keys(result.details).length > 0 && (
                          <details className="ml-6 mt-1 text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-1 p-2 bg-muted/50 rounded overflow-x-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <Badge 
                        variant={result.status === 'PASS' ? 'default' : 'destructive'}
                        className="flex-shrink-0"
                      >
                        {result.status}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-border">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <p className="text-2xl font-bold">{testReport.summary.total}</p>
                      <p className="text-muted-foreground">Total</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{testReport.summary.passed}</p>
                      <p className="text-muted-foreground">Passed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{testReport.summary.failed}</p>
                      <p className="text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!testReport && !testRunning && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Click "Run Scraper Integrity Test" to validate scraper logic, resilience, and data accuracy.
          </p>
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
          <span className="text-muted-foreground">Last run: {formatRelativeTime(lastScrapedAt ?? null)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex gap-2 border-b border-border">
        <Button variant="outline" size="sm" onClick={handleDisableBroken} disabled={brokenCount === 0} className="gap-1">
          <XCircle size={14} /> Disable Broken ({brokenCount})
        </Button>
        <AlertDialog open={pruneDialogOpen} onOpenChange={setPruneDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1"><Trash2 size={14} /> Prune Stale Events</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Prune stale events</AlertDialogTitle>
              <AlertDialogDescription>This will delete events with an event date in the past. Are you sure you want to continue?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pruning}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handlePruneEvents} disabled={pruning}>{pruning ? 'Pruning...' : 'Confirm'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="outline" size="sm" onClick={loadSources} className="gap-1"><RefreshCw size={14} /> Refresh</Button>
      </div>

      {/* Sources List */}
      <div className="divide-y divide-border">
        {sources.map(source => {
          const health = getHealthStatus(source);
          const testResult = testResults[source.id];
          const isTesting = testingSourceId === source.id;
          
          return (
            <motion.div key={source.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <input type="checkbox" checked={selectedSources.has(source.id)} onChange={() => toggleSelectSource(source.id)} className="rounded border-border" />
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
                  {(source.last_rate_limit_remaining !== null || source.last_rate_limit_reset_ts || source.last_rate_limit_retry_after_seconds) && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-amber-600 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/20">
                      <AlertTriangle size={12} className="flex-shrink-0" />
                      <div className="flex items-center gap-3 flex-wrap">
                        {source.last_rate_limit_remaining !== null && (
                          <span>Remaining: <strong>{source.last_rate_limit_remaining}</strong></span>
                        )}
                        {source.last_rate_limit_reset_ts && (
                          <span>Reset: <strong>{formatRelativeTime(source.last_rate_limit_reset_ts)}</strong></span>
                        )}
                        {source.last_rate_limit_retry_after_seconds && (
                          <span>Retry-after: <strong>{source.last_rate_limit_retry_after_seconds}s</strong></span>
                        )}
                      </div>
                    </div>
                  )}
                  {testResult && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                      <p className={testResult.success ? 'text-green-600' : 'text-red-500'}>
                        {testResult.success ? `✓ Found ${testResult.eventsFound} events` : `✗ ${testResult.error}`}
                      </p>
                      {testResult.sampleEvents && testResult.sampleEvents.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-muted-foreground">
                          {testResult.sampleEvents.slice(0, 3).map((e, i) => <li key={i}>• {e.title}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openConfigDialog(source)} className="h-8 px-2">
                    <Settings size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleTestSource(source.id)} disabled={isTesting} className="h-8 px-2">
                    <Zap size={14} className={isTesting ? 'animate-pulse' : ''} />
                  </Button>
                  {health === 'error' && (
                    <Button variant="ghost" size="sm" onClick={() => handleResetHealth(source.id)} className="h-8 px-2 text-amber-600" title="Reset health">
                      <RefreshCw size={14} />
                    </Button>
                  )}
                  <Switch checked={source.enabled && !source.auto_disabled} onCheckedChange={(checked) => handleToggleSource(source.id, checked)} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Config Dialog */}
      <Dialog open={!!configDialogSource} onOpenChange={(open) => !open && setConfigDialogSource(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Config {configDialogSource ? `- ${configDialogSource.name}` : ''}</DialogTitle>
          </DialogHeader>
          <Textarea value={configValue} onChange={(e) => setConfigValue(e.target.value)} className="font-mono min-h-[240px]" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfigDialogSource(null)} disabled={configSaving}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={configSaving}>{configSaving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Panel */}
      <AnimatePresence>
        {showResults && lastResult && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg">
            <button onClick={() => setShowResults(!showResults)} className="w-full flex items-center justify-between px-4 py-2 bg-muted/50">
              <span className="font-medium text-sm">Last Scrape Results</span>
              {showResults ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            <div className="px-4 py-3 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs mb-3">
                <div><p className="text-2xl font-bold">{lastResult.sources?.length ?? 0}</p><p className="text-muted-foreground">Sources</p></div>
                <div><p className="text-2xl font-bold">{lastResult.totals?.totalScraped ?? lastResult.totalScraped ?? 0}</p><p className="text-muted-foreground">Scraped</p></div>
                <div><p className="text-2xl font-bold">{lastResult.totals?.parsedByAI ?? lastResult.parsedByAI ?? 0}</p><p className="text-muted-foreground">Parsed</p></div>
                <div><p className="text-2xl font-bold text-green-600">{lastResult.totals?.inserted ?? lastResult.inserted ?? 0}</p><p className="text-muted-foreground">New</p></div>
                <div><p className="text-2xl font-bold text-amber-600">{lastResult.totals?.skipped ?? lastResult.skipped ?? 0}</p><p className="text-muted-foreground">Dupes</p></div>
                <div><p className="text-2xl font-bold text-red-600">{lastResult.totals?.failed ?? lastResult.failed ?? 0}</p><p className="text-muted-foreground">Failed</p></div>
              </div>
              {lastResult.sources && lastResult.sources.length > 0 && (
                <div className="space-y-1 text-xs">
                  {lastResult.sources.map(s => (
                    <div key={s.sourceId} className="flex justify-between py-1 border-t border-border/50">
                      <span className="truncate">{s.sourceName}</span>
                      <span className={s.error ? 'text-red-500' : 'text-muted-foreground'}>{s.error ? '✗' : `${s.inserted} new`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
