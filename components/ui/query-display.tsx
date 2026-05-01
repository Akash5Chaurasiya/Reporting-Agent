"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Code2, Copy, Check } from "lucide-react";

interface QueryDisplayProps {
  query: unknown[] | string | undefined;
  className?: string;
}

export function QueryDisplay({ query, className }: QueryDisplayProps) {
  const [copied, setCopied] = React.useState(false);

  if (!query) {
    return (
      <div className={cn("h-60 flex items-center justify-center text-gray-400", className)}>
        <Code2 className="h-5 w-5 mr-2" />
        <span className="text-sm">No query available</span>
      </div>
    );
  }

  // Format the query as pretty JSON if it's JSON
  let formattedQuery: string;
  if (typeof query === "string") {
    // Try to parse as JSON and format prettily, otherwise use as-is
    try {
      const parsed = JSON.parse(query);
      formattedQuery = JSON.stringify(parsed, null, 2);
    } catch {
      formattedQuery = query;
    }
  } else {
    formattedQuery = JSON.stringify(query, null, 2);
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formattedQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("relative w-full rounded-md border border-gray-200 bg-gray-50 overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-medium text-gray-600">Query</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          title="Copy query"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-auto p-3 text-xs text-gray-700 font-mono max-h-56">
        <code>{formattedQuery}</code>
      </pre>
    </div>
  );
}
