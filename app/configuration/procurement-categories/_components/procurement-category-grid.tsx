'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { DragHandle } from '@/components/ui/drag-handle';
import { ActiveIndicator } from '@/components/ui/active-indicator';
import { useReorderProcurementCategories, type ProcurementCategoryRow } from '@/lib/api/procurement-categories';

interface ProcurementCategoryGridProps {
  categories: ProcurementCategoryRow[];
  isLoading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}

interface SortableCategoryRowProps {
  category: ProcurementCategoryRow;
  isSelected: boolean;
  onClick: () => void;
}

function SortableCategoryRow({ category, isSelected, onClick }: SortableCategoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.procurementCategoryId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
    position: isDragging ? ('relative' as const) : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 border-b px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors cursor-pointer',
        isSelected && 'bg-muted/70',
        !category.isActive && 'opacity-40'
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
        onClick();
      }}
    >
      <div className="w-6 flex items-center justify-center shrink-0">
        <DragHandle data-drag-handle {...attributes} {...listeners} />
      </div>
      <div className="w-14 flex items-center justify-center shrink-0">
        <ActiveIndicator active={category.isActive} />
      </div>
      <div className="w-20 shrink-0 font-mono text-xs">{category.categoryCode}</div>
      <div className="w-40 shrink-0 font-medium truncate">{category.categoryName}</div>
      <div className="flex-1 min-w-0 text-muted-foreground text-xs truncate">
        {category.description ?? ''}
      </div>
      <div className="w-20 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
        {category.usedByCount > 0 ? category.usedByCount : '—'}
      </div>
    </div>
  );
}

export function ProcurementCategoryGrid({
  categories,
  isLoading,
  selectedId,
  onSelect,
}: ProcurementCategoryGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { mutate: reorder } = useReorderProcurementCategories();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.procurementCategoryId === active.id);
    const newIndex = categories.findIndex((c) => c.procurementCategoryId === over.id);

    const reordered = arrayMove(categories, oldIndex, newIndex);
    const updates = reordered.map((c, i) => ({
      id: c.procurementCategoryId,
      displayOrder: i + 1,
    }));

    reorder(updates);
  }

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
        No procurement categories found.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header — display-only labels, no sort controls */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 shrink-0">
        <div className="w-6 shrink-0" />
        <div className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground text-center">
          Active
        </div>
        <div className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Code
        </div>
        <div className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Name
        </div>
        <div className="flex-1 min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Description
        </div>
        <div className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
          Used By
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map((c) => c.procurementCategoryId)}
            strategy={verticalListSortingStrategy}
          >
            {categories.map((cat) => (
              <SortableCategoryRow
                key={cat.procurementCategoryId}
                category={cat}
                isSelected={selectedId === cat.procurementCategoryId}
                onClick={() => onSelect(cat.procurementCategoryId)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
