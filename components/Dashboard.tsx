"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Tabs, type TabValue } from "./ui/tabs";
import { DataPreview } from "./ui/data-preview";
import { QueryDisplay } from "./ui/query-display";

// Track if component has mounted (for hydration-safe time display)
let globalMounted = false;
import { AreaChart } from "./ui/area-chart";
import { BarChart } from "./ui/bar-chart";
import { DonutChart, PieChart } from "./ui/pie-chart";
import { ScatterPlot } from "./ui/scatter-chart";
import { Scorecard } from "./ui/scorecard";
import { Loader2, AlertCircle, BarChart3, RefreshCw, X, Download, RotateCcw } from "lucide-react";
import { CHART_COLORS } from "../lib/constants";
import type { DashboardState, DashboardSlot } from "../lib/types";

function ChartSlot({ slot }: { slot: DashboardSlot }) {
  if (slot.loading) {
    return (
      <div className="h-60 flex items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading data...</span>
      </div>
    );
  }

  if (slot.error) {
    return (
      <div className="h-60 flex items-center justify-center text-red-400">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span className="text-sm">{slot.error}</span>
      </div>
    );
  }

  if (!slot.config || !slot.data.length) {
    return (
      <div className="h-60 flex items-center justify-center text-gray-300">
        <BarChart3 className="h-5 w-5 mr-2" />
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  const { config, data } = slot;
  const formatter = (v: number) => v.toLocaleString();

  switch (config.chartType) {
    case "area":
      return (
        <AreaChart
          data={data}
          index={config.indexKey}
          categories={config.categories}
          colors={CHART_COLORS}
          valueFormatter={formatter}
          showLegend={config.categories.length > 1}
          showGrid={true}
          showXAxis={true}
          showYAxis={true}
          xAxisLabel={config.xAxisLabel}
          yAxisLabel={config.yAxisLabel}
        />
      );
    case "bar":
      return (
        <BarChart
          data={data}
          index={config.indexKey}
          categories={config.categories}
          colors={CHART_COLORS}
          valueFormatter={formatter}
          showLegend={config.categories.length > 1}
          showGrid={true}
          xAxisLabel={config.xAxisLabel}
          yAxisLabel={config.yAxisLabel}
        />
      );
    case "donut":
      return (
        <DonutChart
          data={data}
          category={config.categories[0] || "value"}
          index={config.indexKey}
          colors={CHART_COLORS}
          showLegend={true}
        />
      );
    case "pie":
      return (
        <PieChart
          data={data}
          category={config.categories[0] || "value"}
          index={config.indexKey}
          colors={CHART_COLORS}
          showLegend={true}
        />
      );
    case "scatter":
      return (
        <ScatterPlot
          data={data}
          xKey={config.xKey || config.indexKey}
          yKey={config.yKey || config.categories[0] || "value"}
          colors={CHART_COLORS}
          valueFormatter={formatter}
          showGrid={true}
          showXAxis={true}
          showYAxis={true}
        />
      );
    case "scorecard":
      // For scorecard, we display the first data row's value as a metric
      const scorecardData = data[0];
      const scorecardValue = scorecardData ? Number(scorecardData[config.valueKey || config.categories[0] || "value"]) : 0;
      return (
        <Scorecard
          title={config.title}
          value={scorecardValue}
          format={config.format || "number"}
          size="lg"
          variant="gradient"
        />
      );
    default:
      return null;
  }
}

function RefreshButton({ slotId, loading, onRefresh }: { slotId: string; loading: boolean; onRefresh: (id: string) => void }) {
  return (
    <button
      onClick={() => onRefresh(slotId)}
      disabled={loading}
      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Refresh data"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}

function DownloadCSVButton({ data, title }: { data: unknown[] | undefined; title: string }) {
  const handleDownload = useCallback(() => {
    if (!data || data.length === 0) return;

    // Convert data to CSV
    const firstRow = data[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);
    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        headers
          .map((header) => {
            const value = (row as Record<string, unknown>)[header];
            const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    // Format: <title>_<epoch_timestamp>.csv
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
    link.download = `${safeTitle}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data, title]);

  const hasData = data && data.length > 0;

  return (
    <button
      onClick={handleDownload}
      disabled={!hasData}
      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      title="Download CSV"
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card Content with Tabs                                             */
/* ------------------------------------------------------------------ */

interface CardContentWithTabsProps {
  slot: DashboardSlot;
}

function CardContentWithTabs({ slot }: CardContentWithTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("chart");

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
      <div className="h-56 overflow-hidden">
        {activeTab === "chart" && <ChartSlot slot={slot} />}
        {activeTab === "data" && <DataPreview data={slot.data} />}
        {activeTab === "query" && <QueryDisplay query={slot.query} />}
      </div>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/* Dot Navigation                                                      */
/* ------------------------------------------------------------------ */

interface NavSection {
  id: string;
  label: string;
}

function DotNav({ sections }: { sections: NavSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const visibleRef = useRef(new Set<string>());
  const orderRef = useRef<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  orderRef.current = sections.map((s) => s.id);

  const sectionIds = sections.map((s) => s.id).join(",");

  useEffect(() => {
    visibleRef.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visibleRef.current.add(e.target.id);
          else visibleRef.current.delete(e.target.id);
        }
        // Highlight the first visible section in document order
        for (const id of orderRef.current) {
          if (visibleRef.current.has(id)) {
            setActiveId(id);
            return;
          }
        }
      },
      { threshold: 0.15, rootMargin: "-60px 0px -35% 0px" }
    );

    for (const id of sectionIds.split(",")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIds]);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  if (!mounted || sections.length < 3) return null;

  return (
    <nav
      aria-label="Chart navigation"
      id="chart-nav"
      className="fixed left-2.5 top-1/2 -translate-y-1/2 z-50 hidden lg:flex flex-col items-center gap-3 py-3 px-1.5 rounded-full bg-white/65 backdrop-blur-[10px] border border-black/[0.06] shadow-sm"
    >
      {sections.map((s) => {
        const active = activeId === s.id;
        const hovered = hoveredId === s.id;
        return (
          <div key={s.id} className="relative flex items-center">
            <button
              onClick={() => scrollTo(s.id)}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={`Scroll to ${s.label}`}
              className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-full p-0.5"
            >
              <span
                className={`block rounded-full transition-all duration-200 ease-out ${
                  active
                    ? "w-2.5 h-2.5 bg-blue-500"
                    : "w-[7px] h-[7px] bg-gray-300 hover:bg-gray-500 hover:scale-150"
                }`}
                style={
                  active
                    ? { boxShadow: "0 0 0 3px rgba(59,130,246,0.18), 0 0 8px rgba(59,130,246,0.22)" }
                    : undefined
                }
              />
            </button>
            {/* Tooltip */}
            <div
              className={`absolute left-7 whitespace-nowrap px-2.5 py-1 rounded-md text-[11px] font-medium bg-gray-900 text-gray-100 shadow-xl transition-all duration-150 ease-out ${
                hovered
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-2 pointer-events-none"
              }`}
            >
              {s.label}
              <span className="absolute left-0 top-1/2 -translate-x-[3px] -translate-y-1/2 w-1.5 h-1.5 bg-gray-900 rotate-45 rounded-[1px]" />
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function timeAgo(ts?: number, now?: number): string {
  if (!ts) return "";
  // Return empty string during SSR to avoid hydration mismatch
  if (!globalMounted) return "";
  const currentTime = now ?? Date.now();
  const diff = Math.floor((currentTime - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface DashboardProps {
  dashboardState: DashboardState;
  onRefresh: (slotId: string) => void;
  onDeleteUserQuery: (index: number) => void;
  onRefreshUserQuery: (index: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appendMessage?: (content: any) => void;
}

export function Dashboard({ dashboardState, onRefresh, onDeleteUserQuery, onRefreshUserQuery, appendMessage }: DashboardProps) {
  const { slots, metrics, userQueries } = dashboardState;

  // Local mounted state to avoid hydration mismatch with localStorage data
  const [mounted, setMounted] = useState(false);

  // Current time for timeAgo calculations - updated every 5 seconds
  const [now, setNow] = useState(() => Date.now());

  // Mark component as mounted to enable timeAgo calculations
  useEffect(() => {
    globalMounted = true;
    setMounted(true);
    setNow(Date.now());
  }, []);

  // Update "now" every 5 seconds to refresh timeAgo displays
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const predefinedSlots = ["slot2", "slot3", "slot4", "slot5", "slot6"] as const;

  // Build navigation sections from current state
  const sections: NavSection[] = [
    { id: "nav-metrics", label: "Metrics" },
    { id: "nav-slot1", label: slots.slot1?.config?.title || "Call Volume Trends" },
    ...predefinedSlots.map((sid) => ({
      id: `nav-${sid}`,
      label: slots[sid]?.config?.title || "Chart",
    })),
    // Only include user queries after mounting to avoid hydration mismatch
    ...(mounted ? userQueries : []).map((uq, i) => ({
      id: `nav-uq-${i}`,
      label: uq.config?.title || `Query ${i + 1}`,
    })),
  ];

  return (
    <>
      <DotNav sections={sections} />

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 w-full">
        {/* Metrics Row */}
        <div id="nav-metrics" className="col-span-1 md:col-span-2 lg:col-span-4 scroll-mt-20">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {metrics.map((m, i) => (
              <div
                key={i}
                className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm"
              >
                <p className="text-xs text-gray-500">{m.label}</p>
                <p className="text-xl font-semibold text-gray-900">
                  {m.loading ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    m.value
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Slot 1: Full-width area chart */}
        <div id="nav-slot1" className="col-span-1 md:col-span-2 lg:col-span-4 scroll-mt-20">
          <Card>
            <CardHeader className="pb-1 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-medium">
                    {slots.slot1.config?.title || "Call Volume Trends"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {slots.slot1.config?.description || "Loading..."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {slots.slot1.timestamp && (
                    <span className="text-[11px] text-gray-400">
                      Updated {timeAgo(slots.slot1.timestamp, now)}
                    </span>
                  )}
                  <DownloadCSVButton data={slots.slot1.data} title={slots.slot1.config?.title || "chart"} />
                  <RefreshButton slotId="slot1" loading={slots.slot1.loading} onRefresh={onRefresh} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3">
              <CardContentWithTabs slot={slots.slot1} />
            </CardContent>
          </Card>
        </div>

        {/* Slots 2-5: Half-width charts */}
        {predefinedSlots.map((slotId) => (
          <div key={slotId} id={`nav-${slotId}`} className="col-span-1 md:col-span-1 lg:col-span-2 scroll-mt-20">
            <Card>
              <CardHeader className="pb-1 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">
                      {slots[slotId]?.config?.title || "Loading..."}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {slots[slotId]?.config?.description || ""}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {slots[slotId]?.timestamp && (
                      <span className="text-[11px] text-gray-400">
                        Updated {timeAgo(slots[slotId].timestamp, now)}
                      </span>
                    )}
                    <DownloadCSVButton data={slots[slotId]?.data} title={slots[slotId]?.config?.title || "chart"} />
                    <RefreshButton slotId={slotId} loading={slots[slotId]?.loading} onRefresh={onRefresh} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <CardContentWithTabs slot={slots[slotId]} />
              </CardContent>
            </Card>
          </div>
        ))}

        {/* User Query Charts: Full-width, appended at bottom */}
        {/* Only render after mounting to avoid hydration mismatch */}
        {mounted && userQueries.map((uq, i) => (
          <div key={`uq-${i}`} id={`nav-uq-${i}`} className="col-span-1 md:col-span-2 lg:col-span-4 scroll-mt-20">
            <Card className="border-blue-200">
              <CardHeader className="pb-1 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <CardTitle className="text-base font-medium">
                      {uq.config?.title || "Query Results"}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {uq.timestamp && (
                      <span className="text-[11px] text-gray-400">
                        Updated {timeAgo(uq.timestamp, now)}
                      </span>
                    )}
                    <DownloadCSVButton data={uq.data} title={uq.config?.title || "query_chart"} />
                    <button
                      onClick={() => onRefreshUserQuery(i)}
                      disabled={uq.loading}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Re-run query to get fresh data"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${uq.loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      onClick={() => onDeleteUserQuery(i)}
                      className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Remove chart"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {uq.config?.description || "Results from your chat query"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3">
                <CardContentWithTabs slot={uq} />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}
