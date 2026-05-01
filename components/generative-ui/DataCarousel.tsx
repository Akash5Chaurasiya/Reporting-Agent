"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Database, Loader2 } from "lucide-react";
import { AGENT_URL } from "@/lib/constants";
import { formatLabel } from "@/lib/utils";
import type { DataResponse } from "@/lib/types";

/** Format a cell value for display. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Pick an accent color by index for visual variety. */
const ACCENTS = [
  "border-blue-400",
  "border-emerald-400",
  "border-amber-400",
  "border-rose-400",
  "border-violet-400",
  "border-cyan-400",
];

interface DataCarouselProps {
  dataId: string;
  title?: string;
}

export function DataCarousel({ dataId, title }: DataCarouselProps) {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [toolName, setToolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch(`${AGENT_URL}/data/${dataId}`);
        if (!res.ok) throw new Error(`Failed to fetch data (${res.status})`);
        const body: DataResponse = await res.json();
        if (!cancelled) {
          setRecords(body.data);
          setToolName(body.tool_name);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [dataId]);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 my-2 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading records...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-4 my-2 text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (!records.length) return null;

  const fields = Object.keys(records[0]);

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Database className="h-3.5 w-3.5" />
          <span>{title || formatLabel(toolName)}</span>
          <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
            {records.length} records
          </span>
        </div>
        {records.length > 1 && (
          <div className="flex gap-1">
            <button
              onClick={() => scroll("left")}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable card row */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {records.map((record, idx) => (
          <div
            key={idx}
            className={`flex-shrink-0 w-64 bg-white rounded-lg border-l-4 border border-gray-200 ${ACCENTS[idx % ACCENTS.length]} shadow-sm`}
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="p-3 space-y-1.5">
              {fields.map((field) => (
                <div key={field}>
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                    {formatLabel(field)}
                  </div>
                  <div className="text-sm text-gray-800 truncate" title={formatValue(record[field])}>
                    {formatValue(record[field])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
