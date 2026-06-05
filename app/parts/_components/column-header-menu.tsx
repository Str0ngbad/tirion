"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FilterObject } from "@/lib/views/types";
import type { ColumnDataType } from "@/app/parts/_lib/columns";
import ColumnFilterPopover from "./column-filter-popover";
import HideColumnFilterDialog from "./hide-column-filter-dialog";

type Props = {
  columnId: string;
  label: string;
  sortable: boolean;
  filterable: boolean;
  columnDataType: ColumnDataType;
  currentSortColumn: string | null;
  currentSortDirection: "asc" | "desc" | null;
  existingFilter: FilterObject | null;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  onHideColumn: () => void;
  onApplyFilter: (filter: FilterObject) => void;
  onRemoveFilter: () => void;
};

export default function ColumnHeaderMenu({
  columnId,
  label,
  sortable,
  filterable,
  columnDataType,
  currentSortColumn,
  currentSortDirection,
  existingFilter,
  onSortAsc,
  onSortDesc,
  onClearSort,
  onHideColumn,
  onApplyFilter,
  onRemoveFilter,
}: Props) {
  const isCurrentColumn = currentSortColumn === columnId;
  const isSortedAsc = isCurrentColumn && currentSortDirection === "asc";
  const isSortedDesc = isCurrentColumn && currentSortDirection === "desc";

  const [filterOpen, setFilterOpen] = useState(false);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);

  const hasActiveFilter = existingFilter !== null;

  function handleHideClick() {
    if (hasActiveFilter) {
      setHideDialogOpen(true);
    } else {
      onHideColumn();
    }
  }

  function handleHideConfirm() {
    setHideDialogOpen(false);
    onHideColumn();
  }

  return (
    <>
      <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded transition-opacity",
                  "opacity-40 hover:!opacity-100 focus:opacity-100 focus:outline-none",
                  isCurrentColumn && "opacity-60",
                  hasActiveFilter && "text-amber-600 dark:text-amber-400 opacity-80"
                )}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Options for ${label}`}
              >
                <ChevronDownIcon className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {sortable && (
                <>
                  <DropdownMenuItem onClick={onSortAsc} className="gap-2 text-sm">
                    <span className="w-3 text-center">{isSortedAsc ? "✓" : ""}</span>
                    Sort ascending
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onSortDesc} className="gap-2 text-sm">
                    <span className="w-3 text-center">{isSortedDesc ? "✓" : ""}</span>
                    Sort descending
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={onClearSort}
                    disabled={!isCurrentColumn}
                    className="gap-2 text-sm"
                  >
                    <span className="w-3 text-center" />
                    Clear sort
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleHideClick} className="gap-2 text-sm">
                <span className="w-3 text-center" />
                Hide column
              </DropdownMenuItem>
              {filterable && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setFilterOpen(true)}
                    className="gap-2 text-sm"
                  >
                    <span className="w-3 text-center">{hasActiveFilter ? "●" : ""}</span>
                    Filter…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
      </DropdownMenu>

      {filterable && (
        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent className="sm:max-w-sm p-0">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="text-sm font-semibold">{label}</DialogTitle>
            </DialogHeader>
            <div className="px-1 pb-1">
              <ColumnFilterPopover
                column={columnId}
                dataType={columnDataType}
                existing={existingFilter}
                onApply={(f) => { onApplyFilter(f); setFilterOpen(false); }}
                onRemove={() => { onRemoveFilter(); setFilterOpen(false); }}
                onCancel={() => setFilterOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <HideColumnFilterDialog
        open={hideDialogOpen}
        columnLabel={label}
        onConfirm={handleHideConfirm}
        onCancel={() => setHideDialogOpen(false)}
      />
    </>
  );
}
