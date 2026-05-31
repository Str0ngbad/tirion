"use client";

import { useState, useRef, useEffect } from "react";
import type { MockPart } from "../_data";
import {
  type ColumnId,
  COLUMN_BY_ID,
  RIGHT_ALIGNED_COLUMNS,
  CENTER_COLUMNS,
} from "../_lib/columns";
import type { Filter } from "../_lib/filter-engine";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ColumnHeaderMenu from "./column-header-menu";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Dash() {
  return <span className="text-xs text-muted-foreground/40">—</span>;
}

function TruncatedCell({ text, className }: { text: string; className?: string }) {
  const { ref, title } = useTruncatedTitle<HTMLSpanElement>(text);
  return (
    <span ref={ref} title={title} className={`block truncate ${className ?? ""}`}>
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

// ─── Inline edit cell ─────────────────────────────────────────────────────────

type InlineEditCellProps = {
  value: string;
  inputType?: "text" | "number";
  align?: "left" | "right";
  onCommit: (value: string) => void;
  onClick: (e: React.MouseEvent) => void;
};

function InlineEditCell({ value, inputType = "text", align = "left", onCommit, onClick }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick(e);
    setDraft(value);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setEditing(false); setDraft(value); }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`h-7 w-full text-xs px-2 ${align === "right" ? "text-right" : ""}`}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`block cursor-text rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted/50 ${align === "right" ? "text-right" : ""}`}
      title="Click to edit"
    >
      {value !== "" ? value : <span className="text-muted-foreground/40 italic">—</span>}
    </span>
  );
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

type CellProps = {
  condensed: boolean;
  onUpdateStock: (partId: number, stockCount: number) => void;
  onUpdateLocation: (partId: number, inventoryLocation: string) => void;
};

function renderCell(col: ColumnId, part: MockPart, cp: CellProps): React.ReactNode {
  switch (col) {
    case "partNumber":
      return (
        <TruncatedCell
          text={part.partNumber}
          className="max-w-[160px] font-mono text-sm font-medium text-foreground"
        />
      );
    case "partName":
      return (
        <TruncatedCell
          text={part.partName}
          className="max-w-[280px] font-medium text-foreground"
        />
      );
    case "partType":
      return (
        <Badge variant={part.partType === "Assembly" ? "secondary" : "outline"} className="text-xs">
          {part.partType}
        </Badge>
      );
    case "procurement":
      return <span className="text-sm text-muted-foreground">{part.procurementType}</span>;
    case "material":
      return part.materialSpec ? (
        <TruncatedCell text={part.materialSpec.materialName} className="max-w-[180px] text-sm text-foreground" />
      ) : (
        <Dash />
      );
    case "materialForm":
      return part.materialSpec?.form ? (
        <span className="text-sm text-foreground">{part.materialSpec.form}</span>
      ) : (
        <Dash />
      );
    case "vendor":
      return part.defaultVendor ? (
        <TruncatedCell text={part.defaultVendor.vendorName} className="max-w-[180px] text-sm text-foreground" />
      ) : (
        <Dash />
      );
    case "vendorPartNumber":
      return part.vendorPartNumber ? (
        <TruncatedCell text={part.vendorPartNumber} className="max-w-[180px] font-mono text-sm text-foreground" />
      ) : (
        <Dash />
      );
    case "routing":
      return part.routingTemplate && part.routingTemplate.steps.length > 0 ? (
        <div className="flex items-center gap-1.5">
          {part.routingTemplate.steps.map((step, i) => (
            <ProcessTypeChip key={i} processType={step} compact={cp.condensed} />
          ))}
        </div>
      ) : (
        <Dash />
      );
    case "stockCount":
      return (
        <InlineEditCell
          value={part.stockCount.toString()}
          inputType="number"
          align="right"
          onCommit={(v) => {
            const n = parseInt(v, 10);
            if (!isNaN(n) && n >= 0) cp.onUpdateStock(part.partId, n);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      );
    case "location":
      return (
        <InlineEditCell
          value={part.inventoryLocation ?? ""}
          onCommit={(v) => cp.onUpdateLocation(part.partId, v)}
          onClick={(e) => e.stopPropagation()}
        />
      );
    case "stockSize":
      return part.stockSize ? (
        <span className="text-sm text-foreground">{part.stockSize}″</span>
      ) : (
        <Dash />
      );
    case "blankLength":
      return part.blankLength !== null ? (
        <span className="text-sm text-foreground">{part.blankLength}″</span>
      ) : (
        <Dash />
      );
    case "modelLink":
      return part.modelLink ? (
        <a
          href={part.modelLink}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-500 hover:text-blue-400 hover:underline"
        >
          ↗ 3D
        </a>
      ) : (
        <Dash />
      );
    case "drawingLink":
      return part.drawingLink ? (
        <a
          href={part.drawingLink}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-500 hover:text-blue-400 hover:underline"
        >
          ↗ DWG
        </a>
      ) : (
        <Dash />
      );
    case "binMin":
      return part.binMin !== null ? (
        <span className="text-sm text-foreground">{part.binMin}</span>
      ) : (
        <Dash />
      );
    case "binMax":
      return part.binMax !== null ? (
        <span className="text-sm text-foreground">{part.binMax}</span>
      ) : (
        <Dash />
      );
    case "cost":
      return part.cost !== null ? (
        <span className="text-sm text-foreground">${part.cost.toFixed(2)}</span>
      ) : (
        <Dash />
      );
    case "costLastUpdated":
      return part.costLastUpdated ? (
        <span className="text-sm text-foreground">{formatDate(part.costLastUpdated)}</span>
      ) : (
        <Dash />
      );
    case "assembliesUsedInCount":
      return <span className="text-sm text-foreground">{part.assembliesUsedInCount}</span>;
    case "machineCycleTime":
      return part.machineCycleTime !== null ? (
        <span className="text-sm text-foreground">{part.machineCycleTime} min</span>
      ) : (
        <Dash />
      );
    case "numberOfSetups":
      return part.numberOfSetups !== null ? (
        <span className="text-sm text-foreground">{part.numberOfSetups}</span>
      ) : (
        <Dash />
      );
    case "active":
      return part.isActive ? (
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
      ) : (
        <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Inactive" />
      );
    default: {
      const _never: never = col;
      void _never;
      return null;
    }
  }
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

type Props = {
  parts: MockPart[];
  allParts: MockPart[];
  visibleColumns: ColumnId[];
  sortCol: ColumnId;
  sortAsc: boolean;
  activeFilters: Filter[];
  onSort: (col: ColumnId) => void;
  onSortDir: (col: ColumnId, asc: boolean) => void;
  onClearSort: () => void;
  onHideColumn: (col: ColumnId) => void;
  onApplyFilter: (filter: Filter) => void;
  onRemoveFilter: (col: ColumnId) => void;
  onRowClick: (part: MockPart) => void;
  onUpdateStock: (partId: number, stockCount: number) => void;
  onUpdateLocation: (partId: number, inventoryLocation: string) => void;
  condensed: boolean;
};

const STOP_PROP_COLS = new Set<ColumnId>(["stockCount", "location"]);

export default function PartsGrid({
  parts,
  allParts,
  visibleColumns,
  sortCol,
  sortAsc,
  activeFilters,
  onSort,
  onSortDir,
  onClearSort,
  onHideColumn,
  onApplyFilter,
  onRemoveFilter,
  onRowClick,
  onUpdateStock,
  onUpdateLocation,
  condensed,
}: Props) {
  const cellProps: CellProps = { condensed, onUpdateStock, onUpdateLocation };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            {visibleColumns.map((col) => {
              const meta = COLUMN_BY_ID.get(col)!;
              const activeFilter = activeFilters.find((f) => f.columnId === col) ?? null;
              return (
                <ColumnHeaderMenu
                  key={col}
                  meta={meta}
                  activeSortCol={sortCol}
                  sortAsc={sortAsc}
                  activeFilter={activeFilter}
                  allParts={allParts}
                  onSort={onSort}
                  onSortDir={onSortDir}
                  onClearSort={onClearSort}
                  onHide={onHideColumn}
                  onApplyFilter={onApplyFilter}
                  onRemoveFilter={onRemoveFilter}
                />
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {parts.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={visibleColumns.length}
                className="px-4 py-10 text-center text-xs text-muted-foreground"
              >
                No parts match the current filters.
              </TableCell>
            </TableRow>
          )}
          {parts.map((p) => (
            <TableRow
              key={p.partId}
              onClick={() => onRowClick(p)}
              className={[
                "cursor-pointer",
                p.isActive ? "" : "opacity-40 hover:opacity-60",
                p.partType === "Assembly" ? "bg-muted/30" : "",
              ].join(" ")}
            >
              {visibleColumns.map((col) => {
                const meta = COLUMN_BY_ID.get(col)!;
                const isRight = RIGHT_ALIGNED_COLUMNS.has(col);
                const isCenter = CENTER_COLUMNS.has(col);
                return (
                  <TableCell
                    key={col}
                    className={[
                      meta.defaultWidth,
                      "px-3 py-2",
                      isRight ? "text-right" : isCenter ? "text-center" : "",
                    ].join(" ")}
                    onClick={STOP_PROP_COLS.has(col) ? (e) => e.stopPropagation() : undefined}
                  >
                    {renderCell(col, p, cellProps)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
