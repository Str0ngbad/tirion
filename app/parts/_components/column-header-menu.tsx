"use client";

import { ChevronDownIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  columnId: string;
  label: string;
  sortable: boolean;
  currentSortColumn: string | null;
  currentSortDirection: "asc" | "desc" | null;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onClearSort: () => void;
  onHideColumn: () => void;
};

export default function ColumnHeaderMenu({
  columnId,
  label,
  sortable,
  currentSortColumn,
  currentSortDirection,
  onSortAsc,
  onSortDesc,
  onClearSort,
  onHideColumn,
}: Props) {
  const isCurrentColumn = currentSortColumn === columnId;
  const isSortedAsc = isCurrentColumn && currentSortDirection === "asc";
  const isSortedDesc = isCurrentColumn && currentSortDirection === "desc";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded opacity-0 transition-opacity",
            "group-hover/header:opacity-60 hover:!opacity-100 focus:opacity-100 focus:outline-none",
            isCurrentColumn && "opacity-40"
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Options for ${label}`}
        >
          <ChevronDownIcon className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
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
        <DropdownMenuItem onClick={onHideColumn} className="gap-2 text-sm">
          <span className="w-3 text-center" />
          Hide column
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled
          className="gap-2 text-sm text-muted-foreground"
        >
          <span className="w-3 text-center" />
          Filter…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
