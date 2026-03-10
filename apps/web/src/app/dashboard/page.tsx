"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileSearch,
  FolderOpen,
  CalendarClock,
  TrendingUp,
  ArrowUpRight,
  ExternalLink,
  Play,
  Loader2,
  Sparkles,
  Flame,
  Eye,
  Bookmark,
  Radio,
  Globe,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Server,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  getRelevanceColor,
  getBucketLabel,
  getBucketColor,
  getWorkflowLabel,
  getWorkflowColor,
} from "@/lib/utils";
import type { DashboardStats } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crawlRunning, setCrawlRunning] = useState(false);
  const [crawlMessage, setCrawlMessage] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    fetch("/api/stats")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load dashboard stats");
        return res.json();
      })
      .then((data: DashboardStats) => {
        setStats(data);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const triggerCrawl = useCallback(async () => {
    setCrawlRunning(true);
    setCrawlMessage(null);
    try {
      const res = await fetch("/api/crawler/trigger", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setCrawlMessage(`Error: ${body.error || res.statusText}`);
      } else {
        setCrawlMessage("Crawler dispatched. Check logs to track progress.");
        setTimeout(fetchStats, 5000);
        setTimeout(fetchStats, 15000);
        setTimeout(fetchStats, 30000);
      }
    } catch {
      setCrawlMessage("Failed to connect to crawler service.");
    } finally {
      setCrawlRunning(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Overview</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Loading intelligence data...</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="h-3 w-24 animate-pulse rounded bg-muted mb-3" />
              <div className="h-7 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold tracking-tight">Overview</h1>
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => { setError(null); setLoading(true); fetchStats(); }}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const bd = stats.bucketDistribution;
  const wd: Record<string, number> = stats.workflowDistribution ?? {};
  const topSources = stats.topSources ?? [];
  const sn = stats.sourceNetwork;
  const intel = stats.intelligence;

  const METRICS = [
    { label: "Relevant Leads", value: stats.openOpportunities, icon: FolderOpen, accent: "text-emerald-600", bg: "bg-emerald-500/10", href: "/dashboard/opportunities" },
    { label: "Highly Relevant", value: stats.highRelevanceLeads, icon: TrendingUp, accent: "text-blue-600", bg: "bg-blue-500/10", href: "/dashboard/opportunities?bucket=highly_relevant" },
    { label: "New (24h)", value: stats.newLast24h, icon: Sparkles, accent: "text-violet-600", bg: "bg-violet-500/10", href: "/dashboard/opportunities?sort=newest" },
    { label: "Closing Soon", value: stats.closingThisWeek, icon: CalendarClock, accent: "text-amber-600", bg: "bg-amber-500/10", href: "/dashboard/opportunities?sort=closing_soon" },
  ];

  const pipelineStages = [
    { key: "hot", icon: Flame, label: "Hot" },
    { key: "review", icon: Eye, label: "Review" },
    { key: "shortlisted", icon: Bookmark, label: "Shortlisted" },
    { key: "pursuing", icon: TrendingUp, label: "Pursuing" },
    { key: "monitor", icon: Radio, label: "Monitor" },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sn ? `${sn.activeSources} active sources` : "Procurement intelligence"}
            {stats.totalOpportunities > 0 && ` · ${stats.totalOpportunities.toLocaleString()} total opportunities`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {crawlMessage && (
            <span className="text-2xs text-muted-foreground max-w-[200px] truncate">{crawlMessage}</span>
          )}
          <button
            onClick={triggerCrawl}
            disabled={crawlRunning}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {crawlRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run Crawler
          </button>
        </div>
      </div>

      {/* Last crawl status — compact bar */}
      {stats.lastCrawlRun && (
        <div className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
          stats.lastCrawlRun.status === "completed" ? "border-emerald-200 bg-emerald-50/50" :
          stats.lastCrawlRun.status === "failed" ? "border-red-200 bg-red-50/50" :
          stats.lastCrawlRun.status === "running" ? "border-blue-200 bg-blue-50/50" :
          "border-amber-200 bg-amber-50/50"
        }`}>
          <div className="flex items-center gap-2">
            <Activity className={`h-3.5 w-3.5 ${
              stats.lastCrawlRun.status === "completed" ? "text-emerald-600" :
              stats.lastCrawlRun.status === "failed" ? "text-red-600" :
              stats.lastCrawlRun.status === "running" ? "text-blue-600 animate-pulse" :
              "text-amber-500"
            }`} />
            <span className="font-medium capitalize">{stats.lastCrawlRun.status}</span>
            <span className="text-muted-foreground">
              {stats.lastCrawlRun.sourceName} · {stats.lastCrawlRun.opportunitiesFound} found, {stats.lastCrawlRun.opportunitiesCreated} new
            </span>
          </div>
          <Link href="/dashboard/logs" className="font-medium text-primary hover:underline">Logs</Link>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((m) => (
          <Link key={m.label} href={m.href}>
            <div className="group rounded-lg border bg-card p-4 hover:border-primary/30 transition-all cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
                <div className={`rounded-md p-1.5 ${m.bg}`}>
                  <m.icon className={`h-3.5 w-3.5 ${m.accent}`} />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-tabular">{m.value.toLocaleString()}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main content: 2-column layout */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column: Opportunities feed */}
        <div className="lg:col-span-2 space-y-5">
          {/* Top Opportunities */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Top Relevant Opportunities</CardTitle>
              <Link href="/dashboard/opportunities" className="text-2xs font-medium text-primary hover:underline flex items-center gap-0.5">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {stats.recentOpportunities.map((opp) => (
                  <Link
                    key={opp.id}
                    href={`/dashboard/opportunities/${opp.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
                  >
                    <span className={`shrink-0 inline-flex items-center justify-center rounded-md w-8 h-6 text-2xs font-bold ${getRelevanceColor(opp.relevanceScore)}`}>
                      {opp.relevanceScore}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{opp.title}</p>
                      <p className="text-2xs text-muted-foreground truncate">
                        {opp.organization || "Unknown"} · {opp.sourceName}
                        {opp.closingDate && ` · Closes ${formatDate(opp.closingDate)}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-2xs font-medium ${getBucketColor(opp.relevanceBucket)}`}>
                      {getBucketLabel(opp.relevanceBucket)}
                    </span>
                  </Link>
                ))}
                {stats.recentOpportunities.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No relevant opportunities found yet. Run the crawler to start collecting.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Relevance distribution + Top sources side-by-side */}
          <div className="grid gap-5 sm:grid-cols-2">
            {bd && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Relevance Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {(["highly_relevant", "moderately_relevant", "low_relevance", "irrelevant"] as const).map((bucket) => {
                    const count = bd[bucket];
                    const total = stats.totalOpportunities || 1;
                    const pct = Math.round((count / total) * 100);
                    const barColor =
                      bucket === "highly_relevant" ? "bg-emerald-500"
                      : bucket === "moderately_relevant" ? "bg-blue-500"
                      : bucket === "low_relevance" ? "bg-amber-400"
                      : "bg-slate-300";
                    return (
                      <div key={bucket}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs font-medium text-muted-foreground">{getBucketLabel(bucket)}</span>
                          <span className="text-xs font-bold text-tabular">{count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {topSources.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Top Sources</CardTitle>
                  <Link href="/dashboard/sources" className="text-2xs font-medium text-primary hover:underline">
                    All
                  </Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topSources.slice(0, 5).map((s) => {
                    const pct = s.total > 0 ? Math.round((s.relevant / s.total) * 100) : 0;
                    return (
                      <div key={s.name} className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs font-medium truncate flex-1">{s.name}</span>
                        <span className="text-2xs text-muted-foreground text-tabular">{s.relevant}/{s.total}</span>
                        <span className="text-2xs font-bold text-tabular w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right column: Intelligence + Pipeline + Source Health */}
        <div className="space-y-5">
          {/* AI Intelligence summary */}
          {intel && intel.analyzedCount > 0 && (
            <Card className="border-blue-200/60">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                  <CardTitle className="text-sm font-semibold">AI Intelligence</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border p-2.5 text-center">
                    <p className="text-lg font-bold text-blue-600 text-tabular">{intel.analyzedCount}</p>
                    <p className="text-2xs text-muted-foreground">Analyzed</p>
                  </div>
                  <div className="rounded-md border p-2.5 text-center">
                    <p className="text-lg font-bold text-tabular">{intel.avgFeasibility}</p>
                    <p className="text-2xs text-muted-foreground">Avg Score</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Pursue <span className="font-bold text-tabular">{intel.pursueCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Review <span className="font-bold text-tabular">{intel.reviewCount}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Skip <span className="font-bold text-tabular">{intel.skipCount}</span>
                  </span>
                </div>
                <Link href="/dashboard/intelligence" className="block text-center text-2xs font-medium text-primary hover:underline">
                  View all reports
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Pipeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {pipelineStages.map(({ key, icon: Icon, label }) => {
                const count = wd[key] ?? 0;
                return (
                  <Link
                    key={key}
                    href={`/dashboard/opportunities?workflow=${key}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className={`rounded p-1 ${getWorkflowColor(key)}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-tabular">{count}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          {/* Source health */}
          {sn && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Source Health</CardTitle>
                <Link href="/dashboard/sources" className="text-2xs font-medium text-primary hover:underline">
                  Details
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-md border p-2">
                    <p className="text-lg font-bold text-tabular">{sn.activeSources}</p>
                    <p className="text-2xs text-muted-foreground">Active</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-lg font-bold text-tabular">{sn.crawlRunsLast24h}</p>
                    <p className="text-2xs text-muted-foreground">Crawls (24h)</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["healthy", "degraded", "failing", "untested"] as const).map((h) => {
                    const count = sn.healthCounts[h] ?? 0;
                    if (count === 0) return null;
                    const icons: Record<string, typeof CheckCircle2> = {
                      healthy: CheckCircle2, degraded: AlertTriangle, failing: AlertTriangle, untested: Server,
                    };
                    const colors: Record<string, string> = {
                      healthy: "text-emerald-600", degraded: "text-amber-500", failing: "text-red-500", untested: "text-slate-400",
                    };
                    const HIcon = icons[h];
                    return (
                      <span key={h} className="inline-flex items-center gap-1 text-2xs">
                        <HIcon className={`h-3 w-3 ${colors[h]}`} />
                        <span className="capitalize">{h}</span>
                        <span className="font-bold">{count}</span>
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
