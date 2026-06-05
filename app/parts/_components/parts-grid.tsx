"use client";

import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import type { SortSpec } from "@/lib/views/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PartRowClient } from "@/lib/api/parts";
import {
  ALL_COLUMNS,
  COLUMN_BY_ID,
  type ColumnId,
} from "@/app/parts/_lib/columns";
import ProcessTypeChip from "@/components/process-type-chip";
import type { ProcessTypeKey } from "@/lib/process-types";
import type { FilterObject } from "@/lib/views/types";
import ColumnHeaderMenu from "./column-header-menu";
import { useTruncatedTitle } from "@/lib/hooks/use-truncated-title";

// ─── Cell helpers ─────────────────────────────────────────────────────────────

const Dash = () => <span className="text-xs text-muted-foreground/40">—</span>;

function TruncatedCell({ text, className }: { text: string; className?: string }) {
  const { ref, title } = useTruncatedTitle<HTMLSpanElement>(text);
  return (
    <span ref={ref} title={title} className={cn("block truncate", className)}>
      {text}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function renderCell(
  row: PartRowClient,
  columnId: ColumnId,
  condensed: boolean
): React.ReactNode {
  switch (columnId) {
    case "partNumber":
      return (
        <span className="font-mono text-xs">
          <TruncatedCell text={row.partNumber} />
        </span>
      );
    case "partName":
      return <TruncatedCell text={row.partName} />;
    case "partType":
      return row.partType;
    case "procurementCategory":
      return row.procurementCategoryName ? (
        <TruncatedCell text={row.procurementCategoryName} />
      ) : (
        <Dash />
      );
    case "material":
      return row.materialName ? <TruncatedCell text={row.materialName} /> : <Dash />;
    case "materialForm":
      return row.materialForm ? <TruncatedCell text={row.materialForm} /> : <Dash />;
    case "vendor":
      return row.defaultVendorName ? (
        <TruncatedCell text={row.defaultVendorName} />
      ) : (
        <Dash />
      );
    case "vendorPartNumber":
      return row.vendorPartNumber ? (
        <span className="font-mono text-xs">
          <TruncatedCell text={row.vendorPartNumber} />
        </span>
      ) : (
        <Dash />
      );
    case "routing":
      if (row.processTypes.length === 0) return <Dash />;
      return (
        <div className="flex items-center gap-1 flex-nowrap">
          {row.processTypes.map((pt, i) => (
            <ProcessTypeChip
              key={i}
              processType={pt as ProcessTypeKey}
              compact={condensed}
            />
          ))}
        </div>
      );
    case "buildableCount":
      return row.buildableCount !== null ? (
        <span className="tabular-nums">{row.buildableCount}</span>
      ) : (
        <Dash />
      );
    case "stockCount":
      return row.stockCount !== null ? (
        <span className="tabular-nums">{row.stockCount}</span>
      ) : (
        <Dash />
      );
    case "inventoryLocation":
      return row.inventoryLocation ? (
        <TruncatedCell text={row.inventoryLocation} />
      ) : (
        <Dash />
      );
    case "stockSize":
      return row.stockSize ? <TruncatedCell text={row.stockSize} /> : <Dash />;
    case "blankLength":
      return row.blankLength !== null ? (
        <span className="tabular-nums">{row.blankLength}</span>
      ) : (
        <Dash />
      );
    case "partCost":
      return row.partCost !== null ? (
        <span className="font-mono text-xs tabular-nums">
          {formatCurrency(row.partCost)}
        </span>
      ) : (
        <Dash />
      );
    case "partCostUpdatedAt":
      return row.partCostUpdatedAt ? (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.partCostUpdatedAt)}
        </span>
      ) : (
        <Dash />
      );
    case "assembliesUsedInCount":
      return <span className="tabular-nums">{row.assembliesUsedInCount}</span>;
    case "machineCycleTime":
      return row.machineCycleTime !== null ? (
        <span className="tabular-nums">{row.machineCycleTime}</span>
      ) : (
        <Dash />
      );
    case "numberOfSetups":
      return row.numberOfSetups !== null ? (
        <span className="tabular-nums">{row.numberOfSetups}</span>
      ) : (
        <Dash />
      );
    case "isActive":
      return (
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            row.isActive ? "bg-emerald-500" : "bg-muted-foreground/30"
          )}
          title={row.isActive ? "Active" : "Inactive"}
        />
      );
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  rows: PartRowClient[];
  visibleColumns: string[];
  sorts: SortSpec[];
  condensed: boolean;
  selectedPartId: number | null;
  filters: FilterObject[];
  onSelectPart: (partId: number) => void;
  onSortToggle: (columnId: ColumnId, addToStack: boolean) => void;
  onSortSet: (columnId: ColumnId, direction: "asc" | "desc") => void;
  onAddToSort: (columnId: ColumnId) => void;
  onClearThisSort: (columnId: ColumnId) => void;
  onHideColumn: (columnId: ColumnId) => void;
  onApplyFilter: (filter: FilterObject) => void;
  onRemoveFilter: (column: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartsGrid({
  rows,
  visibleColumns,
  sorts,
  condensed,
  selectedPartId,
  filters,
  onSelectPart,
  onSortToggle,
  onSortSet,
  onAddToSort,
  onClearThisSort,
  onHideColumn,
  onApplyFilter,
  onRemoveFilter,
}: Props) {
  const visibleSet = new Set(visibleColumns);
  const columns = ALL_COLUMNS.filter((c) => visibleSet.has(c.id));
  const filterByColumn = new Map(filters.map((f) => [f.column, f]));
  const showPriority = sorts.length > 1;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const sortEntry = sorts.find((s) => s.column === col.id);
              const sortIndex = sortEntry ? sorts.indexOf(sortEntry) : -1;

              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    "group/header select-none whitespace-nowrap px-3 py-2 text-xs font-medium",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.defaultWidth
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      col.align === "right" && "justify-end",
                      col.align === "center" && "justify-center"
                    )}
                  >
                    <button
                      className={cn(
                        "leading-none hover:text-foreground transition-colors",
                        sortEntry ? "text-foreground" : "text-muted-foreground"
                      )}
                      onClick={(e) => col.sortable && onSortToggle(col.id, e.shiftKey)}
                      disabled={!col.sortable}
                    >
                      {col.label}
                    </button>
                    {sortEntry && (
                      <span className="inline-flex items-center gap-0.5 text-primary">
                        {sortEntry.direction === "asc"
                          ? <ArrowUpIcon className="h-3 w-3 shrink-0" />
                          : <ArrowDownIcon className="h-3 w-3 shrink-0" />}
                        {showPriority && (
                          <span className="text-[10px] font-medium leading-none tabular-nums">
                            {sortIndex + 1}
                          </span>
                        )}
                      </span>
                    )}
                    <ColumnHeaderMenu
                      columnId={col.id}
                      label={col.label}
                      sortable={col.sortable}
                      filterable={col.filterable}
                      columnDataType={col.dataType}
                      sorts={sorts}
                      existingFilter={filterByColumn.get(col.id) ?? null}
                      onSortAsc={() => onSortSet(col.id, "asc")}
                      onSortDesc={() => onSortSet(col.id, "desc")}
                      onAddToSort={() => onAddToSort(col.id)}
                      onClearThisSort={() => onClearThisSort(col.id)}
                      onHideColumn={() => onHideColumn(col.id)}
                      onApplyFilter={onApplyFilter}
                      onRemoveFilter={() => onRemoveFilter(col.id)}
                    />
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.partId}
              onClick={() => onSelectPart(row.partId)}
              className={cn(
                "cursor-pointer",
                row.partId === selectedPartId && "border-l-4 border-l-primary bg-primary/10",
                row.partType === "Assembly" && "bg-muted/30",
                !row.isActive && "opacity-40 hover:opacity-60"
              )}
            >
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    "px-3 py-1.5 text-sm",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.id === "routing" ? "whitespace-nowrap" : col.defaultWidth
                  )}
                >
                  {renderCell(row, col.id, condensed)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
