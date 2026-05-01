"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, FileText, MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems, chatHistory, type NavItem, type ChatHistoryItem } from "./sidebar-data";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Settings,
  FileText,
  MessageSquare,
};

function NavItemComponent({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = iconMap[item.icon] || Settings;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3",
        "h-10 px-3 mx-3 rounded-medium",
        "text-sm font-normal",
        "transition-colors duration-150",
        "hover:bg-default/40",
        isActive && "bg-default/40 text-default-700",
        !isActive && "text-default-900 dark:text-default-800"
      )}
    >
      <Icon className="w-4 h-4 min-w-4 min-h-4" />
      <span className="flex-1">{item.label}</span>
      {item.badge && (
        <span className="flex items-center justify-center min-w-5 h-5 px-1 text-xs font-medium rounded-full bg-destructive text-destructive-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function ChatHistoryItemComponent({ item }: { item: ChatHistoryItem }) {
  return (
    <button
      className={cn(
        "flex flex-col items-start gap-1",
        "w-full px-3 py-2 mx-0 rounded-medium",
        "text-sm transition-colors duration-150",
        "hover:bg-default/40 text-left",
        "text-default-900 dark:text-default-800"
      )}
    >
      <div className="flex items-center gap-2 w-full">
        <MessageSquare className="w-4 h-4 min-w-4 min-h-4 text-muted-foreground" />
        <span className="flex-1 font-medium truncate">{item.title}</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 w-full ml-6">
        <span className="text-xs text-muted-foreground truncate">{item.preview}</span>
      </div>
      <div className="flex items-center gap-2 w-full ml-6">
        <span className="text-xs text-muted-foreground">{item.timestamp}</span>
      </div>
    </button>
  );
}

export function SidebarContent() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Build New Dashboard Button */}
      <div className="px-3 py-2">
        <button
          className={cn(
            "flex items-center gap-2",
            "w-full h-10 px-3 rounded-medium",
            "text-sm font-normal",
            "bg-transparent text-default-900 dark:text-default-800",
            "hover:bg-default/40",
            "transition-colors duration-150"
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Build New Dashboard</span>
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 mt-2 overflow-y-auto">
        <h3 className="px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Chat History
        </h3>
        <div className="space-y-1 px-2">
          {chatHistory.map((item) => (
            <ChatHistoryItemComponent key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Navigation Items (Menu) */}
      <div className="mt-2 pb-2">
        <h3 className="px-6 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Menu
        </h3>
        {navItems.map((item) => (
          <NavItemComponent
            key={item.id}
            item={item}
            isActive={pathname === item.href}
          />
        ))}
      </div>
    </div>
  );
}
