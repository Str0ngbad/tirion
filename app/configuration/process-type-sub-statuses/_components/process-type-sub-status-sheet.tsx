'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import { DeactivationDialog } from '@/components/configuration/deactivation-dialog';
import {
  useProcessTypeSubStatus,
  useProcessTypeSubStatusAuditLog,
  useUpdateProcessTypeSubStatus,
  useDeactivateProcessTypeSubStatus,
  useReactivateProcessTypeSubStatus,
} from '@/lib/api/process-type-sub-statuses';

interface ProcessTypeSubStatusSheetProps {
  subStatusId: number;
  onClose: () => void;
}

export function ProcessTypeSubStatusSheet({
  subStatusId,
  onClose,
}: ProcessTypeSubStatusSheetProps) {
  const { data: subStatus, isLoading } = useProcessTypeSubStatus(subStatusId);
  const { data: auditEntries, isLoading: auditLoading } = useProcessTypeSubStatusAuditLog(
    subStatusId,
    true
  );

  const { mutate: update, isPending: isSaving } = useUpdateProcessTypeSubStatus();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateProcessTypeSubStatus();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateProcessTypeSubStatus();

  const [subStatusName, setSubStatusName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  useEffect(() => {
    if (subStatus) {
      setSubStatusName(subStatus.subStatusName);
      setDescription(subStatus.description ?? '');
      setDisplayOrder(String(subStatus.displayOrder));
      setIsDirty(false);
    }
  }, [subStatus]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleSave() {
    if (!subStatus) return;
    const order = parseInt(displayOrder, 10);
    update(
      {
        id: subStatusId,
        input: {
          subStatusName: subStatusName.trim(),
          description: description.trim() || null,
          displayOrder: isNaN(order) ? subStatus.displayOrder : order,
        },
      },
      {
        onSuccess: () => setIsDirty(false),
      }
    );
  }

  function handleDeactivateConfirm() {
    deactivate(subStatusId, {
      onSuccess: () => setDeactivateDialogOpen(false),
    });
  }

  function handleReactivate() {
    reactivate(subStatusId);
  }

  if (isLoading || !subStatus) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sheet header */}
      <div className="border-b px-4 py-3 shrink-0">
        <div className="text-xs text-muted-foreground mb-1">{subStatus.processName}</div>
        <div className="flex items-center gap-2">
          <Input
            value={subStatusName}
            onChange={(e) => {
              setSubStatusName(e.target.value);
              markDirty();
            }}
            className="text-sm font-medium border-0 px-0 h-7 focus-visible:ring-0 flex-1 min-w-0"
          />
          <Switch checked={subStatus.isActive} disabled />
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Description + display order */}
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markDirty();
              }}
              rows={3}
              className="mt-1 resize-none"
              placeholder="Optional description"
            />
          </div>

          <div className="w-28">
            <Label className="text-xs">Display Order</Label>
            <Input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => {
                setDisplayOrder(e.target.value);
                markDirty();
              }}
              className="mt-1"
            />
          </div>
        </section>

        {/* Used By */}
        <section className="border-b px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
            Used By
          </p>
          <p className="text-sm text-muted-foreground">
            {subStatus.usedByCount > 0
              ? `${subStatus.usedByCount} work order ${subStatus.usedByCount === 1 ? 'step' : 'steps'}`
              : 'Not referenced by any work order steps'}
          </p>
        </section>

        {/* Audit log */}
        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3 shrink-0 gap-2">
        {subStatus.isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeactivateDialogOpen(true)}
            disabled={isSaving || isDeactivating}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReactivate}
            disabled={isReactivating}
          >
            {isReactivating ? 'Activating…' : 'Activate'}
          </Button>
        )}

        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <DeactivationDialog
        variant="standard"
        open={deactivateDialogOpen}
        entityName={subStatus.subStatusName}
        entityType="sub-status"
        onCancel={() => setDeactivateDialogOpen(false)}
        onConfirm={handleDeactivateConfirm}
      />
    </div>
  );
}
