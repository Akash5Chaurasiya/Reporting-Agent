"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Calendar,
  Phone,
  Users,
  MessageSquare,
  PhoneCall,
  AlertCircle,
  ArrowRightLeft,
  Clock,
  ListFilter,
  PhoneOff,
  CheckCircle2,
  ChevronRight,
  Filter,
  Home,
  Settings,
} from "lucide-react";
import { Sidebar } from "../../components/sidebar";
import { cn } from "@/lib/utils";
import { AGENT_URL } from "../../lib/constants";
import { ensureAuthToken } from "@/lib/auth";

// Report data from config files
const REPORTS = {
  callReports: [
    {
      id: "calling_cdr_incoming",
      name: "Incoming Calls",
      description: "Detailed log of all incoming calls with customer and agent details",
      icon: PhoneCall,
      source: "MongoDB",
    },
    {
      id: "calling_cdr_outgoing",
      name: "Outgoing Calls",
      description: "Complete record of outbound calls initiated by agents",
      icon: Phone,
      source: "MongoDB",
    },
    {
      id: "manual_outbound_calls",
      name: "Manual Outbound Calls",
      description: "Calls made manually by agents (call_mode=3)",
      icon: Phone,
      source: "MongoDB",
    },
    {
      id: "failed_calls",
      name: "Failed Calls",
      description: "Calls that were not patched successfully",
      icon: AlertCircle,
      source: "MongoDB",
    },
    {
      id: "abandoned_calls",
      name: "Abandoned Calls",
      description: "Calls abandoned by customers before reaching an agent",
      icon: PhoneOff,
      source: "MongoDB",
    },
    {
      id: "missed_calls",
      name: "Missed Calls",
      description: "Unanswered calls including abandoned in queue, IVR, and agent",
      icon: PhoneOff,
      source: "MongoDB",
    },
  ],
  agentReports: [
    {
      id: "agent_activity",
      name: "Agent Activity Report",
      description: "Agent login times, call durations, breaks, and performance metrics",
      icon: Users,
      source: "MariaDB",
    },
    {
      id: "agent_status_report",
      name: "Agent Status Report",
      description: "Real-time agent status with login times and performance",
      icon: Users,
      source: "MariaDB",
    },
    {
      id: "agent_call_duration_summary",
      name: "Agent Call Duration Summary",
      description: "Aggregated total call duration per agent",
      icon: Clock,
      source: "MariaDB",
    },
    {
      id: "first_call_resolution",
      name: "First Call Resolution",
      description: "Calls where customer's issue was resolved on first contact",
      icon: CheckCircle2,
      source: "MongoDB",
    },
  ],
  messagingReports: [
    {
      id: "sms_report",
      name: "SMS Report",
      description: "SMS messages triggered by agents with success/failure counts",
      icon: MessageSquare,
      source: "MariaDB",
    },
    {
      id: "whatsapp_report",
      name: "WhatsApp Report",
      description: "WhatsApp messages triggered by agents with delivery status",
      icon: MessageSquare,
      source: "MariaDB",
    },
  ],
  advancedReports: [
    {
      id: "auto_call_distribution",
      name: "Auto Call Distribution",
      description: "Power, progressive, predictive, and preview dialer reports",
      icon: ListFilter,
      source: "MongoDB",
    },
    {
      id: "transfer_conference_calls",
      name: "Transfer & Conference",
      description: "Transfer and conference call details",
      icon: ArrowRightLeft,
      source: "MongoDB",
    },
    {
      id: "callback_followup",
      name: "Callback & Follow-up",
      description: "Scheduled callbacks and customer follow-ups",
      icon: Clock,
      source: "MongoDB",
    },
    {
      id: "list_wise_dialing_status",
      name: "List Dialing Status",
      description: "List-wise dialing status with file and campaign details",
      icon: ListFilter,
      source: "MongoDB",
    },
  ],
};

type DatePreset = "today" | "last7days" | "last30days" | "custom";

export default function HistoricalReportsPage() {
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("last7days");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);

  const handleDownload = async (reportId: string) => {
    setDownloadingReport(reportId);

    try {
      // Get auth token (will regenerate if missing)
      const token = ensureAuthToken();

      // Build query parameters (without SME ID for security)
      const params = new URLSearchParams({
        report_id: reportId,
        token: token || '',
        date_preset: selectedPreset,
      });

      if (selectedPreset === "custom" && customStartDate && customEndDate) {
        params.append("custom_start_date", customStartDate);
        params.append("custom_end_date", customEndDate);
      }

      // Debug: Log the query being sent
      console.log("=== REPORT QUERY DEBUG ===");
      console.log("Report ID:", reportId);
      console.log("Token sent:", token ? "yes" : "no");
      console.log("Date Preset:", selectedPreset);
      console.log("Full URL:", `${AGENT_URL}/api/reports/download?${params.toString()}`);
      console.log("==========================");

      const response = await fetch(
        `${AGENT_URL}/api/reports/download?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename=(.+)/);
      a.download = filenameMatch ? filenameMatch[1] : `${reportId}.csv`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setDownloadingReport(null);
    }
  };

  const getDateRangeLabel = () => {
    switch (selectedPreset) {
      case "today":
        return "Today";
      case "last7days":
        return "Last 7 Days";
      case "last30days":
        return "Last 30 Days";
      case "custom":
        if (customStartDate && customEndDate) {
          return `${customStartDate} - ${customEndDate}`;
        }
        return "Custom Range";
      default:
        return "Select Range";
    }
  };

  const renderReportCard = (
    report: (typeof REPORTS.callReports)[0],
    index: number
  ) => {
    const Icon = report.icon;
    const isDownloading = downloadingReport === report.id;

    return (
      <div
        key={report.id}
        className="group relative bg-card border border-border rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm tracking-tight">
                {report.name}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
                {report.description}
              </p>
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-2",
                  report.source === "MariaDB"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                )}
              >
                {report.source}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleDownload(report.id)}
            disabled={isDownloading}
            className={cn(
              "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              isDownloading
                ? "bg-primary/10 text-primary cursor-wait"
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20"
            )}
          >
            {isDownloading ? (
              <>
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const renderCategory = (
    title: string,
    description: string,
    reports: typeof REPORTS.callReports,
    icon: React.ElementType
  ) => {
    const Icon = icon;

    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reports.map((report, index) => renderReportCard(report, index))}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div>
        {/* Header with Back Navigation */}
        <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 py-5">
            <div className="flex items-center gap-4">
              {/* Back Navigation */}
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </Link>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </Link>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/25">
                <FileText className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">
                  Historical Reports
                </h1>
                <p className="text-xs text-muted-foreground">
                  Generate and download reports for analysis
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Date Range Selector */}
          <div className="bg-card border border-border rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">
                Select Time Range
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[
                { id: "today", label: "Today" },
                { id: "last7days", label: "Last 7 Days" },
                { id: "last30days", label: "Last 30 Days" },
                { id: "custom", label: "Custom Range" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id as DatePreset)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    selectedPreset === preset.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {preset.label}
                </button>
              ))}

              {selectedPreset === "custom" && (
                <div className="flex items-center gap-2 ml-auto animate-in fade-in slide-in-from-right-2 duration-200">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              )}

              <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary/5 rounded-lg border border-primary/10">
                <Filter className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  {getDateRangeLabel()}
                </span>
              </div>
            </div>

            {/* Quick Info */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  MariaDB Reports
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  MongoDB Reports
                </span>
              </div>
            </div>
          </div>

          {/* Report Categories */}
          <div className="space-y-10">
            {renderCategory(
              "Call Reports",
              "Incoming, outgoing, failed, abandoned, and missed call details",
              REPORTS.callReports,
              PhoneCall
            )}

            {renderCategory(
              "Agent Reports",
              "Agent activity, status, performance metrics, and FCR",
              REPORTS.agentReports,
              Users
            )}

            {renderCategory(
              "Messaging Reports",
              "SMS and WhatsApp message delivery status",
              REPORTS.messagingReports,
              MessageSquare
            )}

            {renderCategory(
              "Advanced Reports",
              "ACD dialing, transfers, callbacks, and list management",
              REPORTS.advancedReports,
              ListFilter
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-12 pt-6 border-t border-border">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>
                Reports are generated based on the selected date range. Backend
                integration coming soon.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
