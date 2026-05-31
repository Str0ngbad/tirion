"use client";

import { useState } from "react";
import type { Filter, RoutingFilterValue } from "../_lib/filter-engine";
import type { ColumnId } from "../_lib/columns";
import { ALL_PROCESS_TYPES, PROCESS_TYPE_META, type ProcessTypeKey } from "@/app/mockups/users/_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { Button } from "@/components/ui/button";

type RowState = "include" | "exclude" | null;

type Props = {
  columnId: ColumnId;
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterRouting({ columnId, existing, onApply, onRemove, onCancel }: Props) {
  const existingVal = existing?.value as RoutingFilterValue | undefined;

  function initRows(): Record<ProcessTypeKey, RowState> {
    const init: Partial<Record<ProcessTypeKey, RowState>> = {};
    for (const pt of ALL_PROCESS_TYPES) init[pt] = null;
    if (existingVal) {
      for (const inc of existingVal.includes) init[inc] = "include";
      for (const exc of existingVal.excludes) init[exc] = "exclude";
    }
    return init as Record<ProcessTypeKey, RowState>;
  }

  const [rows, setRows] = useState<Record<ProcessTypeKey, RowState>>(initRows);

  function toggleRow(pt: ProcessTypeKey, choice: "include" | "exclude") {
    setRows((prev) => ({
      ...prev,
      [pt]: prev[pt] === choice ? null : choice,
    }));
  }

  function clearAll() {
    const cleared: Partial<Record<ProcessTypeKey, RowState>> = {};
    for (const pt of ALL_PROCESS_TYPES) cleared[pt] = null;
    setRows(cleared as Record<ProcessTypeKey, RowState>);
  }

  function handleApply() {
    const includes: ProcessTypeKey[] = [];
    const excludes: ProcessTypeKey[] = [];
    for (const pt of ALL_PROCESS_TYPES) {
      if (rows[pt] === "include") includes.push(pt);
      if (rows[pt] === "exclude") excludes.push(pt);
    }
    if (includes.length === 0 && excludes.length === 0) {
      onRemove();
      return;
    }
    onApply({ columnId, operator: "routingIncludesAndExcludes", value: { includes, excludes } });
  }

  const anySet = ALL_PROCESS_TYPES.some((pt) => rows[pt] !== null);

  return (
    <div className="flex flex-col gap-2 p-3 w-72">
      {/* Header */}
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

      {/* Rows */}
      <div className="flex flex-col gap-0.5">
        {ALL_PROCESS_TYPES.map((pt) => {
          const state = rows[pt];
          return (
            <div key={pt} className="grid grid-cols-[auto_1fr] gap-x-2 items-center py-0.5">
              <div className="flex gap-5 pl-1">
                {/* Exclude radio */}
                <button
                  type="button"
                  aria-label={`Exclude ${PROCESS_TYPE_META[pt].label}`}
                  onClick={() => toggleRow(pt, "exclude")}
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
                    {state === "exclude" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    )}
                  </span>
                </button>

                {/* Include radio */}
                <button
                  type="button"
                  aria-label={`Include ${PROCESS_TYPE_META[pt].label}`}
                  onClick={() => toggleRow(pt, "include")}
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
                    {state === "include" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    )}
                  </span>
                </button>
              </div>

              <ProcessTypeChip processType={pt} compact={false} />
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
