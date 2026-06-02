"use client";

import { useState, useRef, useCallback } from "react";
import type { ColumnId, ColumnMeta } from "../_lib/columns";
import { SORTABLE_COLUMNS } from "../_lib/columns";
import type { Filter } from "../_lib/filter-engine";
import { filterTooltip } from "../_lib/filter-engine";
import type { MockPart } from "../_data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { TableHead } from "@/components/ui/table";
import { ChevronDownIcon } from "lucide-react";
import ColumnFilterPopover from "./column-filter-popover";

function FilterFunnel({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

type Props = {
  meta: ColumnMeta;
  activeSortCol: ColumnId;
  sortAsc: boolean;
  activeFilter: Filter | null;
  allParts: MockPart[];
  onSort: (col: ColumnId) => void;
  onSortDir: (col: ColumnId, asc: boolean) => void;
  onClearSort: () => void;
  onHide: (col: ColumnId) => void;
  onApplyFilter: (filter: Filter) => void;
  onRemoveFilter: (col: ColumnId) => void;
};

export default function ColumnHeaderMenu({
  meta,
  activeSortCol,
  sortAsc,
  activeFilter,
  allParts,
  onSort,
  onSortDir,
  onClearSort,
  onHide,
  onApplyFilter,
  onRemoveFilter,
}: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const openFilterAfterClose = useRef(false);

  const col = meta.id;
  const sortable = SORTABLE_COLUMNS.has(col);
  const isActiveSort = activeSortCol === col;

  const tooltip = activeFilter ? filterTooltip(activeFilter) : undefined;

  function openFilterFromMenu() {
    openFilterAfterClose.current = true;
    setMenuOpen(false);
  }

  const handleMenuCloseAutoFocus = useCallback((e: Event) => {
    if (openFilterAfterClose.current) {
      openFilterAfterClose.current = false;
      e.preventDefault(); // prevent focus returning to trigger
      setFilterOpen(true);
    }
  }, []);

  const headerClass = [
    "group sticky top-0 z-10 bg-card px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none border-b border-border",
    meta.defaultWidth,
  ].join(" ");

  return (
    <TableHead
      className={headerClass}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuOpen(true);
      }}
    >
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverAnchor asChild>
          <div className="flex items-center gap-1 whitespace-nowrap">
            {/* Label — clicking sorts */}
            <span
              className={sortable ? "cursor-pointer hover:text-foreground transition-colors" : ""}
              onClick={sortable ? () => onSort(col) : undefined}
            >
              {meta.label}
            </span>

            {/* Sort indicator */}
            {isActiveSort && (
              <span className="text-muted-foreground text-[10px]">{sortAsc ? "↑" : "↓"}</span>
            )}
            {!isActiveSort && sortable && (
              <span className="text-muted-foreground/20 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                ↕
              </span>
            )}

            {/* Active filter funnel — clicking re-opens filter popover */}
            {activeFilter && (
              <button
                type="button"
                title={tooltip}
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterOpen((p) => !p);
                }}
                className="text-blue-500 hover:text-blue-400 transition-colors"
              >
                <FilterFunnel className="h-3 w-3" />
              </button>
            )}

            {/* Chevron menu trigger */}
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className={[
                    "ml-0.5 rounded p-0.5 transition-colors hover:text-foreground hover:bg-muted/60",
                    menuOpen
                      ? "opacity-100 text-foreground"
                      : "opacity-0 group-hover:opacity-100 text-muted-foreground",
                  ].join(" ")}
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44" onCloseAutoFocus={handleMenuCloseAutoFocus}>
                {sortable && (
                  <>
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={() => { onSortDir(col, true); setMenuOpen(false); }}
                    >
                      <span className="mr-auto">Sort ascending</span>
                      {isActiveSort && sortAsc && <span className="text-muted-foreground ml-2">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs"
                      onClick={() => { onSortDir(col, false); setMenuOpen(false); }}
                    >
                      <span className="mr-auto">Sort descending</span>
                      {isActiveSort && !sortAsc && <span className="text-muted-foreground ml-2">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-xs"
                      disabled={!isActiveSort}
                      onClick={() => { onClearSort(); setMenuOpen(false); }}
                    >
                      Clear sort
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem className="text-xs" onClick={openFilterFromMenu}>
                  Filter…
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs text-destructive focus:text-destructive"
                  onClick={() => { onHide(col); setMenuOpen(false); }}
                >
                  Hide column
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PopoverAnchor>

        <PopoverContent side="bottom" align="start" className="p-0 w-auto">
          <ColumnFilterPopover
            columnId={col}
            dataType={meta.dataType}
            allParts={allParts}
            existing={activeFilter}
            onApply={(f) => { onApplyFilter(f); setFilterOpen(false); }}
            onRemove={() => { onRemoveFilter(col); setFilterOpen(false); }}
            onCancel={() => setFilterOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </TableHead>
  );
}
