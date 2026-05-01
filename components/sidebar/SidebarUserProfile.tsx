"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { currentUser } from "./sidebar-data";
import { getCurrentUser, logout } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";

export function SidebarUserProfile() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const current = getCurrentUser();
    setUser(current);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const displayId = user?.smeId || currentUser.email;

  return (
    <div className="flex items-center justify-center px-3 py-3 border-t border-border">
      <button
        className={cn(
          "flex items-center justify-between gap-3 w-full px-2",
          "rounded-large",
          "hover:bg-default/40",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
      >
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-full ring-2 ring-offset-2 ring-offset-background ring-default flex items-center justify-center overflow-hidden bg-white">
            <img
              src="/azalio_logo.png"
              alt=""
              className="w-6 h-6 object-contain"
            />
          </div>
          {currentUser.notificationCount && currentUser.notificationCount > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1",
                "flex items-center justify-center",
                "w-5 h-5 min-w-5 min-h-5",
                "text-[0.8rem] font-medium",
                "bg-warning/20 text-warning-700 dark:text-warning",
                "rounded-full border-2 border-background"
              )}
            >
              {currentUser.notificationCount}
            </span>
          )}
        </div>
        <div className="flex flex-col items-start min-w-0 flex-1">
          <span className="text-xs text-default-800 dark:text-default-700 truncate w-full">
            {displayId}
          </span>
          <span className="text-xs text-muted-foreground truncate w-full">
            Logged in
          </span>
        </div>
      </button>
      <button
        onClick={handleLogout}
        className={cn(
          "p-2 rounded-lg hover:bg-default/40 transition-colors",
          "text-muted-foreground hover:text-default-800"
        )}
        title="Sign out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
