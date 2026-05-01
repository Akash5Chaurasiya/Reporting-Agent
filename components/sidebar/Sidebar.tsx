"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { SidebarContent } from "./SidebarContent";
import { SidebarUserProfile } from "./SidebarUserProfile";
import { SidebarTrigger } from "./SidebarTrigger";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Only render portal after mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Add data attribute to body for CSS-based navbar hiding
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute("data-sidebar-open", "true");
    } else {
      document.body.removeAttribute("data-sidebar-open");
    }
  }, [isOpen]);

  return (
    <>
      <SidebarTrigger isOpen={isOpen} onClick={() => setIsOpen(!isOpen)} />
      {isMounted &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              className={cn(
                "fixed inset-0 z-30 bg-black/20 backdrop-blur-sm",
                "transition-opacity duration-300",
                isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
              onClick={() => setIsOpen(false)}
            />
            {/* Sidebar Panel */}
            <div
              className={cn(
                "fixed top-0 left-0 bottom-0 z-40",
                "w-[280px] bg-sidebar",
                "border-r border-sidebar-border",
                "transition-transform duration-300 ease-out",
                "flex flex-col",
                isOpen ? "translate-x-0" : "-translate-x-full"
              )}
            >
              {/* Header - Logo Area */}
              <div className="h-16 flex items-center px-3 border-b border-sidebar-border">
                <a
                  href="https://www.azalio.io/"
                  className={cn(
                    "flex items-center",
                    "no-underline hover:opacity-hover",
                    "transition-opacity duration-150"
                  )}
                >
                  <span className="text-xl font-bold text-primary">Azalio</span>
                  <span className="text-xl font-light text-foreground ml-1">
                    Assistant
                  </span>
                </a>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto py-2">
                <SidebarContent />
              </div>

              {/* User Profile */}
              <SidebarUserProfile />
            </div>
          </>,
          document.body
        )}
    </>
  );
}
