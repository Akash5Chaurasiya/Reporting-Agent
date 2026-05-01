/** Backend agent URL — override with NEXT_PUBLIC_AGENT_URL env var. */
export const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

/** Shared chart color palette used by Dashboard and inline chat charts. */
export const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#6366f1", "#059669", "#f97316",
];
