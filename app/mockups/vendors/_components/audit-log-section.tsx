"use client";

import { useState } from "react";
import { MockAuditEntry } from "../_data";

type Props = {
  auditLog: MockAuditEntry[];
};

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function actionLabel(action: MockAuditEntry["action"]): string {
  switch (action) {
    case "VendorCreated":    return "Created";
    case "VendorUpdated":    return "Updated";
    case "VendorDeactivated": return "Deactivated";
    case "VendorReactivated": return "Reactivated";
  }
}

function actionColor(action: MockAuditEntry["action"]): string {
  switch (action) {
    case "VendorCreated":    return "text-green-400";
    case "VendorUpdated":    return "text-blue-400";
    case "VendorDeactivated": return "text-amber-400";
    case "VendorReactivated": return "text-green-400";
  }
}

export default function AuditLogSection({ auditLog }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...auditLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="border-t border-zinc-800 pt-4">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        <span>Audit Log ({auditLog.length})</span>
        <span className={`transition-transform inline-block ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {sorted.map((entry, i) => (
            <div key={i} className="rounded-md border border-zinc-800 bg-zinc-800/30 px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className={`text-xs font-medium ${actionColor(entry.action)}`}>
                  {actionLabel(entry.action)}
                </span>
                <span className="text-xs text-zinc-600">{formatTs(entry.timestamp)}</span>
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">{entry.userName}</div>
              {entry.changedFields && entry.changedFields.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
                  {entry.changedFields.map((cf, j) => (
                    <div key={j} className="text-xs">
                      <span className="font-medium text-zinc-500">{cf.field}:</span>{" "}
                      <span className="text-zinc-600 line-through">{cf.before ?? "—"}</span>
                      <span className="text-zinc-600"> → </span>
                      <span className="text-zinc-300">{cf.after ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
