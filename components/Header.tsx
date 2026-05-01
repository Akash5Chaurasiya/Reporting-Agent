"use client";

import { DateRangeSelector } from "./DateRangeSelector";
import type { DateRangeOption } from "../lib/types";

interface HeaderProps {
  dateRange: DateRangeOption;
  onDateRangeChange: (value: DateRangeOption) => void;
}

export function Header({ dateRange, onDateRangeChange }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-teal-500 bg-clip-text text-transparent"></span>
          </div>
          <div>
            <h1 className="text-2xl font-medium text-gray-900">Call Center</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time analytics & reporting powered by AI</p>
          </div>
        </div>
        <DateRangeSelector value={dateRange} onChange={onDateRangeChange} />
      </div>
    </header>
  );
} 