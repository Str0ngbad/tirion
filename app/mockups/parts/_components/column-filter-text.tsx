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

const TEXT_OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "contains",    label: "contains" },
  { value: "equals",      label: "equals" },
  { value: "startsWith",  label: "starts with" },
  { value: "endsWith",    label: "ends with" },
  { value: "isEmpty",     label: "is empty" },
  { value: "isNotEmpty",  label: "is not empty" },
];

type Props = {
  columnId: ColumnId;
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterText({ columnId, existing, onApply, onRemove, onCancel }: Props) {
  const [operator, setOperator] = useState<FilterOperator>(
    (existing?.operator as FilterOperator) ?? "contains"
  );
  const [text, setText] = useState<string>(
    (existing?.value as { text?: string })?.text ?? ""
  );

  const noValueNeeded = operator === "isEmpty" || operator === "isNotEmpty";

  function handleApply() {
    onApply({ columnId, operator, value: noValueNeeded ? null : { text } });
  }

  return (
    <div className="flex flex-col gap-3 p-3 w-64">
      <Select value={operator} onValueChange={(v) => setOperator(v as FilterOperator)}>
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
