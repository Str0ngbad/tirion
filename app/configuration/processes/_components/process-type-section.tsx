'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DragHandle } from '@/components/ui/drag-handle';
import { cn } from '@/lib/utils';
import {
  useReorderProcessTypeSubStatuses,
  type ProcessTypeSubStatusRow,
} from '@/lib/api/process-type-sub-statuses';
import type { ProcessTypeRow } from '@/lib/api/process-types';
import type { ProcessTypeKey } from '@/lib/process-types';
import ProcessTypeChip from '@/components/process-type-chip';

interface ProcessTypeSectionProps {
  processType: ProcessTypeRow;
  subStatuses: ProcessTypeSubStatusRow[];
  selectedSubStatusId: number | null;
  onSelectSubStatus: (id: number) => void;
  onSelectProcessType: (id: number) => void;
  onCreateSubStatus: (processTypeId: number, processTypeName: string) => void;
}

export function ProcessTypeSection({
  processType,
  subStatuses,
  selectedSubStatusId,
  onSelectSubStatus,
  onSelectProcessType,
  onCreateSubStatus,
}: ProcessTypeSectionProps) {
  const sortedSubStatuses = useMemo(
    () =>
      [...subStatuses].sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return a.subStatusName.localeCompare(b.subStatusName);
      }),
    [subStatuses]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { mutate: reorder } = useReorderProcessTypeSubStatuses();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortedSubStatuses.findIndex(
      (s) => s.processTypeSubStatusId === active.id
    );
    const newIndex = sortedSubStatuses.findIndex(
      (s) => s.processTypeSubStatusId === over.id
    );

    const reordered = arrayMove(sortedSubStatuses, oldIndex, newIndex);
    const updates = reordered.map((s, i) => ({
      id: s.processTypeSubStatusId,
      displayOrder: i + 1,
    }));

    reorder({ processTypeId: processType.processTypeId, updates });
  }

  return (
    <section className="border rounded-md">
      <div
        className="border-b px-4 py-3 flex items-center justify-between bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) return;
          onSelectProcessType(processType.processTypeId);
        }}
      >
        <div className="flex items-center gap-3">
          <ProcessTypeChip
            processType={processType.processName as ProcessTypeKey}
            size="lg"
            abbreviate={false}
          />
          <span className="text-xs text-muted-foreground">
            {subStatuses.length} {subStatuses.length === 1 ? 'sub-status' : 'sub-statuses'}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onCreateSubStatus(processType.processTypeId, processType.processName);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Sub-Status
        </Button>
      </div>

      {sortedSubStatuses.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground italic text-center">
          No sub-statuses defined for {processType.processName}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedSubStatuses.map((s) => s.processTypeSubStatusId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y">
              {sortedSubStatuses.map((subStatus) => (
                <SortableSubStatusRow
                  key={subStatus.processTypeSubStatusId}
                  subStatus={subStatus}
                  isSelected={subStatus.processTypeSubStatusId === selectedSubStatusId}
                  onClick={() => onSelectSubStatus(subStatus.processTypeSubStatusId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

interface SortableSubStatusRowProps {
  subStatus: ProcessTypeSubStatusRow;
  isSelected: boolean;
  onClick: () => void;
}

function SortableSubStatusRow({ subStatus, isSelected, onClick }: SortableSubStatusRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subStatus.processTypeSubStatusId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted/40',
        isSelected && 'bg-muted/60',
        !subStatus.isActive && 'opacity-50'
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-drag-handle]')) return;
        onClick();
      }}
    >
      <DragHandle data-drag-handle {...attributes} {...listeners} />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{subStatus.subStatusName}</span>
          {!subStatus.isActive && (
            <Badge variant="outline" className="text-xs">Inactive</Badge>
          )}
        </div>
        {subStatus.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{subStatus.description}</p>
        )}
      </div>

      {/* Used By count */}
      <div className="w-16 text-right text-sm text-muted-foreground tabular-nums">
        {subStatus.usedByCount > 0 ? subStatus.usedByCount : '—'}
      </div>
    </div>
  );
}
