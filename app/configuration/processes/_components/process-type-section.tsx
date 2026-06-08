'use client';

import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUpdateProcessTypeSubStatus, type ProcessTypeSubStatusRow } from '@/lib/api/process-type-sub-statuses';
import type { ProcessTypeRow } from '@/lib/api/process-types';
import type { ProcessTypeKey } from '@/lib/process-types';
import ProcessTypeChip from '@/components/process-type-chip';
import { CreateSubStatusModal } from './create-sub-status-modal';

interface ProcessTypeSectionProps {
  processType: ProcessTypeRow;
  subStatuses: ProcessTypeSubStatusRow[];
  selectedSubStatusId: number | null;
  onSelectSubStatus: (id: number) => void;
  onSelectProcessType: (id: number) => void;
}

export function ProcessTypeSection({
  processType,
  subStatuses,
  selectedSubStatusId,
  onSelectSubStatus,
  onSelectProcessType,
}: ProcessTypeSectionProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const sortedSubStatuses = useMemo(
    () =>
      [...subStatuses].sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return a.subStatusName.localeCompare(b.subStatusName);
      }),
    [subStatuses]
  );

  return (
    <section className="border rounded-md">
      {/* Clickable header — click anywhere except the Add Sub-Status button */}
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
          />
          <span className="text-xs text-muted-foreground">
            {subStatuses.length} {subStatuses.length === 1 ? 'sub-status' : 'sub-statuses'}
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Add Sub-Status
        </Button>
      </div>

      {sortedSubStatuses.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground italic text-center">
          No sub-statuses defined for {processType.processName}
        </div>
      ) : (
        <div className="divide-y">
          {sortedSubStatuses.map((subStatus) => (
            <SubStatusRow
              key={subStatus.processTypeSubStatusId}
              subStatus={subStatus}
              isSelected={subStatus.processTypeSubStatusId === selectedSubStatusId}
              onClick={() => onSelectSubStatus(subStatus.processTypeSubStatusId)}
            />
          ))}
        </div>
      )}

      <CreateSubStatusModal
        open={createModalOpen}
        processTypeId={processType.processTypeId}
        processTypeName={processType.processName}
        existing={subStatuses}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(newId) => {
          setCreateModalOpen(false);
          onSelectSubStatus(newId);
        }}
      />
    </section>
  );
}

interface SubStatusRowProps {
  subStatus: ProcessTypeSubStatusRow;
  isSelected: boolean;
  onClick: () => void;
}

function SubStatusRow({ subStatus, isSelected, onClick }: SubStatusRowProps) {
  const [editingOrder, setEditingOrder] = useState(false);
  const [orderValue, setOrderValue] = useState(String(subStatus.displayOrder));

  const { mutate: update } = useUpdateProcessTypeSubStatus();

  function handleOrderCommit() {
    const newOrder = parseInt(orderValue, 10);
    if (isNaN(newOrder) || newOrder < 0) {
      setOrderValue(String(subStatus.displayOrder));
      setEditingOrder(false);
      return;
    }
    if (newOrder !== subStatus.displayOrder) {
      update({ id: subStatus.processTypeSubStatusId, input: { displayOrder: newOrder } });
    }
    setEditingOrder(false);
  }

  return (
    <div
      className={cn(
        'px-4 py-2 flex items-center gap-3 cursor-pointer hover:bg-muted/40',
        isSelected && 'bg-muted/60',
        !subStatus.isActive && 'opacity-50'
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('input, button')) return;
        onClick();
      }}
    >
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

      {/* Inline displayOrder */}
      <div className="w-16 flex justify-end">
        {editingOrder ? (
          <Input
            type="number"
            value={orderValue}
            onChange={(e) => setOrderValue(e.target.value)}
            onBlur={handleOrderCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleOrderCommit();
              if (e.key === 'Escape') {
                setOrderValue(String(subStatus.displayOrder));
                setEditingOrder(false);
              }
            }}
            autoFocus
            className="h-7 w-16 text-right"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOrderValue(String(subStatus.displayOrder));
              setEditingOrder(true);
            }}
            className="text-sm tabular-nums hover:bg-muted px-2 py-1 rounded text-muted-foreground"
            title="Edit display order"
          >
            {subStatus.displayOrder}
          </button>
        )}
      </div>

      {/* Used By count */}
      <div className="w-16 text-right text-sm text-muted-foreground tabular-nums">
        {subStatus.usedByCount > 0 ? subStatus.usedByCount : '—'}
      </div>
    </div>
  );
}
