"use client";

import { useState, useRef, useEffect } from "react";
import { MockPart } from "../_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { useTruncatedTitle } from "@/app/_lib/use-truncated-title";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type PartSortKey =
  | "partNumber"
  | "partName"
  | "materialName"
  | "vendorName"
  | "stockCount"
  | "inventoryLocation";

type Props = {
  parts: MockPart[];
  sortKey: PartSortKey;
  sortAsc: boolean;
  onSort: (key: PartSortKey) => void;
  onRowClick: (part: MockPart) => void;
  onUpdateStock: (partId: number, stockCount: number) => void;
  onUpdateLocation: (partId: number, inventoryLocation: string) => void;
  condensed: boolean;
};

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-muted-foreground/30">↕</span>;
  return <span className="ml-1 text-muted-foreground">{asc ? "↑" : "↓"}</span>;
}

function Th({
  label,
  sortCol,
  activeSortKey,
  sortAsc,
  onSort,
  className,
}: {
  label: string;
  sortCol?: PartSortKey;
  activeSortKey: PartSortKey;
  sortAsc: boolean;
  onSort: (key: PartSortKey) => void;
  className?: string;
}) {
  const base =
    "px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground select-none text-left";
  if (sortCol) {
    return (
      <TableHead
        className={`${base} cursor-pointer hover:text-foreground transition-colors ${className ?? ""}`}
        onClick={() => onSort(sortCol)}
      >
        {label}
        <SortIcon active={activeSortKey === sortCol} asc={sortAsc} />
      </TableHead>
    );
  }
  return <TableHead className={`${base} ${className ?? ""}`}>{label}</TableHead>;
}

function TruncatedCell({ text, className }: { text: string; className?: string }) {
  const { ref, title } = useTruncatedTitle<HTMLSpanElement>(text);
  return (
    <span ref={ref} title={title} className={`block truncate ${className ?? ""}`}>
      {text}
    </span>
  );
}

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

  // Reset draft when value changes from outside (e.g. after save)
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

export default function PartsGrid({
  parts,
  sortKey,
  sortAsc,
  onSort,
  onRowClick,
  onUpdateStock,
  onUpdateLocation,
  condensed,
}: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-card hover:bg-card">
            <Th
              label="Part Number"
              sortCol="partNumber"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[120px] max-w-[160px]"
            />
            <Th
              label="Part Name"
              sortCol="partName"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[200px] max-w-[280px]"
            />
            <Th
              label="Type"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="w-24"
            />
            <Th
              label="Procurement"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="w-28"
            />
            <Th
              label="Material"
              sortCol="materialName"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[140px]"
            />
            <Th
              label="Vendor"
              sortCol="vendorName"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[140px]"
            />
            <Th
              label="Routing"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="flex-1 min-w-[160px]"
            />
            <TableHead
              className="w-20 px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground select-none cursor-pointer hover:text-foreground transition-colors"
              onClick={() => onSort("stockCount")}
            >
              Stock
              <SortIcon active={sortKey === "stockCount"} asc={sortAsc} />
            </TableHead>
            <Th
              label="Location"
              sortCol="inventoryLocation"
              activeSortKey={sortKey}
              sortAsc={sortAsc}
              onSort={onSort}
              className="min-w-[120px] max-w-[180px]"
            />
            <TableHead className="w-16 px-3 py-2.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Active
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="bg-card/30">
          {parts.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={10}
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
              className={`cursor-pointer ${
                p.isActive ? "" : "opacity-40 hover:opacity-60"
              } ${p.partType === "Assembly" ? "bg-muted/30" : ""}`}
            >
              {/* Part Number */}
              <TableCell className="min-w-[120px] max-w-[160px] px-3 py-2">
                <TruncatedCell
                  text={p.partNumber}
                  className="max-w-[160px] font-mono text-sm font-medium text-foreground"
                />
              </TableCell>

              {/* Part Name */}
              <TableCell className="min-w-[200px] max-w-[280px] px-3 py-2">
                <TruncatedCell
                  text={p.partName}
                  className="max-w-[280px] font-medium text-foreground"
                />
              </TableCell>

              {/* Type */}
              <TableCell className="w-24 px-3 py-2">
                <Badge
                  variant={p.partType === "Assembly" ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {p.partType}
                </Badge>
              </TableCell>

              {/* Procurement */}
              <TableCell className="w-28 px-3 py-2 text-sm text-muted-foreground">
                {p.procurementType}
              </TableCell>

              {/* Material */}
              <TableCell className="min-w-[140px] px-3 py-2">
                {p.materialSpec ? (
                  <TruncatedCell
                    text={p.materialSpec.materialName}
                    className="max-w-[180px] text-sm text-foreground"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </TableCell>

              {/* Vendor */}
              <TableCell className="min-w-[140px] px-3 py-2">
                {p.defaultVendor ? (
                  <TruncatedCell
                    text={p.defaultVendor.vendorName}
                    className="max-w-[180px] text-sm text-foreground"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </TableCell>

              {/* Routing */}
              <TableCell className="flex-1 min-w-[160px] px-3 py-2">
                {p.routingTemplate && p.routingTemplate.steps.length > 0 ? (
                  <div className="flex items-center gap-0.5">
                    {p.routingTemplate.steps.map((step, i) => (
                      <ProcessTypeChip key={i} processType={step} compact={condensed} />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/40">—</span>
                )}
              </TableCell>

              {/* Stock Count — inline edit */}
              <TableCell className="w-20 px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <InlineEditCell
                  value={p.stockCount.toString()}
                  inputType="number"
                  align="right"
                  onCommit={(v) => {
                    const n = parseInt(v, 10);
                    if (!isNaN(n) && n >= 0) onUpdateStock(p.partId, n);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>

              {/* Inventory Location — inline edit */}
              <TableCell className="min-w-[120px] max-w-[180px] px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <InlineEditCell
                  value={p.inventoryLocation ?? ""}
                  onCommit={(v) => onUpdateLocation(p.partId, v)}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>

              {/* Active */}
              <TableCell className="w-16 px-3 py-2 text-center">
                {p.isActive ? (
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
                ) : (
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Inactive" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
