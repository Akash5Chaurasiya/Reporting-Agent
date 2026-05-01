"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { BarChart3, Table2, Code2 } from "lucide-react";

export type TabValue = "chart" | "data" | "query";

interface Tab {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { value: "chart", label: "Chart", icon: <BarChart3 className="h-4 w-4" /> },
  { value: "data", label: "Data", icon: <Table2 className="h-4 w-4" /> },
  { value: "query", label: "Query", icon: <Code2 className="h-4 w-4" /> },
];

interface TabsProps {
  value: TabValue;
  onValueChange: (value: TabValue) => void;
  children: React.ReactNode;
  className?: string;
}

function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <TabsList value={value} onValueChange={onValueChange} />
      <TabsContent value={value}>{children}</TabsContent>
    </div>
  );
}

interface TabsListProps {
  value: TabValue;
  onValueChange: (value: TabValue) => void;
}

function TabsList({ value, onValueChange }: TabsListProps) {
  return (
    <div
      data-slot="tabs-list"
      className="flex flex-col gap-1 rounded-lg bg-gray-100 p-1.5"
      title="Switch view"
    >
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onValueChange(tab.value)}
          title={tab.label}
          className={cn(
            "rounded-md p-2 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            value === tab.value
              ? "bg-white text-blue-600 shadow-sm"
              : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          )}
        >
          {tab.icon}
        </button>
      ))}
    </div>
  );
}

interface TabsContentProps {
  value: TabValue;
  children: React.ReactNode;
}

function TabsContent({ value, children }: TabsContentProps) {
  return <div className="flex-1 min-w-0 ring-offset-background">{children}</div>;
}

export { Tabs, TabsList, TabsContent };
