"use client";

import { XIcon } from "lucide-react";
import type { FilterObject } from "@/lib/views/types";
import { COLUMN_BY_ID, type ColumnId } from "@/app/parts/_lib/columns";
import { filterTooltip } from "@/app/parts/_lib/filter-utils";

type Props = {
  filters: FilterObject[];
  viewFilters: FilterObject[];
  onRemoveFilter: (column: string) => void;
};

function isViewFilter(filter: FilterObject, viewFilters: FilterObject[]): boolean {
  return viewFilters.some(
    (vf) => vf.column === filter.column && JSON.stringify(vf) === JSON.stringify(filter)
  );
}

export default function ActiveFiltersChrome({ filters, viewFilters, onRemoveFilter }: Props) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {filters.map((filter) => {
        const col = COLUMN_BY_ID.get(filter.column as ColumnId);
        const label = col?.label ?? filter.column;
        const tooltip = filterTooltip(filter, label);
        const isView = isViewFilter(filter, viewFilters);

        return (
          <span
            key={filter.column}
            title={tooltip}
            className={[
              "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs max-w-[160px]",
              isView
                ? "bg-muted/30 border-border text-foreground"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
            ].join(" ")}
          >
            <span className="truncate">{label}</span>
            <button
              type="button"
              aria-label={`Remove ${label} filter`}
              onClick={() => onRemoveFilter(filter.column)}
              className="shrink-0 text-current opacity-60 hover:opacity-100"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}
