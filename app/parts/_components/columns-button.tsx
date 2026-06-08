"use client";

import { useMemo, useState } from "react";
import { Columns2Icon } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { DragHandle } from "@/components/ui/drag-handle";
import { ALL_COLUMNS, type ColumnId } from "@/app/parts/_lib/columns";
import type { FilterObject } from "@/lib/views/types";
import HideColumnFilterDialog from "./hide-column-filter-dialog";

type Props = {
  visibleColumns: string[];
  columnOrder: string[] | null;
  activeFilters: FilterObject[];
  onChange: (columnId: ColumnId, visible: boolean) => void;
  onReorder: (newOrder: string[]) => void;
};

type SortableColumnRowProps = {
  colId: ColumnId;
  label: string;
  isVisible: boolean;
  onToggle: (checked: boolean) => void;
};

function SortableColumnRow({ colId, label, isVisible, onToggle }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: colId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50"
    >
      <DragHandle {...attributes} {...listeners} />
      <Checkbox
        id={`col-${colId}`}
        checked={isVisible}
        onCheckedChange={(val) => onToggle(Boolean(val))}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <label
        htmlFor={`col-${colId}`}
        className="cursor-pointer font-normal text-sm leading-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {label}
      </label>
    </div>
  );
}

export default function ColumnsButton({
  visibleColumns,
  columnOrder,
  activeFilters,
  onChange,
  onReorder,
}: Props) {
  const visibleSet = new Set(visibleColumns);
  const filterColumns = new Set(activeFilters.map((f) => f.column));

  const [pendingHide, setPendingHide] = useState<{ id: ColumnId; label: string } | null>(null);

  const orderedColumns = useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) return ALL_COLUMNS;
    const idToCol = new Map(ALL_COLUMNS.map((c) => [c.id, c]));
    const ordered: typeof ALL_COLUMNS = [];
    const seen = new Set<string>();
    for (const id of columnOrder) {
      const col = idToCol.get(id as ColumnId);
      if (col) { ordered.push(col); seen.add(id); }
    }
    for (const col of ALL_COLUMNS) {
      if (!seen.has(col.id)) ordered.push(col);
    }
    return ordered;
  }, [columnOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedColumns.findIndex((c) => c.id === active.id);
    const newIndex = orderedColumns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(orderedColumns, oldIndex, newIndex);
    onReorder(reordered.map((c) => c.id));
  }

  function handleChange(colId: ColumnId, label: string, checked: boolean) {
    if (!checked && filterColumns.has(colId)) {
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
        <PopoverContent align="end" className="w-56 p-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedColumns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col py-1">
                {orderedColumns.map((col) => (
                  <SortableColumnRow
                    key={col.id}
                    colId={col.id}
                    label={col.label}
                    isVisible={visibleSet.has(col.id)}
                    onToggle={(checked) => handleChange(col.id, col.label, checked)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
