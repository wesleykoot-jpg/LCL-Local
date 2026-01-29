import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, ChevronLeft, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";

interface SourceDailyStat {
  day: string;
  source_id: string;
  source_name: string;
  city: string | null;
  total_attempts: number;
  indexed_count: number;
  failed_count: number;
  success_rate: number | null;
  avg_description_length: number | null;
  geocode_hit_rate: number | null;
}

export default function UatQualityDashboard() {
  const navigate = useNavigate();
  const [days, setDays] = useState(14);
  const [city, setCity] = useState<string | null>(null);
  const [stats, setStats] = useState<SourceDailyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cities = useMemo(() => {
    const set = new Set(stats.map((s) => s.city).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [stats]);

  const summary = useMemo(() => {
    const totalAttempts = stats.reduce((sum, s) => sum + (s.total_attempts || 0), 0);
    const totalIndexed = stats.reduce((sum, s) => sum + (s.indexed_count || 0), 0);
    const totalFailed = stats.reduce((sum, s) => sum + (s.failed_count || 0), 0);

    const successRate = totalAttempts > 0 ? (totalIndexed / totalAttempts) * 100 : null;

    const avgDescLen = totalIndexed > 0
      ? stats.reduce((sum, s) => sum + (s.avg_description_length || 0) * (s.indexed_count || 0), 0) / totalIndexed
      : null;

    const totalGeocodeHits = totalIndexed > 0
      ? stats.reduce((sum, s) => sum + ((s.geocode_hit_rate || 0) / 100) * (s.indexed_count || 0), 0)
      : 0;

    const geocodeHitRate = totalIndexed > 0 ? (totalGeocodeHits / totalIndexed) * 100 : null;

    return {
      totalAttempts,
      totalIndexed,
      totalFailed,
      successRate,
      avgDescLen,
      geocodeHitRate,
    };
  }, [stats]);

  const loadStats = async (refresh = false) => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.functions.invoke("sg-quality-dashboard", {
      body: {
        days,
        city: city || undefined,
        refresh,
      },
    });

    if (error) {
      setError(error.message || "Failed to load dashboard");
      setLoading(false);
      return;
    }

    if (data?.error) {
      setError(data.error);
      setLoading(false);
      return;
    }

    setStats((data?.data || []) as SourceDailyStat[]);
    setLoading(false);
  };

  useEffect(() => {
    loadStats(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, city]);

  const formatPercent = (value: number | null) => (value === null ? "—" : `${value.toFixed(2)}%`);
  const formatNumber = (value: number | null) => (value === null ? "—" : value.toFixed(0));

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border pt-safe">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft size={20} />
            </Button>
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 size={18} /> UAT Quality Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Daily source metrics for SG pipeline
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => loadStats(true)}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Controls */}
        <section className="bg-card border border-border rounded-card p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {[7, 14, 30].map((d) => (
              <Button
                key={d}
                variant={days === d ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(d)}
              >
                Last {d}d
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">City</label>
            <select
              value={city ?? ""}
              onChange={(e) => setCity(e.target.value || null)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
            >
              <option value="">All</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-card border border-border rounded-card p-3">
            <p className="text-xs text-muted-foreground">Attempts</p>
            <p className="text-lg font-semibold">{summary.totalAttempts}</p>
          </div>
          <div className="bg-card border border-border rounded-card p-3">
            <p className="text-xs text-muted-foreground">Indexed</p>
            <p className="text-lg font-semibold">{summary.totalIndexed}</p>
          </div>
          <div className="bg-card border border-border rounded-card p-3">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-lg font-semibold">{summary.totalFailed}</p>
          </div>
          <div className="bg-card border border-border rounded-card p-3">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-lg font-semibold">{formatPercent(summary.successRate)}</p>
          </div>
          <div className="bg-card border border-border rounded-card p-3">
            <p className="text-xs text-muted-foreground">Avg Desc Len</p>
            <p className="text-lg font-semibold">{formatNumber(summary.avgDescLen)}</p>
          </div>
          <div className="bg-card border border-border rounded-card p-3">
            <p className="text-xs text-muted-foreground">Geocode Hit</p>
            <p className="text-lg font-semibold">{formatPercent(summary.geocodeHitRate)}</p>
          </div>
        </section>

        {/* Table */}
        <section className="bg-card border border-border rounded-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Daily Source Stats</h2>
            {loading && <Badge variant="outline">Loading…</Badge>}
          </div>

          {error && (
            <div className="p-4 text-sm text-destructive">{error}</div>
          )}

          {!error && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-4 py-2">Day</th>
                    <th className="px-4 py-2">Source</th>
                    <th className="px-4 py-2">City</th>
                    <th className="px-4 py-2">Attempts</th>
                    <th className="px-4 py-2">Indexed</th>
                    <th className="px-4 py-2">Failed</th>
                    <th className="px-4 py-2">Success</th>
                    <th className="px-4 py-2">Avg Desc</th>
                    <th className="px-4 py-2">Geocode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.length === 0 && !loading && (
                    <tr>
                      <td className="px-4 py-6 text-muted-foreground" colSpan={9}>
                        No stats available yet.
                      </td>
                    </tr>
                  )}
                  {stats.map((row) => (
                    <tr key={`${row.day}-${row.source_id}`}>
                      <td className="px-4 py-2 whitespace-nowrap">{row.day}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{row.source_name}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{row.city ?? "—"}</td>
                      <td className="px-4 py-2">{row.total_attempts}</td>
                      <td className="px-4 py-2">{row.indexed_count}</td>
                      <td className="px-4 py-2">{row.failed_count}</td>
                      <td className="px-4 py-2">{formatPercent(row.success_rate)}</td>
                      <td className="px-4 py-2">{formatNumber(row.avg_description_length)}</td>
                      <td className="px-4 py-2">{formatPercent(row.geocode_hit_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
