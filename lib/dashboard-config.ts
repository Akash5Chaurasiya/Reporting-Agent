import type { DashboardState, DashboardSlot, DateRangeOption } from "./types";

export const PREDEFINED_SLOT_IDS = ["slot1", "slot2", "slot3", "slot4", "slot5", "slot6"] as const;

export const MAX_USER_QUERIES = 20;
const USER_QUERIES_KEY = "dashboard_user_queries";
const DATE_RANGE_KEY = "dashboard_date_range";

const DEFAULT_DATE_RANGE: DateRangeOption = "7d";

/** Load saved date range from localStorage (returns default if none or invalid). */
export function loadDateRange(): DateRangeOption {
  if (typeof window === "undefined") return DEFAULT_DATE_RANGE;
  try {
    const raw = localStorage.getItem(DATE_RANGE_KEY);
    if (raw && ["1d", "7d", "14d", "30d"].includes(raw)) {
      return raw as DateRangeOption;
    }
    return DEFAULT_DATE_RANGE;
  } catch {
    return DEFAULT_DATE_RANGE;
  }
}

/** Persist date range to localStorage. */
export function saveDateRange(range: DateRangeOption): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DATE_RANGE_KEY, range);
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

const METRIC_LABELS = [
  "Total Contacts",
  "Total Calls",
  "Avg Duration",
  "Pending Followups",
  "Completed Followups",
  "Active Customers",
];

function emptySlot(loading: boolean): DashboardSlot {
  return { loading, error: null, config: null, data: [] };
}

/** Load saved user queries from localStorage (returns [] if none or invalid). */
export function loadUserQueries(): DashboardSlot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_QUERIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist user queries to localStorage. */
export function saveUserQueries(queries: DashboardSlot[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USER_QUERIES_KEY, JSON.stringify(queries));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function createInitialDashboardState(): DashboardState {
  return {
    slots: {
      slot1: emptySlot(true),
      slot2: emptySlot(true),
      slot3: emptySlot(true),
      slot4: emptySlot(true),
      slot5: emptySlot(true),
      slot6: emptySlot(true),
    },
    metrics: METRIC_LABELS.map((label) => ({ label, value: "--", loading: true })),
    userQueries: loadUserQueries(),
    dateRange: loadDateRange(),
  };
}
