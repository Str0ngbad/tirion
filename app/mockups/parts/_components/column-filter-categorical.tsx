"use client";

import { useState, useMemo } from "react";
import type { Filter } from "../_lib/filter-engine";
import type { ColumnId } from "../_lib/columns";
import type { MockPart } from "../_data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function distinctValues(parts: MockPart[], col: ColumnId): string[] {
  const set = new Set<string>();
  for (const p of parts) {
    let v: string | null = null;
    switch (col) {
      case "partType":     v = p.partType; break;
      case "procurement":  v = p.procurementType; break;
      case "material":     v = p.materialSpec?.materialName ?? null; break;
      case "materialForm": v = p.materialSpec?.form ?? null; break;
      case "vendor":       v = p.defaultVendor?.vendorName ?? null; break;
    }
    if (v !== null) set.add(v);
  }
  return Array.from(set).sort();
}

type Props = {
  columnId: ColumnId;
  allParts: MockPart[];
  existing: Filter | null;
  onApply: (filter: Filter) => void;
  onRemove: () => void;
  onCancel: () => void;
};

export default function ColumnFilterCategorical({
  columnId,
  allParts,
  existing,
  onApply,
  onRemove,
  onCancel,
}: Props) {
  const existingValues = (existing?.value as { values?: string[] })?.values ?? [];
  const [checked, setChecked] = useState<Set<string>>(new Set(existingValues));
  const [search, setSearch] = useState("");

  const options = useMemo(() => distinctValues(allParts, columnId), [allParts, columnId]);
  const filtered = useMemo(
    () => options.filter((v) => v.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  function toggle(v: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  function handleApply() {
    if (checked.size === 0) {
      onRemove();
      return;
    }
    onApply({ columnId, operator: "isAnyOf", value: { values: Array.from(checked) } });
  }

  return (
    <div className="flex flex-col gap-2 p-3 w-56">
      <Input
        autoFocus
        placeholder="Search values…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-7 text-xs"
      />

      <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
        {filtered.length === 0 && (
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
          <Button size="sm" className="h-6 text-xs px-2" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
