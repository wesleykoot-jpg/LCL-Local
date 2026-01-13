import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  RefreshCw, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Zap,
  Settings,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  getSources, 
  toggleSource, 
  triggerScraper, 
  testSource,
  disableBrokenSources,
  resetSourceHealth,
  type ScraperSource,
  type ScrapeResult,
  type DryRunResult
} from '@/lib/scraperService';

type HealthStatus = 'healthy' | 'warning' | 'error';

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
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [testingSourceId, setTestingSourceId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScrapeResult | null>(null);
  const [testResults, setTestResults] = useState<Record<string, DryRunResult>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());

  // Check dev mode
  useEffect(() => {
    const storedDev = localStorage.getItem('dev_mode');
    if (storedDev !== 'true') {
      navigate('/feed');
    }
  }, [navigate]);

  // Load sources
  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
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
  }

  async function handleToggleSource(id: string, enabled: boolean) {
    try {
      await toggleSource(id, enabled);
      setSources(prev => prev.map(s => 
        s.id === id ? { ...s, enabled, auto_disabled: enabled ? false : s.auto_disabled } : s
      ));
      toast.success(enabled ? 'Source enabled' : 'Source disabled');
    } catch (error) {
      toast.error('Failed to update source');
    }
  }

  async function handleRunAll() {
    setScraping(true);
    try {
      const result = await triggerScraper();
      setLastResult(result);
      setShowResults(true);
      const inserted = result.totals?.inserted ?? result.inserted ?? 0;
      toast.success(`Scraped ${inserted} new events`);
      await loadSources(); // Refresh stats
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
      if (result.success) {
        toast.success(`Found ${result.eventsFound} events`);
      } else {
        toast.error(result.error || 'Test failed');
      }
    } catch (error) {
      toast.error('Test failed');
    } finally {
      setTestingSourceId(null);
    }
  }

  async function handleDisableBroken() {
    try {
      const count = await disableBrokenSources();
      if (count > 0) {
        toast.success(`Disabled ${count} broken source(s)`);
        await loadSources();
      } else {
        toast.info('No broken sources to disable');
      }
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to reset health');
    }
  }

  function toggleSelectSource(id: string) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
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
          <Button 
            onClick={handleRunAll} 
            disabled={scraping}
            className="gap-2"
          >
            <RefreshCw size={16} className={scraping ? 'animate-spin' : ''} />
            {scraping ? 'Running...' : 'Run All'}
          </Button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Activity size={14} className="text-muted-foreground" />
              <strong>{sources.length}</strong> sources
            </span>
            <span className="text-green-600">{enabledCount} enabled</span>
            {warningCount > 0 && <span className="text-amber-600">{warningCount} warning</span>}
            {brokenCount > 0 && <span className="text-red-600">{brokenCount} broken</span>}
          </div>
          <span className="text-muted-foreground">
            Last run: {formatRelativeTime(lastScrapedAt ?? null)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-3 flex gap-2 border-b border-border">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDisableBroken}
          disabled={brokenCount === 0}
          className="gap-1"
        >
          <XCircle size={14} />
          Disable Broken ({brokenCount})
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadSources}
          className="gap-1"
        >
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {/* Sources Table */}
      <div className="divide-y divide-border">
        {sources.map(source => {
          const health = getHealthStatus(source);
          const testResult = testResults[source.id];
          const isTesting = testingSourceId === source.id;
          
          return (
            <motion.div
              key={source.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={selectedSources.has(source.id)}
                      onChange={() => toggleSelectSource(source.id)}
                      className="rounded border-border"
                    />
                    <h3 className="font-medium truncate">{source.name}</h3>
                    {getHealthBadge(health)}
                  </div>
                  
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                  >
                    {source.url}
                    <ExternalLink size={10} />
                  </a>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Last: {formatRelativeTime(source.last_scraped_at)}</span>
                    <span>Total: {source.total_events_scraped ?? 0} events</span>
                    {source.consecutive_failures && source.consecutive_failures > 0 && (
                      <span className="text-red-500">{source.consecutive_failures} failures</span>
                    )}
                  </div>
                  
                  {source.last_error && (
                    <p className="text-xs text-red-500 mt-1 truncate">{source.last_error}</p>
                  )}
                  
                  {testResult && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                      <p className={testResult.success ? 'text-green-600' : 'text-red-500'}>
                        {testResult.success 
                          ? `✓ Found ${testResult.eventsFound} events` 
                          : `✗ ${testResult.error}`}
                      </p>
                      {testResult.sampleEvents && testResult.sampleEvents.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-muted-foreground">
                          {testResult.sampleEvents.slice(0, 3).map((e, i) => (
                            <li key={i}>• {e.title}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTestSource(source.id)}
                    disabled={isTesting}
                    className="h-8 px-2"
                  >
                    <Zap size={14} className={isTesting ? 'animate-pulse' : ''} />
                  </Button>
                  
                  {health === 'error' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetHealth(source.id)}
                      className="h-8 px-2 text-amber-600"
                      title="Reset health"
                    >
                      <RefreshCw size={14} />
                    </Button>
                  )}
                  
                  <Switch
                    checked={source.enabled && !source.auto_disabled}
                    onCheckedChange={(checked) => handleToggleSource(source.id, checked)}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Last Results Panel */}
      <AnimatePresence>
        {showResults && lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg"
          >
            <button
              onClick={() => setShowResults(!showResults)}
              className="w-full flex items-center justify-between px-4 py-2 bg-muted/50"
            >
              <span className="font-medium text-sm">Last Scrape Results</span>
              {showResults ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
            
            <div className="px-4 py-3 max-h-48 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2 text-center text-xs mb-3">
                <div>
                  <p className="text-2xl font-bold">{lastResult.totals?.totalScraped ?? lastResult.totalScraped ?? 0}</p>
                  <p className="text-muted-foreground">Scraped</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{lastResult.totals?.parsedByAI ?? lastResult.parsedByAI ?? 0}</p>
                  <p className="text-muted-foreground">Parsed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{lastResult.totals?.inserted ?? lastResult.inserted ?? 0}</p>
                  <p className="text-muted-foreground">New</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{lastResult.totals?.skipped ?? lastResult.skipped ?? 0}</p>
                  <p className="text-muted-foreground">Dupes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{lastResult.totals?.failed ?? lastResult.failed ?? 0}</p>
                  <p className="text-muted-foreground">Failed</p>
                </div>
              </div>
              
              {lastResult.sources && lastResult.sources.length > 0 && (
                <div className="space-y-1 text-xs">
                  {lastResult.sources.map(s => (
                    <div key={s.sourceId} className="flex justify-between py-1 border-t border-border/50">
                      <span className="truncate">{s.sourceName}</span>
                      <span className={s.error ? 'text-red-500' : 'text-muted-foreground'}>
                        {s.error ? '✗' : `${s.inserted} new`}
                      </span>
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
