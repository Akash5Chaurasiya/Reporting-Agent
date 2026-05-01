"use client";

import { ChevronRight, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarTriggerProps {
  isOpen: boolean;
  onClick: () => void;
}

export function SidebarTrigger({ isOpen, onClick }: SidebarTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 left-6 z-50",
        "flex items-center justify-center",
        "w-12 h-12 rounded-full",
        "bg-background border border-border",
        "shadow-lg hover:shadow-xl",
        "transition-all duration-300 ease-out",
        "hover:scale-105 active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "text-foreground hover:text-primary",
        isOpen && "left-[280px]"
      )}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isOpen ? (
        <ChevronRight className="w-5 h-5" />
      ) : (
        <Menu className="w-5 h-5" />
      )}
    </button>
  );
}
