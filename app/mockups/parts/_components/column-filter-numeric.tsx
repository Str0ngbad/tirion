"use client";

import { useState } from "react";
import type { Filter, FilterOperator } from "../_lib/filter-engine";
import type { ColumnId } from "../_lib/columns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NUMERIC_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "eq",          label: "= equals" },
  { value: "neq",         label: "≠ not equals" },
  { value: "gt",          label: "> greater than" },
  { value: "lt",          label: "< less than" },
  { value: "between",     label: "between" },
  { value: "isEmpty",     label: "is empty" },
  { value: "isNotEmpty",  label: "is not empty" },
];

type Props = {
  columnId: ColumnId;
  isCurrency?: boolean;
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterNumeric({
  columnId,
  isCurrency = false,
  existing,
  onApply,
  onRemove,
  onCancel,
}: Props) {
  const existingOp = (existing?.operator as FilterOperator) ?? "gt";
  const existingVal = existing?.value as Record<string, number> | null | undefined;

  const [operator, setOperator] = useState<FilterOperator>(existingOp);
  const [single, setSingle] = useState<string>(
    existingVal?.value !== undefined ? String(existingVal.value) : ""
  );
  const [min, setMin] = useState<string>(
    existingVal?.min !== undefined ? String(existingVal.min) : ""
  );
  const [max, setMax] = useState<string>(
    existingVal?.max !== undefined ? String(existingVal.max) : ""
  );

  const noValueNeeded = operator === "isEmpty" || operator === "isNotEmpty";
  const isBetween = operator === "between";

  function handleApply() {
    if (noValueNeeded) {
      onApply({ columnId, operator, value: null });
      return;
    }
    if (isBetween) {
      const mn = parseFloat(min);
      const mx = parseFloat(max);
      if (isNaN(mn) || isNaN(mx)) return;
      onApply({ columnId, operator, value: { min: mn, max: mx } });
    } else {
      const n = parseFloat(single);
      if (isNaN(n)) return;
      onApply({ columnId, operator, value: { value: n } });
    }
  }

  const prefix = isCurrency ? <span className="text-xs text-muted-foreground">$</span> : null;

  return (
    <div className="flex flex-col gap-3 p-3 w-64">
      <Select value={operator} onValueChange={(v) => setOperator(v as FilterOperator)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NUMERIC_OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!noValueNeeded && !isBetween && (
        <div className="flex items-center gap-1.5">
          {prefix}
          <Input
            autoFocus
            type="number"
            placeholder="Value…"
            value={single}
            onChange={(e) => setSingle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
            className="h-7 text-xs flex-1"
          />
        </div>
      )}

      {isBetween && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1">
            {prefix}
            <Input
              autoFocus
              type="number"
              placeholder="Min"
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">–</span>
          <div className="flex items-center gap-1 flex-1">
            {prefix}
            <Input
              type="number"
              placeholder="Max"
              value={max}
              onChange={(e) => setMax(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
              className="h-7 text-xs"
            />
          </div>
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
