"use client";

import { useState } from "react";
import type { Filter, FilterOperator } from "../_lib/filter-engine";
import type { ColumnId } from "../_lib/columns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Date filter maps "before"→"lt", "after"→"gt" at apply time
type DateOp = "before" | "after" | "between" | "isEmpty" | "isNotEmpty";

function toFilterOperator(op: DateOp): FilterOperator {
  switch (op) {
    case "before": return "lt";
    case "after":  return "gt";
    default:       return op;
  }
}

function fromFilterOperator(op: FilterOperator): DateOp {
  if (op === "lt") return "before";
  if (op === "gt") return "after";
  return op as DateOp;
}

type Props = {
  columnId: ColumnId;
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterDate({ columnId, existing, onApply, onRemove, onCancel }: Props) {
  const existingOp = existing ? fromFilterOperator(existing.operator as FilterOperator) : "before";
  const existingVal = existing?.value as Record<string, string> | null | undefined;

  const [op, setOp] = useState<DateOp>(existingOp);
  const [single, setSingle] = useState<string>(existingVal?.date ?? "");
  const [start, setStart] = useState<string>(existingVal?.start ?? "");
  const [end, setEnd] = useState<string>(existingVal?.end ?? "");

  const noValueNeeded = op === "isEmpty" || op === "isNotEmpty";

  function handleApply() {
    if (noValueNeeded) {
      onApply({ columnId, operator: toFilterOperator(op), value: null });
      return;
    }
    if (op === "between") {
      if (!start || !end) return;
      onApply({ columnId, operator: "between", value: { start, end } });
    } else {
      if (!single) return;
      onApply({ columnId, operator: toFilterOperator(op), value: { date: single } });
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 w-64">
      <Select value={op} onValueChange={(v) => setOp(v as DateOp)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="before"     className="text-xs">before</SelectItem>
          <SelectItem value="after"      className="text-xs">after</SelectItem>
          <SelectItem value="between"    className="text-xs">between</SelectItem>
          <SelectItem value="isEmpty"    className="text-xs">is empty</SelectItem>
          <SelectItem value="isNotEmpty" className="text-xs">is not empty</SelectItem>
        </SelectContent>
      </Select>

      {!noValueNeeded && op !== "between" && (
        <input
          type="date"
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        />
      )}

      {op === "between" && (
        <div className="flex flex-col gap-1.5">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          />
          <span className="text-center text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
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
