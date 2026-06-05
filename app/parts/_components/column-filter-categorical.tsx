"use client";

import { useState, useMemo } from "react";
import type { FilterObject } from "@/lib/views/types";
import { useDistinctValues } from "@/lib/api/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CategoricalOp = "is_any_of" | "is_none_of";

type Props = {
  column: string;
  existing: FilterObject | null;
  onApply: (filter: FilterObject) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterCategorical({ column, existing, onApply, onRemove, onCancel }: Props) {
  const existingOp = (existing?.operator as CategoricalOp | undefined) ?? "is_any_of";
  const existingValues =
    existing && "value" in existing && Array.isArray(existing.value)
      ? (existing.value as string[])
      : [];

  const [operator, setOperator] = useState<CategoricalOp>(existingOp);
  const [checked, setChecked] = useState<Set<string>>(new Set(existingValues));
  const [search, setSearch] = useState("");

  const distinctQuery = useDistinctValues(column);
  const options = distinctQuery.data?.values ?? [];
  const filtered = useMemo(
    () => options.filter((v) => v.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const allSelected = filtered.length > 0 && filtered.every((v) => checked.has(v));

  function toggle(v: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setChecked((prev) => {
        const next = new Set(prev);
        filtered.forEach((v) => next.delete(v));
        return next;
      });
    } else {
      setChecked((prev) => {
        const next = new Set(prev);
        filtered.forEach((v) => next.add(v));
        return next;
      });
    }
  }

  function handleApply() {
    if (checked.size === 0) return; // Apply disabled when zero selected
    onApply({ column, operator, value: Array.from(checked) } as FilterObject);
  }

  return (
    <div className="flex flex-col gap-2 p-3 w-56">
      <Select value={operator} onValueChange={(v) => setOperator(v as CategoricalOp)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="is_any_of"  className="text-xs">is any of</SelectItem>
          <SelectItem value="is_none_of" className="text-xs">is none of</SelectItem>
        </SelectContent>
      </Select>

      <Input
        autoFocus
        placeholder="Search values…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-7 text-xs"
      />

      {filtered.length > 0 && (
        <button
          type="button"
          onClick={toggleSelectAll}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      )}

      <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
        {distinctQuery.isLoading && (
          <p className="py-2 text-center text-xs text-muted-foreground">Loading…</p>
        )}
        {!distinctQuery.isLoading && filtered.length === 0 && (
          <p className="py-2 text-center text-xs text-muted-foreground">No values found.</p>
        )}
        {filtered.map((v) => (
          <label
            key={v}
            className="flex items-center gap-2 rounded px-1 py-1 text-xs cursor-pointer hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={checked.has(v)}
              onChange={() => toggle(v)}
              className="h-3.5 w-3.5 accent-foreground"
            />
            <span className="truncate">{v}</span>
          </label>
        ))}
      </div>

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
          <Button
            size="sm"
            className="h-6 text-xs px-2"
            onClick={handleApply}
            disabled={checked.size === 0}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
