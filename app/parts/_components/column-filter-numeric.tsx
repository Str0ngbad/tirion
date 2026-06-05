"use client";

import { useState } from "react";
import type { FilterObject } from "@/lib/views/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type NumericOp =
  | "num_equals"
  | "num_not_equals"
  | "greater_than"
  | "greater_than_or_eq"
  | "less_than"
  | "less_than_or_eq"
  | "between"
  | "num_is_empty"
  | "num_is_not_empty";

const NUMERIC_OPERATORS: { value: NumericOp; label: string }[] = [
  { value: "num_equals",         label: "= equals" },
  { value: "num_not_equals",     label: "≠ not equals" },
  { value: "greater_than",       label: "> greater than" },
  { value: "greater_than_or_eq", label: "≥ greater than or equal" },
  { value: "less_than",          label: "< less than" },
  { value: "less_than_or_eq",    label: "≤ less than or equal" },
  { value: "between",            label: "between" },
  { value: "num_is_empty",       label: "is empty" },
  { value: "num_is_not_empty",   label: "is not empty" },
];

type Props = {
  column: string;
  isCurrency?: boolean;
  existing: FilterObject | null;
  onApply: (filter: FilterObject) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterNumeric({
  column,
  isCurrency = false,
  existing,
  onApply,
  onRemove,
  onCancel,
}: Props) {
  const existingOp = (existing?.operator as NumericOp | undefined) ?? "num_equals";
  const existingVal = existing && "value" in existing ? existing.value : null;

  const [operator, setOperator] = useState<NumericOp>(existingOp);
  const [single, setSingle] = useState<string>(
    typeof existingVal === "number" ? String(existingVal) : ""
  );
  const [from, setFrom] = useState<string>(
    typeof existingVal === "object" && existingVal !== null && "from" in existingVal
      ? String((existingVal as { from: number }).from)
      : ""
  );
  const [to, setTo] = useState<string>(
    typeof existingVal === "object" && existingVal !== null && "to" in existingVal
      ? String((existingVal as { to: number }).to)
      : ""
  );

  const noValueNeeded = operator === "num_is_empty" || operator === "num_is_not_empty";
  const isBetween = operator === "between";

  function handleApply() {
    if (noValueNeeded) {
      onApply({ column, operator } as FilterObject);
      return;
    }
    if (isBetween) {
      const f = parseFloat(from);
      const t = parseFloat(to);
      if (isNaN(f) || isNaN(t)) return;
      onApply({ column, operator: "between", value: { from: f, to: t } });
    } else {
      const n = parseFloat(single);
      if (isNaN(n)) return;
      onApply({ column, operator, value: n } as FilterObject);
    }
  }

  const prefix = isCurrency ? <span className="text-xs text-muted-foreground">$</span> : null;

  return (
    <div className="flex flex-col gap-3 p-3 w-64">
      <Select value={operator} onValueChange={(v) => setOperator(v as NumericOp)}>
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
              placeholder="From"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">–</span>
          <div className="flex items-center gap-1 flex-1">
            {prefix}
            <Input
              type="number"
              placeholder="To"
              value={to}
              onChange={(e) => setTo(e.target.value)}
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
