import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  Loader2,
  FileText,
  Download,
  Play,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { toast } from "sonner";
// LEGACY: Scraper removed - see _legacy_archive/scraping-v1/
// Admin panel disabled until new scraping architecture is built
/* import {
  getSources,
  toggleSource,
  triggerCoordinator,
  fetchLogs,
  type ScraperSource,
  type LogEntry,
} from "./api/scraperService"; */

// Temporary types until new scraper is built
type ScraperSource = any;
type LogEntry = any;

// Constants
const MAX_RETRY_ATTEMPTS = 3;

// Types
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

type HealthStatus = "healthy" | "warning" | "error";

// Utility functions
function isSourceEnabled(source: ScraperSource): boolean {
  return source.enabled && !source.auto_disabled;
}

function getHealthStatus(source: ScraperSource): HealthStatus {
  if (source.auto_disabled) return "error";
  if ((source.consecutive_failures ?? 0) >= MAX_RETRY_ATTEMPTS) return "error";
  if ((source.consecutive_failures ?? 0) >= 1) return "warning";
  if (source.last_success === false) return "warning";
  return "healthy";
}

function getHealthBadge(status: HealthStatus) {
  switch (status) {
    case "healthy":
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-600 border-green-500/30"
        >
          <CheckCircle2 size={12} className="mr-1" /> Healthy
        </Badge>
      );
    case "warning":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-600 border-amber-500/30"
        >
          <AlertTriangle size={12} className="mr-1" /> Warning
        </Badge>
      );
    case "error":
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-600 border-red-500/30"
        >
          <XCircle size={12} className="mr-1" /> Error
        </Badge>
      );
  }
}

function formatRelativeTime(date: string | null): string {
  if (!date) return "Never";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function Admin() {
  const navigate = useNavigate();

  // Sources state
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Logs state
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsSummary, setLogsSummary] = useState<LogsSummary | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logsMinutes, setLogsMinutes] = useState<number>(60);

  // Pipeline control state
  const [pipelineLoading, setPipelineLoading] = useState<
    Record<string, boolean>
  >({
    coordinator: false,
  });

  // Load functions
  const loadSources = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSources();
      setSources(data);
    } catch (error) {
      toast.error("Failed to load sources");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Handlers
  async function handleTriggerCoordinator() {
    setPipelineLoading((prev) => ({ ...prev, coordinator: true }));
    try {
      const result = await triggerCoordinator();
      if (result.success) {
        toast.success(`Queued ${result.jobsCreated ?? 0} scrape jobs`);
      } else {
        toast.error(result.error || "Failed to queue jobs");
      }
    } catch {
      toast.error("Failed to trigger coordinator");
    } finally {
      setPipelineLoading((prev) => ({ ...prev, coordinator: false }));
    }
  }

  async function handleToggleSource(id: string, enabled: boolean) {
    try {
      await toggleSource(id, enabled);
      setSources((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                enabled,
                auto_disabled: enabled ? false : s.auto_disabled,
              }
            : s,
        ),
      );
      toast.success(enabled ? "Source enabled" : "Source disabled");
    } catch {
      toast.error("Failed to update source");
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
        const {
          fatal = 0,
          errors = 0,
          warnings = 0,
          total = 0,
        } = result.summary || {};
        if (fatal > 0 || errors > 0) {
          toast.error(
            `Fetched ${total} entries: ${fatal} fatal, ${errors} errors, ${warnings} warnings`,
          );
        } else if (warnings > 0) {
          toast.warning(`Fetched ${total} entries: ${warnings} warnings`);
        } else {
          toast.success(
            `Fetched ${total} log entries from last ${logsMinutes} min`,
          );
        }
      } else {
        toast.error(result.error || "Failed to fetch logs");
      }
    } catch {
      toast.error("Failed to fetch logs");
    } finally {
      setLogsLoading(false);
    }
  }

  function downloadLogs() {
    if (logs.length === 0) return;
    const jsonl = logs.map((l) => JSON.stringify(l)).join("\n");
    const blob = new Blob([jsonl], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supabase-logs-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs downloaded");
  }

  // Stats
  const enabledCount = sources.filter(isSourceEnabled).length;
  const brokenCount = sources.filter(
    (s) => getHealthStatus(s) === "error",
  ).length;
  const warningCount = sources.filter(
    (s) => getHealthStatus(s) === "warning",
  ).length;

  // Filter sources by search query
  const filteredSources = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.url.toLowerCase().includes(searchQuery.toLowerCase()),
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
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/feed")}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <Settings size={20} />
                Scraper Admin
              </h1>
              <p className="text-xs text-muted-foreground">
                Pipeline monitoring & control
              </p>
            </div>
          </div>
          <Button onClick={loadSources} variant="outline" className="gap-2">
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
          <p className="text-sm text-muted-foreground">
            Trigger scraper pipeline components
          </p>
        </div>

        <div className="p-3 bg-background/80 rounded-lg border border-border max-w-md">
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
            disabled={pipelineLoading.coordinator}
            className="w-full gap-2 mt-2"
            variant="default"
          >
            {pipelineLoading.coordinator ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Queueing...
              </>
            ) : (
              <>
                <Play size={14} /> Trigger Coordinator
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Logs Section */}
      <section className="px-4 py-4 border-b border-border bg-gradient-to-r from-green-500/5 to-emerald-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={18} /> Edge Function Logs
            </h2>
            <p className="text-sm text-muted-foreground">
              Fetch and download recent Supabase edge function logs
            </p>
          </div>
          {logs.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">
                {logs.length} entries
              </Badge>
              {logsSummary?.fatal ? (
                <Badge variant="destructive" className="gap-1 bg-purple-600">
                  <XCircle size={10} /> {logsSummary.fatal} fatal
                </Badge>
              ) : null}
              {logsSummary?.errors ? (
                <Badge variant="destructive" className="gap-1">
                  <XCircle size={10} /> {logsSummary.errors} errors
                </Badge>
              ) : null}
              {logsSummary?.warnings ? (
                <Badge
                  variant="outline"
                  className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/30"
                >
                  <AlertTriangle size={10} /> {logsSummary.warnings} warnings
                </Badge>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Time range:</label>
            <select
              value={logsMinutes}
              onChange={(e) => setLogsMinutes(Number(e.target.value))}
              className="h-9 px-2 rounded-md border border-input bg-background text-sm"
            >
              <option value={15}>15 min</option>
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>
          <Button
            onClick={handleFetchLogs}
            disabled={logsLoading}
            className="gap-2"
          >
            {logsLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Fetching...
              </>
            ) : (
              <>
                <FileText size={16} /> Fetch Logs
              </>
            )}
          </Button>
          {logs.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadLogs}
                className="gap-1"
              >
                <Download size={14} /> Download JSONL
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogs(!showLogs)}
                className="gap-1"
              >
                {showLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showLogs ? "Hide" : "Show"} Logs
              </Button>
            </>
          )}
        </div>

        {logsSummary && Object.keys(logsSummary.by_source || {}).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3 text-xs">
            <span className="text-muted-foreground">By source:</span>
            {Object.entries(logsSummary.by_source).map(([source, count]) => (
              <Badge key={source} variant="secondary" className="text-[10px]">
                {source}: {count}
              </Badge>
            ))}
          </div>
        )}

        <AnimatePresence>
          {showLogs && logs.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-background border border-border rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                {logs.slice(0, 50).map((log, i) => (
                  <div
                    key={i}
                    className={`py-1 px-2 rounded ${log.level === "fatal" ? "bg-purple-500/10 text-purple-600" : log.level === "error" ? "bg-red-500/10 text-red-600" : log.level === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-muted/50"}`}
                  >
                    <span className="text-muted-foreground">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleTimeString()
                        : ""}
                    </span>
                    {log.function_name && (
                      <span className="ml-2 text-primary">
                        [{log.function_name}]
                      </span>
                    )}
                    <span className="ml-2">
                      {log.message || JSON.stringify(log).slice(0, 200)}
                    </span>
                  </div>
                ))}
                {logs.length > 50 && (
                  <p className="text-center text-muted-foreground py-2">
                    ... and {logs.length - 50} more entries. Download for full
                    logs.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {logs.length === 0 && !logsLoading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Click "Fetch Logs" to load recent edge function logs.
          </p>
        )}
      </section>

      {/* Source Stats */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Activity size={14} className="text-muted-foreground" />{" "}
              <strong>{sources.length}</strong> sources
            </span>
            <span className="text-green-600">{enabledCount} enabled</span>
            {warningCount > 0 && (
              <span className="text-amber-600">{warningCount} warning</span>
            )}
            {brokenCount > 0 && (
              <span className="text-red-600">{brokenCount} broken</span>
            )}
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
        {filteredSources.map((source) => {
          const health = getHealthStatus(source);

          return (
            <motion.div
              key={source.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{source.name}</h3>
                    {getHealthBadge(health)}
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
                  >
                    {source.url} <ExternalLink size={10} />
                  </a>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>
                      Last: {formatRelativeTime(source.last_scraped_at)}
                    </span>
                    <span>
                      Total: {source.total_events_scraped ?? 0} events
                    </span>
                    {source.consecutive_failures &&
                      source.consecutive_failures > 0 && (
                        <span className="text-red-500">
                          {source.consecutive_failures} failures
                        </span>
                      )}
                  </div>
                  {source.last_error && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {source.last_error}
                    </p>
                  )}
                </div>
                <Switch
                  checked={source.enabled && !source.auto_disabled}
                  onCheckedChange={(checked) =>
                    handleToggleSource(source.id, checked)
                  }
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
