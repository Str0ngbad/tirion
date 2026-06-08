"use client";

import React, { useMemo, useContext, createContext } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SortSpec } from "@/lib/views/types";
import { cn } from "@/lib/utils";
import type { PartRowClient } from "@/lib/api/parts";
import {
  ALL_COLUMNS,
  type ColumnId,
} from "@/app/parts/_lib/columns";
import ProcessTypeChip from "@/components/process-type-chip";
import type { ProcessTypeKey } from "@/lib/process-types";
import type { FilterObject } from "@/lib/views/types";
import ColumnHeaderMenu from "./column-header-menu";
import { useTruncatedTitle } from "@/lib/hooks/use-truncated-title";
import InlineEditCell from "./inline-edit-cell";

// ─── Condensed context ────────────────────────────────────────────────────────
// Keeps `condensed` out of row props so toggling it only re-renders routing
// cells, not all 2000+ rows.

const CondensedContext = createContext(true);

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

// ─── Routing cell ─────────────────────────────────────────────────────────────
// Subscribes to CondensedContext so parent rows don't re-render on toggle.

function RoutingCellContent({ processTypes }: { processTypes: string[] }) {
  const condensed = useContext(CondensedContext);
  if (processTypes.length === 0) return <Dash />;
  return (
    <div className="flex items-center gap-1 flex-nowrap">
      {processTypes.map((pt, i) => (
        <ProcessTypeChip key={i} processType={pt as ProcessTypeKey} compact={condensed} />
      ))}
    </div>
  );
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

type CellCallbacks = {
  onStockCountChange: (partId: number, value: number) => void;
  onInventoryLocationChange: (partId: number, value: string | null) => void | Promise<void>;
};

function renderCell(
  row: PartRowClient,
  columnId: ColumnId,
  callbacks?: CellCallbacks
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
      return <RoutingCellContent processTypes={row.processTypes} />;
    case "buildableCount":
      return row.buildableCount !== null ? (
        <span className="tabular-nums">{row.buildableCount}</span>
      ) : (
        <Dash />
      );
    case "stockCount":
      return (
        <InlineEditCell
          value={row.stockCount}
          type="number"
          align="right"
          onCommit={(v) => callbacks?.onStockCountChange(row.partId, v as number)}
        />
      );
    case "inventoryLocation":
      return (
        <InlineEditCell
          value={row.inventoryLocation}
          type="text"
          onCommit={(v) => callbacks?.onInventoryLocationChange(row.partId, v as string | null)}
        />
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

// ─── Row component ────────────────────────────────────────────────────────────

type Column = (typeof ALL_COLUMNS)[number];

const INLINE_EDIT_COLS = new Set<ColumnId>(["stockCount", "inventoryLocation"]);

interface PartRowProps {
  row: PartRowClient;
  isSelected: boolean;
  columns: Column[];
  onSelectPart: (partId: number) => void;
  callbacks: CellCallbacks;
  style?: React.CSSProperties;
}

const PartRowComponent = React.memo(function PartRowComponent({
  row,
  isSelected,
  columns,
  onSelectPart,
  callbacks,
  style,
}: PartRowProps) {
  return (
    <div
      role="row"
      onClick={() => onSelectPart(row.partId)}
      style={style}
      className={cn(
        "flex cursor-pointer border-b border-border transition-colors hover:bg-muted/50",
        isSelected && "shadow-[inset_4px_0_0_hsl(var(--primary))] bg-primary/10",
        row.partType === "Assembly" && "bg-muted/30",
        !row.isActive && "opacity-40 hover:opacity-60"
      )}
    >
      {columns.map((col) => (
        <div
          key={col.id}
          role="cell"
          style={col.id === "routing"
            ? { minWidth: col.width }
            : { width: col.width, minWidth: col.width, maxWidth: col.width }}
          className={cn(
            "px-3 py-1.5 text-sm",
            col.id !== "routing" && "overflow-hidden",
            col.align === "right" && "text-right",
            col.align === "center" && "text-center",
            col.id === "routing" && "whitespace-nowrap",
            INLINE_EDIT_COLS.has(col.id) && "cursor-default"
          )}
          onClick={INLINE_EDIT_COLS.has(col.id) ? (e) => e.stopPropagation() : undefined}
        >
          {renderCell(row, col.id, callbacks)}
        </div>
      ))}
    </div>
  );
});

// ─── Sortable column header ────────────────────────────────────────────────────

type SortableColumnHeaderProps = {
  col: Column;
  sortEntry: SortSpec | undefined;
  sortIndex: number;
  showPriority: boolean;
  filterByColumn: Map<string, FilterObject>;
  sorts: SortSpec[];
  onSortSet: (columnId: ColumnId, direction: "asc" | "desc") => void;
  onAddToSort: (columnId: ColumnId) => void;
  onClearThisSort: (columnId: ColumnId) => void;
  onHideColumn: (columnId: ColumnId) => void;
  onApplyFilter: (filter: FilterObject) => void;
  onRemoveFilter: (column: string) => void;
};

function SortableColumnHeader({
  col,
  sortEntry,
  sortIndex,
  showPriority,
  filterByColumn,
  sorts,
  onSortSet,
  onAddToSort,
  onClearThisSort,
  onHideColumn,
  onApplyFilter,
  onRemoveFilter,
}: SortableColumnHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        "group/header overflow-hidden select-none whitespace-nowrap px-3 py-2 text-xs font-semibold text-foreground cursor-grab active:cursor-grabbing",
        col.align === "right" && "text-right",
        col.align === "center" && "text-center"
      )}
      {...attributes}
      {...listeners}
    >
      <div
        className={cn(
          "flex items-center gap-1",
          col.align === "right" && "justify-end",
          col.align === "center" && "justify-center"
        )}
      >
        <span className="leading-none">{col.label}</span>
        {sortEntry && (
          <span className="inline-flex items-center gap-0.5 text-foreground/60">
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
        {/* Stop pointer events from bubbling into the drag listener so
            the menu can open on a simple click without engaging drag. */}
        <span onPointerDown={(e) => e.stopPropagation()}>
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
        </span>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  rows: PartRowClient[];
  visibleColumns: string[];
  columnOrder: string[] | null;
  sorts: SortSpec[];
  condensed: boolean;
  selectedPartId: number | null;
  filters: FilterObject[];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSelectPart: (partId: number) => void;
  onStockCountChange: (partId: number, value: number) => void;
  onInventoryLocationChange: (partId: number, value: string | null) => void | Promise<void>;
  onColumnReorder: (newOrder: string[]) => void;
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
  columnOrder,
  sorts,
  condensed,
  selectedPartId,
  filters,
  scrollContainerRef,
  onSelectPart,
  onStockCountChange,
  onInventoryLocationChange,
  onColumnReorder,
  onSortSet,
  onAddToSort,
  onClearThisSort,
  onHideColumn,
  onApplyFilter,
  onRemoveFilter,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columns = useMemo(() => {
    const visibleSet = new Set(visibleColumns);
    const filtered = ALL_COLUMNS
      .filter((c) => visibleSet.has(c.id))
      .map((c) => c.id === "routing" ? { ...c, width: condensed ? 120 : 400 } : c);

    if (!columnOrder || columnOrder.length === 0) return filtered;

    const idToCol = new Map(filtered.map((c) => [c.id, c]));
    const ordered: typeof filtered = [];
    const seen = new Set<string>();

    for (const id of columnOrder) {
      const col = idToCol.get(id as ColumnId);
      if (col) { ordered.push(col); seen.add(id); }
    }
    for (const col of filtered) {
      if (!seen.has(col.id)) ordered.push(col);
    }

    return ordered;
  }, [visibleColumns, condensed, columnOrder]);

  const totalWidth = useMemo(
    () => columns.reduce((sum, c) => sum + c.width, 0),
    [columns]
  );

  const filterByColumn = useMemo(
    () => new Map(filters.map((f) => [f.column, f])),
    [filters]
  );

  const showPriority = sorts.length > 1;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(columns, oldIndex, newIndex);
    onColumnReorder(reordered.map((c) => c.id));
  }

  const cellCallbacks = useMemo<CellCallbacks>(
    () => ({ onStockCountChange, onInventoryLocationChange }),
    [onStockCountChange, onInventoryLocationChange]
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 33,
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <CondensedContext.Provider value={condensed}>
      <div role="table" style={{ width: totalWidth }} className="text-sm">
        {/* Sticky header */}
        <div
          role="rowgroup"
          className="sticky top-0 z-10 bg-muted border-b border-border"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div role="row" className="flex">
                {columns.map((col) => {
                  const sortEntry = sorts.find((s) => s.column === col.id);
                  const sortIndex = sortEntry ? sorts.indexOf(sortEntry) : -1;
                  return (
                    <SortableColumnHeader
                      key={col.id}
                      col={col}
                      sortEntry={sortEntry}
                      sortIndex={sortIndex}
                      showPriority={showPriority}
                      filterByColumn={filterByColumn}
                      sorts={sorts}
                      onSortSet={onSortSet}
                      onAddToSort={onAddToSort}
                      onClearThisSort={onClearThisSort}
                      onHideColumn={onHideColumn}
                      onApplyFilter={onApplyFilter}
                      onRemoveFilter={onRemoveFilter}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Virtual body */}
        <div
          role="rowgroup"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]!;
            return (
              <PartRowComponent
                key={virtualRow.key}
                row={row}
                isSelected={row.partId === selectedPartId}
                columns={columns}
                onSelectPart={onSelectPart}
                callbacks={cellCallbacks}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
        </div>
      </div>
    </CondensedContext.Provider>
  );
}
