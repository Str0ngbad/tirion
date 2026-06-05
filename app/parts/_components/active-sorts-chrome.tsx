"use client";

import { GripVerticalIcon, XIcon } from "lucide-react";
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SortSpec } from "@/lib/views/types";
import { COLUMN_BY_ID, type ColumnId } from "@/app/parts/_lib/columns";

type Props = {
  sorts: SortSpec[];
  viewSorts: SortSpec[];
  onReorderSorts: (sorts: SortSpec[]) => void;
  onToggleDirection: (column: string) => void;
  onRemoveSort: (column: string) => void;
};

function isViewSort(sort: SortSpec, viewSorts: SortSpec[]): boolean {
  return viewSorts.some(
    (vs) => vs.column === sort.column && vs.direction === sort.direction
  );
}

type PillProps = {
  sort: SortSpec;
  priority: number;
  showPriority: boolean;
  isView: boolean;
  onToggleDirection: () => void;
  onRemove: () => void;
};

function SortPill({ sort, priority, showPriority, isView, onToggleDirection, onRemove }: PillProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sort.column });

  const col = COLUMN_BY_ID.get(sort.column as ColumnId);
  const label = col?.label ?? sort.column;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={[
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs",
        isView
          ? "bg-muted/30 border-border text-foreground"
          : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
      ].join(" ")}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-current opacity-40 hover:opacity-80 touch-none"
        aria-label="Drag to reorder"
      >
        <GripVerticalIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onToggleDirection}
        className="flex items-center gap-0.5 hover:opacity-80"
        aria-label={`Toggle sort direction for ${label}`}
      >
        {showPriority && (
          <span className="tabular-nums opacity-60">{priority}</span>
        )}
        <span>{label}</span>
        <span className="opacity-70">{sort.direction === "asc" ? "↑" : "↓"}</span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${label} sort`}
        onClick={onRemove}
        className="shrink-0 text-current opacity-60 hover:opacity-100"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

export default function ActiveSortsChrome({
  sorts,
  viewSorts,
  onReorderSorts,
  onToggleDirection,
  onRemoveSort,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (sorts.length === 0) return null;

  const showPriority = sorts.length > 1;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sorts.findIndex((s) => s.column === active.id);
      const newIndex = sorts.findIndex((s) => s.column === over.id);
      onReorderSorts(arrayMove(sorts, oldIndex, newIndex));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={sorts.map((s) => s.column)}
        strategy={horizontalListSortingStrategy}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {sorts.map((sort, i) => (
            <SortPill
              key={sort.column}
              sort={sort}
              priority={i + 1}
              showPriority={showPriority}
              isView={isViewSort(sort, viewSorts)}
              onToggleDirection={() => onToggleDirection(sort.column)}
              onRemove={() => onRemoveSort(sort.column)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
