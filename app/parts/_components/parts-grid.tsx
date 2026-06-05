"use client";

import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
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

type SortState = { columnId: ColumnId; direction: "asc" | "desc" } | null;

type Props = {
  rows: PartRowClient[];
  visibleColumns: string[];
  sortState: SortState;
  condensed: boolean;
  selectedPartId: number | null;
  onSelectPart: (partId: number) => void;
  // Called on column label click — toggles asc/desc for that column.
  onSortToggle: (columnId: ColumnId) => void;
  // Called from column menu for explicit direction or clear.
  onSortSet: (columnId: ColumnId, direction: "asc" | "desc") => void;
  onClearSort: () => void;
  onHideColumn: (columnId: ColumnId) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartsGrid({
  rows,
  visibleColumns,
  sortState,
  condensed,
  selectedPartId,
  onSelectPart,
  onSortToggle,
  onSortSet,
  onClearSort,
  onHideColumn,
}: Props) {
  const visibleSet = new Set(visibleColumns);
  const columns = ALL_COLUMNS.filter((c) => visibleSet.has(c.id));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const isSorted = sortState?.columnId === col.id;
              const direction = isSorted ? sortState!.direction : null;

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
                      "inline-flex items-center gap-1",
                      col.align === "right" && "flex-row-reverse w-full justify-start",
                      col.align === "center" && "justify-center w-full"
                    )}
                  >
                    <button
                      className={cn(
                        "leading-none hover:text-foreground transition-colors",
                        isSorted ? "text-foreground" : "text-muted-foreground"
                      )}
                      onClick={() => col.sortable && onSortToggle(col.id)}
                      disabled={!col.sortable}
                    >
                      {col.label}
                    </button>
                    {isSorted && direction === "asc" && (
                      <ArrowUpIcon className="h-3 w-3 shrink-0 text-primary" />
                    )}
                    {isSorted && direction === "desc" && (
                      <ArrowDownIcon className="h-3 w-3 shrink-0 text-primary" />
                    )}
                    <ColumnHeaderMenu
                      columnId={col.id}
                      label={col.label}
                      sortable={col.sortable}
                      currentSortColumn={sortState?.columnId ?? null}
                      currentSortDirection={sortState?.direction ?? null}
                      onSortAsc={() => onSortSet(col.id, "asc")}
                      onSortDesc={() => onSortSet(col.id, "desc")}
                      onClearSort={onClearSort}
                      onHideColumn={() => onHideColumn(col.id)}
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
