"use client";

import { useState } from "react";
import type { FilterObject } from "@/lib/views/types";
import { useProcessTypes } from "@/lib/api/parts";
import ProcessTypeChip from "@/components/process-type-chip";
import type { ProcessTypeKey } from "@/lib/process-types";
import { Button } from "@/components/ui/button";

type RowState = "include" | "exclude" | null;

type Props = {
  column: string;
  existing: FilterObject | null;
  onApply: (filter: FilterObject) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterRouting({ column, existing, onApply, onRemove, onCancel }: Props) {
  const processTypesQuery = useProcessTypes();
  const processTypes = processTypesQuery.data ?? [];

  const existingValue: Record<string, "include" | "exclude"> =
    existing && "value" in existing && typeof existing.value === "object" && existing.value !== null
      ? (existing.value as Record<string, "include" | "exclude">)
      : {};

  const [rows, setRows] = useState<Record<number, RowState>>(() => {
    const init: Record<number, RowState> = {};
    for (const pt of processTypes) {
      init[pt.processTypeId] = existingValue[String(pt.processTypeId)] ?? null;
    }
    return init;
  });

  // Re-initialize when processTypes loads (rows starts empty if processTypes is async)
  const [initialized, setInitialized] = useState(false);
  if (!initialized && processTypes.length > 0) {
    const init: Record<number, RowState> = {};
    for (const pt of processTypes) {
      init[pt.processTypeId] = existingValue[String(pt.processTypeId)] ?? null;
    }
    setRows(init);
    setInitialized(true);
  }

  function toggleRow(id: number, choice: "include" | "exclude") {
    setRows((prev) => ({ ...prev, [id]: prev[id] === choice ? null : choice }));
  }

  function clearAll() {
    const cleared: Record<number, RowState> = {};
    for (const pt of processTypes) cleared[pt.processTypeId] = null;
    setRows(cleared);
  }

  function handleApply() {
    const value: Record<string, "include" | "exclude"> = {};
    for (const [id, state] of Object.entries(rows)) {
      if (state !== null) value[id] = state;
    }
    if (Object.keys(value).length === 0) {
      onRemove();
      return;
    }
    onApply({ column, operator: "routing_matrix", value });
  }

  const anySet = Object.values(rows).some((s) => s !== null);

  if (processTypesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-8 w-64 text-xs text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 w-72">
      {/* Column headers */}
      <div className="grid grid-cols-[auto_1fr] gap-x-2 items-center">
        <div className="flex gap-5 pl-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-14 text-center">
            Excl.
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-14 text-center">
            Incl.
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Process</span>
      </div>

      {/* Process type rows */}
      <div className="flex flex-col gap-0.5">
        {processTypes.map((pt) => {
          const state = rows[pt.processTypeId] ?? null;
          return (
            <div key={pt.processTypeId} className="grid grid-cols-[auto_1fr] gap-x-2 items-center py-0.5">
              <div className="flex gap-5 pl-1">
                <button
                  type="button"
                  aria-label={`Exclude ${pt.processName}`}
                  onClick={() => toggleRow(pt.processTypeId, "exclude")}
                  className={[
                    "w-14 flex justify-center items-center h-5 rounded transition-colors",
                    state === "exclude"
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                      state === "exclude" ? "border-red-500" : "border-muted-foreground",
                    ].join(" ")}
                  >
                    {state === "exclude" && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  </span>
                </button>

                <button
                  type="button"
                  aria-label={`Include ${pt.processName}`}
                  onClick={() => toggleRow(pt.processTypeId, "include")}
                  className={[
                    "w-14 flex justify-center items-center h-5 rounded transition-colors",
                    state === "include"
                      ? "bg-green-500/15 text-green-600 dark:text-green-400"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center",
                      state === "include" ? "border-green-500" : "border-muted-foreground",
                    ].join(" ")}
                  >
                    {state === "include" && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                  </span>
                </button>
              </div>

              <ProcessTypeChip processType={pt.processName as ProcessTypeKey} compact={false} />
            </div>
          );
        })}
      </div>

      {anySet && (
        <button
          type="button"
          onClick={clearAll}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear all
        </button>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        {existing ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-destructive underline-offset-2 hover:underline"
          >
            Remove filter
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" className="h-6 text-xs px-2" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
