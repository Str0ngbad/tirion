"use client";

import { useState } from "react";
import { MockPartAuditEntry } from "../_data";

type Props = {
  auditLog: MockPartAuditEntry[];
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

function actionLabel(action: MockPartAuditEntry["action"]): string {
  switch (action) {
    case "PartCreated":        return "Created";
    case "PartUpdated":        return "Updated";
    case "PartDeactivated":    return "Deactivated";
    case "PartReactivated":    return "Reactivated";
    case "BomChildAdded":      return "BOM Child Added";
    case "BomChildRemoved":    return "BOM Child Removed";
    case "BomChildQtyChanged": return "BOM Qty Changed";
  }
}

function actionColor(action: MockPartAuditEntry["action"]): string {
  switch (action) {
    case "PartCreated":        return "text-green-400";
    case "PartUpdated":        return "text-blue-400";
    case "PartDeactivated":    return "text-amber-400";
    case "PartReactivated":    return "text-green-400";
    case "BomChildAdded":      return "text-green-400";
    case "BomChildRemoved":    return "text-red-400";
    case "BomChildQtyChanged": return "text-blue-400";
  }
}

export default function PartAuditLogSection({ auditLog }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sorted = [...auditLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="border-t border-border pt-4">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Audit Log ({auditLog.length})</span>
        <span className={`inline-block transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {sorted.map((entry, i) => (
            <div key={i} className="rounded-md border border-border bg-card/30 px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className={`text-xs font-medium ${actionColor(entry.action)}`}>
                  {actionLabel(entry.action)}
                </span>
                <span className="text-xs text-muted-foreground">{formatTs(entry.timestamp)}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{entry.userName}</div>
              {entry.changedFields && entry.changedFields.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {entry.changedFields.map((cf, j) => (
                    <div key={j} className="text-xs">
                      <span className="font-medium text-muted-foreground">{cf.field}:</span>{" "}
                      <span className="text-muted-foreground/70 line-through">{cf.before ?? "—"}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="text-foreground">{cf.after ?? "—"}</span>
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
