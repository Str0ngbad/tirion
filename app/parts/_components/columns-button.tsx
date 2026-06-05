"use client";

import { useState } from "react";
import { Columns2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ALL_COLUMNS, type ColumnId } from "@/app/parts/_lib/columns";
import type { FilterObject } from "@/lib/views/types";
import HideColumnFilterDialog from "./hide-column-filter-dialog";

type Props = {
  visibleColumns: string[];
  activeFilters: FilterObject[];
  onChange: (columnId: ColumnId, visible: boolean) => void;
};

export default function ColumnsButton({ visibleColumns, activeFilters, onChange }: Props) {
  const visibleSet = new Set(visibleColumns);
  const filterColumns = new Set(activeFilters.map((f) => f.column));

  const [pendingHide, setPendingHide] = useState<{ id: ColumnId; label: string } | null>(null);

  function handleChange(colId: ColumnId, label: string, checked: boolean) {
    if (!checked && filterColumns.has(colId)) {
      // Column being hidden has an active filter — confirm first
      setPendingHide({ id: colId, label });
    } else {
      onChange(colId, checked);
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-sm">
            <Columns2Icon className="h-3.5 w-3.5" />
            Columns
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-2">
          <div className="max-h-80 overflow-y-auto space-y-0.5">
            {ALL_COLUMNS.map((col) => {
              const checked = visibleSet.has(col.id);
              return (
                <div key={col.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                  <Checkbox
                    id={`col-${col.id}`}
                    checked={checked}
                    onCheckedChange={(val: boolean | "indeterminate") =>
                      handleChange(col.id, col.label, Boolean(val))
                    }
                  />
                  <Label
                    htmlFor={`col-${col.id}`}
                    className="cursor-pointer font-normal text-sm leading-none"
                  >
                    {col.label}
                  </Label>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {pendingHide && (
        <HideColumnFilterDialog
          open
          columnLabel={pendingHide.label}
          onConfirm={() => {
            onChange(pendingHide.id, false);
            setPendingHide(null);
          }}
          onCancel={() => setPendingHide(null)}
        />
      )}
    </>
  );
}
