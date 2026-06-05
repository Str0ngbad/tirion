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

type TextOp =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty";

const TEXT_OPERATORS: { value: TextOp; label: string }[] = [
  { value: "contains",      label: "contains" },
  { value: "not_contains",  label: "does not contain" },
  { value: "equals",        label: "equals" },
  { value: "not_equals",    label: "does not equal" },
  { value: "starts_with",   label: "starts with" },
  { value: "ends_with",     label: "ends with" },
  { value: "is_empty",      label: "is empty" },
  { value: "is_not_empty",  label: "is not empty" },
];

type Props = {
  column: string;
  existing: FilterObject | null;
  onApply: (filter: FilterObject) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterText({ column, existing, onApply, onRemove, onCancel }: Props) {
  const existingOp = (existing?.operator as TextOp | undefined) ?? "contains";
  const existingValue =
    existing && "value" in existing && typeof existing.value === "string"
      ? existing.value
      : "";

  const [operator, setOperator] = useState<TextOp>(existingOp);
  const [text, setText] = useState(existingValue);

  const noValueNeeded = operator === "is_empty" || operator === "is_not_empty";

  function handleApply() {
    if (noValueNeeded) {
      onApply({ column, operator } as FilterObject);
    } else {
      onApply({ column, operator, value: text } as FilterObject);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 w-64">
      <Select value={operator} onValueChange={(v) => setOperator(v as TextOp)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEXT_OPERATORS.map((op) => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!noValueNeeded && (
        <Input
          autoFocus
          placeholder="Value…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
          className="h-7 text-xs"
        />
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
