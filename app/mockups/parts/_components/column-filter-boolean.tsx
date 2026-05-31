"use client";

import { useState } from "react";
import type { Filter, FilterOperator } from "../_lib/filter-engine";
import type { ColumnId } from "../_lib/columns";
import { Button } from "@/components/ui/button";

type BoolChoice = "isTrue" | "isFalse" | "both";

type Props = {
  columnId: ColumnId;
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterBoolean({ columnId, existing, onApply, onRemove, onCancel }: Props) {
  const existingOp = existing?.operator as FilterOperator | undefined;
  const [choice, setChoice] = useState<BoolChoice>(
    existingOp === "isTrue" ? "isTrue" : existingOp === "isFalse" ? "isFalse" : "both"
  );

  function handleApply() {
    if (choice === "both") {
      onRemove();
      return;
    }
    onApply({ columnId, operator: choice, value: null });
  }

  return (
    <div className="flex flex-col gap-3 p-3 w-44">
      {(["isTrue", "isFalse", "both"] as BoolChoice[]).map((v) => (
        <label key={v} className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="radio"
            name="bool-filter"
            value={v}
            checked={choice === v}
            onChange={() => setChoice(v)}
            className="accent-foreground"
          />
          {v === "isTrue" ? "Active only" : v === "isFalse" ? "Inactive only" : "Both"}
        </label>
      ))}

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
