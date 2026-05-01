"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { ReactNode, useEffect, useState, useCallback } from "react";
import { getAuthToken, getCurrentUser } from "@/lib/auth";

interface Props {
  children: ReactNode;
}

/**
 * CopilotKit wrapper that automatically passes authentication headers
 * to the agent backend. Reads the auth token from localStorage and
 * includes it in all requests to the Copilot Runtime.
 */
export function CopilotKitWithAuth({ children }: Props) {
  const [headers, setHeaders] = useState<Record<string, string>>({});

  const updateHeaders = useCallback(() => {
    const token = getAuthToken();
    const user = getCurrentUser();

    if (token && user?.smeId) {
      setHeaders({
        "x-auth-token": token,
        "x-user-id": user.smeId
      });
    } else if (token) {
      // Fallback: just pass token if user not available yet
      setHeaders({ "x-auth-token": token });
    } else {
      setHeaders({});
    }
  }, []);

  useEffect(() => {
    // Initial load
    updateHeaders();

    // Poll for changes (localStorage doesn't trigger re-renders)
    const interval = setInterval(updateHeaders, 2000);
    return () => clearInterval(interval);
  }, [updateHeaders]);

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="my_agent"
      showDevConsole={false}
      headers={headers}
    >
      {children}
    </CopilotKit>
  );
}
