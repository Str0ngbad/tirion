"use client";

import { useState } from "react";
import type { FilterObject } from "@/lib/views/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// UI labels differ from emitted operator values for before/after
type DateUIOp = "equals" | "before" | "after" | "between" | "is_empty" | "is_not_empty";

function toFilterOp(op: DateUIOp): string {
  switch (op) {
    case "equals":      return "date_equals";
    case "before":      return "before";
    case "after":       return "after";
    case "between":     return "date_between";
    case "is_empty":    return "date_is_empty";
    case "is_not_empty": return "date_is_not_empty";
  }
}

function fromFilterOp(op: string): DateUIOp {
  switch (op) {
    case "date_equals":    return "equals";
    case "before":         return "before";
    case "after":          return "after";
    case "date_between":   return "between";
    case "date_is_empty":  return "is_empty";
    case "date_is_not_empty": return "is_not_empty";
    default:               return "after";
  }
}

type Props = {
  column: string;
  existing: FilterObject | null;
  onApply: (filter: FilterObject) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterDate({ column, existing, onApply, onRemove, onCancel }: Props) {
  const existingUIOp = existing ? fromFilterOp(existing.operator) : "after";
  const existingVal = existing && "value" in existing ? existing.value : null;

  const [op, setOp] = useState<DateUIOp>(existingUIOp);
  const [single, setSingle] = useState<string>(
    typeof existingVal === "string" ? existingVal : ""
  );
  const [from, setFrom] = useState<string>(
    typeof existingVal === "object" && existingVal !== null && "from" in existingVal
      ? String((existingVal as { from: string }).from)
      : ""
  );
  const [to, setTo] = useState<string>(
    typeof existingVal === "object" && existingVal !== null && "to" in existingVal
      ? String((existingVal as { to: string }).to)
      : ""
  );

  const noValueNeeded = op === "is_empty" || op === "is_not_empty";
  const isBetween = op === "between";

  function handleApply() {
    if (noValueNeeded) {
      onApply({ column, operator: toFilterOp(op) } as FilterObject);
      return;
    }
    if (isBetween) {
      if (!from || !to) return;
      onApply({ column, operator: "date_between", value: { from, to } });
    } else {
      if (!single) return;
      onApply({ column, operator: toFilterOp(op), value: single } as FilterObject);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 w-64">
      <Select value={op} onValueChange={(v) => setOp(v as DateUIOp)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="equals"      className="text-xs">equals</SelectItem>
          <SelectItem value="before"      className="text-xs">before</SelectItem>
          <SelectItem value="after"       className="text-xs">after</SelectItem>
          <SelectItem value="between"     className="text-xs">between</SelectItem>
          <SelectItem value="is_empty"    className="text-xs">is empty</SelectItem>
          <SelectItem value="is_not_empty" className="text-xs">is not empty</SelectItem>
        </SelectContent>
      </Select>

      {!noValueNeeded && !isBetween && (
        <input
          type="date"
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
        />
      )}

      {isBetween && (
        <div className="flex flex-col gap-1.5">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
          />
          <span className="text-center text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
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
