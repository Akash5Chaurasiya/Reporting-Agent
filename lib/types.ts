/** Data response from the /data/{id} backend endpoint. */
export interface DataResponse {
  data: Record<string, unknown>[];
  tool_name: string;
  record_count: number;
}

/** Chart configuration for a dashboard slot. */
export interface DashboardChartConfig {
  chartType: "area" | "bar" | "pie" | "donut" | "scatter" | "scorecard";
  title: string;
  description: string;
  indexKey: string;
  categories: string[];
  layout?: "horizontal";
  /** Label for X-axis (e.g., "Time", "Date", "Agent Name") */
  xAxisLabel?: string;
  /** Label for Y-axis (e.g., "Count", "Duration (secs)", "Calls") */
  yAxisLabel?: string;
  dateRange?: { from: string; to: string };
  // For scatter plots: x and y axis keys
  xKey?: string;
  yKey?: string;
  // For scorecards: value field and optional formatting
  valueKey?: string;
  format?: "number" | "currency" | "percentage" | "duration";
}

/** State for a single dashboard chart slot. */
export interface DashboardSlot {
  loading: boolean;
  error: string | null;
  config: DashboardChartConfig | null;
  data: Record<string, string | number>[];
  /** Backend data_id for re-fetching (user queries only). */
  dataId?: string;
  /** Epoch ms when data was last fetched (user queries only). */
  timestamp?: number;
  /** The MongoDB query/pipeline that generated this chart (predefined slots and user queries). */
  query?: unknown[] | string;
}

/** State for a single metric card. */
export interface MetricCard {
  label: string;
  value: string;
  loading: boolean;
}

/** Date range options for dashboard filtering */
export type DateRangeOption = "1d" | "7d" | "14d" | "30d";

/** Complete dashboard state. */
export interface DashboardState {
  slots: Record<string, DashboardSlot>;
  metrics: MetricCard[];
  userQueries: DashboardSlot[];
  dateRange: DateRangeOption;
}
