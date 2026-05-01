"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Table2 } from "lucide-react";

interface DataPreviewProps {
  data: Record<string, string | number>[] | undefined;
  className?: string;
}

export function DataPreview({ data, className }: DataPreviewProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("h-56 flex items-center justify-center text-gray-400", className)}>
        <Table2 className="h-5 w-5 mr-2" />
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  const headers = Object.keys(data[0]);

  return (
    <div className={cn("max-h-56 overflow-auto rounded-md border border-gray-200", className)}>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {headers.map((header) => (
                <td
                  key={header}
                  className="border-b border-r border-gray-200 px-3 py-2 text-gray-600"
                >
                  {row[header] !== undefined && row[header] !== null
                    ? String(row[header])
                    : ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
