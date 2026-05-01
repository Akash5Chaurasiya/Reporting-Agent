"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Database, ShieldAlert, Loader2, Pencil, Save } from "lucide-react";
import { formatLabel } from "@/lib/utils";

interface ApprovalCardProps {
  toolName: string;
  description: string;
  parameters: string;
  status: "inProgress" | "executing" | "complete";
  respond?: (result: string) => void;
  result?: string;
}

export function ApprovalCard({
  toolName,
  description,
  parameters,
  status,
  respond,
  result,
}: ApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedParams, setEditedParams] = useState<Record<string, string>>({});

  // Parse parameters for display
  let params: Record<string, unknown> = {};
  try {
    if (parameters) params = JSON.parse(parameters);
  } catch {
    // Show raw string if not valid JSON
  }

  // Initialize edited params when entering edit mode
  const startEditing = () => {
    const initial: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      initial[key] = typeof value === "string" ? value : JSON.stringify(value);
    });
    setEditedParams(initial);
    setIsEditing(true);
  };

  const handleSaveAndApprove = () => {
    if (respond) {
      // Convert edited params back to the original types
      const reconstructedParams: Record<string, unknown> = {};
      Object.entries(editedParams).forEach(([key, value]) => {
        // Try to parse as JSON if it looks like an object/array
        try {
          reconstructedParams[key] = JSON.parse(value);
        } catch {
          // Keep as string
          reconstructedParams[key] = value;
        }
      });
      respond(`approved:${JSON.stringify(reconstructedParams)}`);
    }
    setIsEditing(false);
  };

  // Check if result is approved (plain or with modified params)
  const approved = result === "approved" || (result?.startsWith("approved:") ?? false);
  const denied = result === "denied";

  // Extract modified parameters from result if present
  let modifiedParams: Record<string, unknown> | null = null;
  if (result?.startsWith("approved:")) {
    try {
      modifiedParams = JSON.parse(result.substring(9));
    } catch {
      // Invalid JSON, ignore
    }
  }

  // Use modified params for display if available (after approval)
  const displayParams = (status === "complete" && modifiedParams) ? modifiedParams : params;

  if (status === "inProgress") {
    return (
      <div className="bg-white rounded-lg border border-amber-200 p-4 my-2 flex items-center gap-2 text-sm text-amber-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing query for approval...
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border shadow-sm my-2 overflow-hidden ${
        status === "complete"
          ? approved
            ? "border-emerald-200 bg-emerald-50/50"
            : "border-red-200 bg-red-50/50"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        {status === "complete" ? (
          approved ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )
        ) : (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {status === "complete"
            ? approved
              ? "Query Approved"
              : "Query Denied"
            : "Approval Required"}
        </span>
      </div>

      {/* Tool info */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800 mb-1">
          <Database className="h-3.5 w-3.5 text-gray-400" />
          {formatLabel(toolName)}
        </div>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {/* Parameters - Edit Mode */}
      {isEditing && status === "executing" ? (
        <div className="px-4 pb-3">
          <div className="bg-blue-50 rounded-md p-3 space-y-2">
            <p className="text-xs text-blue-600 font-medium mb-1">Edit parameters:</p>
            {Object.entries(editedParams).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-gray-500 font-mono min-w-[80px] flex-shrink-0 text-xs pt-1">
                  {key}:
                </span>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setEditedParams((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Parameters - View Mode */
        <>
          {Object.keys(displayParams).length > 0 ? (
            <div className="px-4 pb-3">
              {status === "complete" && modifiedParams && (
                <p className="text-xs text-emerald-600 font-medium mb-1">Modified parameters:</p>
              )}
              <div className={`rounded-md p-2 space-y-1 ${status === "complete" && modifiedParams ? "bg-emerald-50" : "bg-gray-50"}`}>
                {Object.entries(displayParams).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 text-xs">
                    <span className="text-gray-400 font-mono min-w-[80px] flex-shrink-0">
                      {key}:
                    </span>
                    <span className="text-gray-700 break-all font-mono">
                      {typeof value === "string" ? value : JSON.stringify(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 pb-3">
              <div className="bg-yellow-50 rounded-md p-3 text-xs text-yellow-700">
                <p className="font-medium">No parameters provided</p>
                <p className="mt-1">The query details are not available. You can Approve or Deny, but editing is not available.</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      {status === "executing" && respond && (
        <div className="flex gap-2 px-4 pb-3">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveAndApprove}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Save & Approve
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-400 hover:bg-gray-500 text-white text-xs font-medium rounded-md transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => respond("approved")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-md transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </button>
              <button
                onClick={startEditing}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => respond("denied")}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-md transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Deny
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
