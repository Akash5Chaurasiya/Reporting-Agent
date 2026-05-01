"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import { Dashboard } from "../components/Dashboard";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { CustomAssistantMessage } from "../components/AssistantMessage";
import { Sidebar } from "../components/sidebar";
import { prompt } from "../lib/prompt";
import { useCopilotReadable, useCopilotAction, useCopilotChat } from "@copilotkit/react-core";
import { AreaChart } from "../components/ui/area-chart";
import { BarChart } from "../components/ui/bar-chart";
import { DonutChart, PieChart } from "../components/ui/pie-chart";
import { DataCarousel } from "../components/generative-ui/DataCarousel";
import { ApprovalCard } from "../components/generative-ui/ApprovalCard";
import { createInitialDashboardState, PREDEFINED_SLOT_IDS, MAX_USER_QUERIES, saveUserQueries, saveDateRange } from "../lib/dashboard-config";
import { AGENT_URL, CHART_COLORS } from "../lib/constants";
import type { DashboardState, DashboardChartConfig, DashboardSlot, DateRangeOption } from "../lib/types";

import { Suspense, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getAuthToken, getCurrentUser } from "../lib/auth";

function AuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = () => {
      const authenticated = isAuthenticated();
      if (!authenticated) {
        router.push("/login");
      } else {
        setIsAuth(true);
      }
    };
    checkAuth();
  }, [router]);

  if (isAuth === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e1b4b]"></div>
      </div>
    );
  }

  return <>{children}</>;
}

function HomeContent() {
  // --- Dashboard state ---
  const [dashboardState, setDashboardState] = useState<DashboardState>(
    createInitialDashboardState()
  );

  // --- Date range state (synced with dashboardState) ---
  const [dateRange, setDateRange] = useState<DateRangeOption>(() =>
    createInitialDashboardState().dateRange
  );

  // --- Copilot chat for re-running queries ---
  const { appendMessage } = useCopilotChat();

  // --- Fetch function for dashboard data ---
  const fetchDashboardData = useCallback((range: DateRangeOption, isInitial: boolean = false) => {
    let cancelled = false;

    // Get auth headers for API calls
    const authToken = getAuthToken();
    const currentUser = getCurrentUser();
    const headers: Record<string, string> = {};
    if (authToken) {
      headers["x-auth-token"] = authToken;
    }
    if (currentUser?.smeId) {
      headers["x-user-id"] = currentUser.smeId;
    }

    // Update loading state
    if (!isInitial) {
      setDashboardState((prev) => ({
        ...prev,
        dateRange: range,
        slots: {
          slot1: { ...prev.slots.slot1, loading: true, error: null },
          slot2: { ...prev.slots.slot2, loading: true, error: null },
          slot3: { ...prev.slots.slot3, loading: true, error: null },
          slot4: { ...prev.slots.slot4, loading: true, error: null },
          slot5: { ...prev.slots.slot5, loading: true, error: null },
          slot6: { ...prev.slots.slot6, loading: true, error: null },
        },
        metrics: prev.metrics.map((m) => ({ ...m, loading: true, value: "--" })),
      }));
    }

    // Fetch each slot independently in parallel
    for (const slotId of PREDEFINED_SLOT_IDS) {
      fetch(`${AGENT_URL}/api/dashboard/${slotId}?date_range=${range}`, { headers })
        .then((res) => {
          if (!res.ok) throw new Error(`Backend returned ${res.status}`);
          return res.json();
        })
        .then((body) => {
          if (cancelled) return;
          setDashboardState((prev) => ({
            ...prev,
            slots: {
              ...prev.slots,
              [slotId]: {
                ...prev.slots[slotId],
                loading: false,
                error: body.error || null,
                config: body.config || prev.slots[slotId].config,
                data: body.data || [],
                query: body.query,
                timestamp: Date.now(),
              },
            },
          }));
        })
        .catch((err) => {
          if (cancelled) return;
          console.error(`Failed to load ${slotId}:`, err);
          setDashboardState((prev) => ({
            ...prev,
            slots: {
              ...prev.slots,
              [slotId]: { ...prev.slots[slotId], loading: false, error: "Failed to load data", timestamp: Date.now() },
            },
          }));
        });
    }

    // Fetch metrics
    fetch(`${AGENT_URL}/api/dashboard/metrics?date_range=${range}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`Backend returned ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        setDashboardState((prev) => ({
          ...prev,
          metrics: (body.metrics || []).map(
            (m: { label: string; value: string }) => ({
              label: m.label,
              value: m.value,
              loading: false,
            })
          ),
        }));
      })
      .catch(() => {
        if (cancelled) return;
        setDashboardState((prev) => ({
          ...prev,
          metrics: prev.metrics.map((m) => ({ ...m, loading: false, value: "Error" })),
        }));
      });

    return () => { cancelled = true; };
  }, []);

  // --- Handle date range change ---
  const handleDateRangeChange = useCallback((newRange: DateRangeOption) => {
    setDateRange(newRange);
    saveDateRange(newRange);
    fetchDashboardData(newRange, false);
  }, [fetchDashboardData]);

  // --- Initial data fetch on mount ---
  useEffect(() => {
    fetchDashboardData(dateRange, true);
  }, []); // Only run on mount

  // --- Refresh a single slot or metrics from backend ---
  const refreshSlot = useCallback(async (slotId: string) => {
    // Set loading state
    setDashboardState((prev) => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slotId]: { ...prev.slots[slotId], loading: true, error: null },
      },
    }));

    // Get auth headers
    const authToken = getAuthToken();
    const currentUser = getCurrentUser();
    const headers: Record<string, string> = {};
    if (authToken) headers["x-auth-token"] = authToken;
    if (currentUser?.smeId) headers["x-user-id"] = currentUser.smeId;

    try {
      const res = await fetch(`${AGENT_URL}/api/dashboard/${slotId}?date_range=${dateRange}`, { headers });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const body = await res.json();

      setDashboardState((prev) => ({
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: {
            ...prev.slots[slotId],
            loading: false,
            error: body.error || null,
            config: body.config || prev.slots[slotId].config,
            data: body.data || [],
            query: body.query,
            timestamp: Date.now(),
          },
        },
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refresh failed";
      setDashboardState((prev) => ({
        ...prev,
        slots: {
          ...prev.slots,
          [slotId]: { ...prev.slots[slotId], loading: false, error: msg },
        },
      }));
    }
  }, [dateRange]);

  // --- Delete a user query chart from state + localStorage ---
  const deleteUserQuery = useCallback((index: number) => {
    setDashboardState((prev) => {
      const updated = prev.userQueries.filter((_, i) => i !== index);
      saveUserQueries(updated);
      return { ...prev, userQueries: updated };
    });
  }, []);

  // --- Refresh a user query chart by re-fetching its data ---
  const userQueriesRef = useRef(dashboardState.userQueries);
  userQueriesRef.current = dashboardState.userQueries;

  const refreshUserQuery = useCallback(async (index: number) => {
    // Get fresh state from the callback parameter instead of ref to avoid stale closures
    const currentQuery = dashboardState.userQueries[index];

    // Set loading
    setDashboardState((prev) => {
      const updated = [...prev.userQueries];
      if (updated[index]) updated[index] = { ...updated[index], loading: true, error: null };
      return { ...prev, userQueries: updated };
    });

    // Try to fetch by dataId (may fail if expired)
    if (!currentQuery?.dataId) {
      console.error("No query or dataId available for refresh:", currentQuery);
      setDashboardState((prev) => {
        const updated = [...prev.userQueries];
        if (updated[index]) updated[index] = { ...updated[index], loading: false, error: "No query available" };
        return { ...prev, userQueries: updated };
      });
      return;
    }

    const dataId = currentQuery.dataId;
    console.log("Refreshing user query chart:", index, dataId);

    // Get auth headers
    const authToken = getAuthToken();
    const currentUser = getCurrentUser();
    const headers: Record<string, string> = {};
    if (authToken) headers["x-auth-token"] = authToken;
    if (currentUser?.smeId) headers["x-user-id"] = currentUser.smeId;

    try {
      const res = await fetch(`${AGENT_URL}/data/${dataId}`, { headers });
      if (!res.ok) {
        throw new Error(
          res.status === 404
            ? "Data expired \u2014 please re-run this query in chat"
            : `Backend returned ${res.status}`
        );
      }
      const body = await res.json();
      setDashboardState((prev) => {
        const updated = [...prev.userQueries];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            loading: false,
            error: null,
            data: body.data,
            query: body.query,
            timestamp: Date.now(),
          };
        }
        saveUserQueries(updated);
        return { ...prev, userQueries: updated };
      });
      console.log("Refresh successful:", index);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Refresh failed";
      console.error("Refresh failed:", msg);
      setDashboardState((prev) => {
        const updated = [...prev.userQueries];
        if (updated[index]) updated[index] = { ...updated[index], loading: false, error: msg };
        return { ...prev, userQueries: updated };
      });
    }
  }, [dashboardState.userQueries, appendMessage]);

  useCopilotReadable({
    description: "Current time",
    value: new Date().toLocaleTimeString(),
  });

  // --- Dashboard tool: update a chart slot ---
  useCopilotAction({
    name: "update_dashboard_slot",
    description:
      "Update a dashboard chart slot with query results. Use this to populate one of the 6 dashboard slots (slot1-slot5 for predefined charts, userQuery for ad-hoc user queries).",
    parameters: [
      {
        name: "slotId",
        type: "string",
        description:
          "Which slot to update: slot1, slot2, slot3, slot4, slot5, or userQuery",
        required: true,
      },
      {
        name: "dataId",
        type: "string",
        description: "The data_id from the query results",
        required: true,
      },
      {
        name: "chartType",
        type: "string",
        description: "Chart type: area, bar, pie, or donut",
        required: true,
      },
      {
        name: "title",
        type: "string",
        description: "Chart title",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "Brief chart description",
        required: false,
      },
      {
        name: "indexKey",
        type: "string",
        description: "Data key for x-axis / category labels",
        required: true,
      },
      {
        name: "categories",
        type: "string",
        description: "Comma-separated data keys to plot as series",
        required: true,
      },
      {
        name: "xAxisLabel",
        type: "string",
        description: "Label for X-axis (e.g., 'Date', 'Agent Name', 'Time')",
        required: false,
      },
      {
        name: "yAxisLabel",
        type: "string",
        description: "Label for Y-axis (e.g., 'Count', 'Duration (secs)', 'Calls')",
        required: false,
      },
      {
        name: "query",
        type: "string",
        description: "The database query that generated this chart data (for user queries only)",
        required: false,
      },
    ],
    handler: async ({
      slotId,
      dataId,
      chartType,
      title,
      description,
      indexKey,
      categories,
      xAxisLabel,
      yAxisLabel,
      query,
    }) => {
      // Get auth headers
      const authToken = getAuthToken();
      const currentUser = getCurrentUser();
      const headers: Record<string, string> = {};
      if (authToken) headers["x-auth-token"] = authToken;
      if (currentUser?.smeId) headers["x-user-id"] = currentUser.smeId;

      try {
        const res = await fetch(`${AGENT_URL}/data/${dataId}`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch data (${res.status})`);
        const body = await res.json();

        // ========== VALIDATION ==========
        // Helper function to suggest closest matching field
        const suggestClosestMatch = (input: string, options: string[]): string => {
          const lower = input.toLowerCase();
          return options.find(opt =>
            opt.toLowerCase().includes(lower) ||
            lower.includes(opt.toLowerCase())
          ) || options[0] || "N/A";
        };

        // 1. Validate slotId
        const VALID_SLOTS = ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6", "userQuery"];
        if (!VALID_SLOTS.includes(slotId as string)) {
          throw new Error(`Invalid slotId: "${slotId}". Must be one of: ${VALID_SLOTS.join(", ")}`);
        }

        // 2. Validate chartType
        const VALID_CHART_TYPES = ["area", "bar", "pie", "donut"];
        if (!VALID_CHART_TYPES.includes(chartType as string)) {
          throw new Error(`Invalid chartType: "${chartType}". Must be one of: ${VALID_CHART_TYPES.join(", ")}`);
        }

        // 3. Validate data structure and field existence
        if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
          throw new Error("No data returned from query. Cannot render chart.");
        }

        const data = body.data;
        const firstRecord = data[0];
        const availableKeys = Object.keys(firstRecord);

        // 4. Validate indexKey exists in data
        if (!availableKeys.includes(indexKey as string)) {
          const suggestion = suggestClosestMatch(indexKey as string, availableKeys);
          throw new Error(`indexKey "${indexKey}" not found in data. Available fields: ${availableKeys.join(", ")}. Did you mean: "${suggestion}"?`);
        }

        // 5. Validate all categories exist in data
        const categoryList = (categories as string)
          .split(",")
          .map((c: string) => c.trim());

        const invalidCategories = categoryList.filter(c => !availableKeys.includes(c));
        if (invalidCategories.length > 0) {
          const suggestions = categoryList.map(c =>
            availableKeys.includes(c) ? c : suggestClosestMatch(c, availableKeys)
          );
          throw new Error(`categories [${invalidCategories.join(", ")}] not found in data. Available fields: ${availableKeys.join(", ")}. Did you mean: [${suggestions.join(", ")}]?`);
        }
        // ========== END VALIDATION ==========

        const config: DashboardChartConfig = {
          chartType: chartType as DashboardChartConfig["chartType"],
          title: (title as string) || "Chart",
          description: (description as string) || "",
          indexKey: (indexKey as string) || "name",
          categories: categoryList,
          xAxisLabel: xAxisLabel as string | undefined,
          yAxisLabel: yAxisLabel as string | undefined,
        };

        const newSlot: DashboardSlot = {
          loading: false,
          error: null,
          config,
          data: body.data,
          dataId: dataId as string,
          timestamp: Date.now(),
          query: body.query || query as string,
        };

        if (slotId === "userQuery") {
          // Append to user queries array at bottom (cap at MAX_USER_QUERIES, drop oldest)
          setDashboardState((prev) => {
            const updated = [...prev.userQueries, newSlot].slice(-MAX_USER_QUERIES);
            saveUserQueries(updated);
            return { ...prev, userQueries: updated };
          });
        } else {
          // Update predefined slot
          setDashboardState((prev) => ({
            ...prev,
            slots: {
              ...prev.slots,
              [slotId as string]: newSlot,
            },
          }));
        }

        return `Dashboard slot "${slotId}" updated with ${body.record_count} records.`;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";
        if (slotId === "userQuery") {
          setDashboardState((prev) => {
            const errorSlot: DashboardSlot = { loading: false, error: errorMsg, config: null, data: [], query: query as string };
            const updated = [...prev.userQueries, errorSlot].slice(-MAX_USER_QUERIES);
            return { ...prev, userQueries: updated };
          });
        } else {
          setDashboardState((prev) => ({
            ...prev,
            slots: {
              ...prev.slots,
              [slotId as string]: {
                loading: false,
                error: errorMsg,
                config: null,
                data: [],
              },
            },
          }));
        }
        return `Error updating slot "${slotId}": ${errorMsg}`;
      }
    },
  });

  // --- Dashboard tool: update metric cards ---
  useCopilotAction({
    name: "update_dashboard_metrics",
    description:
      "Update the 6 metric cards at the top of the dashboard with real data.",
    parameters: [
      {
        name: "metrics",
        type: "string",
        description:
          'JSON array of 6 objects with {label, value}. Example: [{"label":"Total Contacts","value":"1,234"}]',
        required: true,
      },
    ],
    handler: async ({ metrics }) => {
      try {
        const parsed = JSON.parse(metrics as string);
        setDashboardState((prev) => ({
          ...prev,
          metrics: parsed.map(
            (m: { label: string; value: string }) => ({
              label: m.label,
              value: String(m.value),
              loading: false,
            })
          ),
        }));
        return "Dashboard metrics updated.";
      } catch {
        return "Failed to parse metrics JSON.";
      }
    },
  });

  // --- Inline chat chart (kept for optional use) ---
  useCopilotAction({
    name: "render_chart",
    description:
      "Render a chart visualization from query results inline in the chat. Prefer update_dashboard_slot for dashboard charts; use this only when an inline chat chart is specifically needed.",
    parameters: [
      {
        name: "chartType",
        type: "string",
        description: "The type of chart to render: 'area', 'bar', 'pie', or 'donut'",
        required: true,
      },
      {
        name: "title",
        type: "string",
        description: "The chart title",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "A brief description of what the chart shows",
        required: false,
      },
      {
        name: "data",
        type: "string",
        description:
          "JSON string of the data array. Each element is an object with keys matching indexKey and categories.",
        required: true,
      },
      {
        name: "indexKey",
        type: "string",
        description: "The key in the data objects to use as the x-axis labels or category names",
        required: true,
      },
      {
        name: "categories",
        type: "string",
        description: "Comma-separated list of data keys to plot as series.",
        required: true,
      },
    ],
    handler: async ({ chartType, title }) => {
      return `Chart "${title}" (${chartType}) rendered successfully.`;
    },
    render: ({ args, status }) => {
      const {
        chartType,
        title,
        description: desc,
        data: dataStr,
        indexKey,
        categories: categoriesStr,
      } = args;

      let chartData: Record<string, string | number>[] = [];
      try {
        if (dataStr) {
          chartData = JSON.parse(dataStr as string);
        }
      } catch {
        return (
          <div className="bg-white p-4 rounded-lg border border-red-200 shadow-sm">
            <p className="text-sm text-red-500">Failed to parse chart data</p>
          </div>
        );
      }

      const categoryList = categoriesStr
        ? (categoriesStr as string).split(",").map((c: string) => c.trim())
        : [];

      if (!chartData.length || !categoryList.length) {
        if (status === "inProgress") {
          return (
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm animate-pulse">
              <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
              <div className="h-48 bg-gray-100 rounded"></div>
            </div>
          );
        }
        return <></>;
      }

      return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm my-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">
            {(title as string) || "Chart"}
          </h3>
          {desc && (
            <p className="text-xs text-gray-500 mb-3">{desc as string}</p>
          )}
          <div className="h-64">
            {chartType === "area" && (
              <AreaChart
                data={chartData}
                index={(indexKey as string) || "name"}
                categories={categoryList}
                colors={CHART_COLORS}
                valueFormatter={(value) => `${value.toLocaleString()}`}
                showLegend={categoryList.length > 1}
                showGrid={true}
                showXAxis={true}
                showYAxis={true}
              />
            )}
            {chartType === "bar" && (
              <BarChart
                data={chartData}
                index={(indexKey as string) || "name"}
                categories={categoryList}
                colors={CHART_COLORS}
                valueFormatter={(value) => `${value.toLocaleString()}`}
                showLegend={categoryList.length > 1}
                showGrid={true}
              />
            )}
            {chartType === "pie" && (
              <PieChart
                data={chartData}
                category={categoryList[0] || "value"}
                index={(indexKey as string) || "name"}
                colors={CHART_COLORS}
                showLegend={true}
              />
            )}
            {chartType === "donut" && (
              <DonutChart
                data={chartData}
                category={categoryList[0] || "value"}
                index={(indexKey as string) || "name"}
                colors={CHART_COLORS}
                showLegend={true}
              />
            )}
          </div>
        </div>
      );
    },
  });

  // --- Display data cards in chat ---
  useCopilotAction({
    name: "display_data_cards",
    description:
      "Display database query results as a scrollable card carousel in the chat.",
    parameters: [
      {
        name: "dataId",
        type: "string",
        description: "The data_id returned from the database query result",
        required: true,
      },
      {
        name: "title",
        type: "string",
        description: "Optional title for the card carousel",
        required: false,
      },
    ],
    handler: async ({ dataId }) => {
      return `Data cards displayed for data_id=${dataId}.`;
    },
    render: ({ args, status }) => {
      if (status === "inProgress" && !args.dataId) {
        return (
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm animate-pulse my-2">
            <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
            <div className="h-24 bg-gray-100 rounded"></div>
          </div>
        );
      }
      if (!args.dataId) return <></>;
      return (
        <DataCarousel
          dataId={args.dataId as string}
          title={args.title as string}
        />
      );
    },
  });

  // --- HITL approval for database tool calls ---
  useCopilotAction({
    name: "approve_query",
    description:
      "Request user approval before executing a database query. The agent MUST call this before every user-initiated database query and wait for the user's response. Do NOT call this for startup dashboard population queries.",
    parameters: [
      {
        name: "toolName",
        type: "string",
        description: "The name of the database tool to execute",
        required: true,
      },
      {
        name: "description",
        type: "string",
        description: "A brief human-readable description of what this query will do",
        required: true,
      },
      {
        name: "parameters",
        type: "string",
        description: "JSON string of the tool parameters that will be used",
        required: true,
      },
    ],
    renderAndWaitForResponse: ({ args, respond, status, result }) => {
      return (
        <ApprovalCard
          toolName={args.toolName || ""}
          description={args.description || ""}
          parameters={args.parameters || "{}"}
          status={status}
          respond={respond}
          result={result as string}
        />
      );
    },
  });

  return (
    <>
      <Sidebar />
      <CopilotSidebar
        defaultOpen
        instructions={prompt}
        AssistantMessage={CustomAssistantMessage}
        labels={{
          title: "Azalio Assistant",
          initial:
            "Hello! I'm your Azalio call center reporting assistant. Ask me about call metrics, agent performance, customer insights, or generate reports.",
          placeholder: "Ask about calls, agents, or metrics...",
        }}
      >
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Header dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
          <main className="w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex-grow">
            <Dashboard
              dashboardState={dashboardState}
              onRefresh={refreshSlot}
              onDeleteUserQuery={deleteUserQuery}
              onRefreshUserQuery={refreshUserQuery}
              appendMessage={appendMessage}
            />
          </main>
          <Footer />
        </div>
      </CopilotSidebar>
    </>
  );
}

export default function Home() {
  return (
    <AuthCheck>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        }
      >
        <HomeContent />
      </Suspense>
    </AuthCheck>
  );
}
