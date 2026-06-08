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
import ProcessTypeChip from '@/components/process-type-chip';
import type { ProcessTypeKey } from '@/lib/process-types';
import {
  useProcessTypeSubStatus,
  useProcessTypeSubStatusAuditLog,
  useUpdateProcessTypeSubStatus,
  useDeactivateProcessTypeSubStatus,
  useReactivateProcessTypeSubStatus,
  useCreateProcessTypeSubStatus,
  type ProcessTypeSubStatusRow,
} from '@/lib/api/process-type-sub-statuses';
import { ApiError } from '@/lib/api/client-error';

export type SubStatusSheetMode =
  | { type: 'create'; processTypeId: number; processTypeName: string; existing: ProcessTypeSubStatusRow[] }
  | { type: 'edit'; subStatusId: number };

interface ProcessTypeSubStatusSheetProps {
  mode: SubStatusSheetMode;
  onClose: () => void;
  onCreated?: (newId: number) => void;
}

export function ProcessTypeSubStatusSheet({
  mode,
  onClose,
  onCreated,
}: ProcessTypeSubStatusSheetProps) {
  if (mode.type === 'create') {
    return (
      <CreateSubStatusSheet
        processTypeId={mode.processTypeId}
        processTypeName={mode.processTypeName}
        existing={mode.existing}
        onClose={onClose}
        onCreated={onCreated}
      />
    );
  }
  return (
    <EditSubStatusSheet
      subStatusId={mode.subStatusId}
      onClose={onClose}
    />
  );
}

// ─── Create mode ───────────────────────────────────────────────────────────

interface CreateSubStatusSheetProps {
  processTypeId: number;
  processTypeName: string;
  existing: ProcessTypeSubStatusRow[];
  onClose: () => void;
  onCreated?: (newId: number) => void;
}

function CreateSubStatusSheet({
  processTypeId,
  processTypeName,
  existing,
  onClose,
  onCreated,
}: CreateSubStatusSheetProps) {
  const [subStatusName, setSubStatusName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { mutate: create, isPending } = useCreateProcessTypeSubStatus();

  const isValid = subStatusName.trim().length > 0;

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!subStatusName.trim()) {
      errors.subStatusName = 'Name is required';
    } else if (
      existing.some(
        (s) => s.subStatusName.toLowerCase() === subStatusName.trim().toLowerCase()
      )
    ) {
      errors.subStatusName = `A sub-status with this name already exists for ${processTypeName}`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const maxOrder = existing.reduce((max, s) => Math.max(max, s.displayOrder), 0);
    const order = displayOrder ? parseInt(displayOrder, 10) : maxOrder + 1;

    create(
      {
        processTypeId,
        subStatusName: subStatusName.trim(),
        description: description.trim() || null,
        displayOrder: isNaN(order) ? maxOrder + 1 : order,
      },
      {
        onSuccess: (created) => {
          onCreated?.(created.processTypeSubStatusId);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.errorCode === 'PROCESS_TYPE_SUB_STATUS_COLLISION') {
            setFieldErrors({ subStatusName: `A sub-status with this name already exists for ${processTypeName}` });
          }
        },
      }
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3 shrink-0">
        <div className="mb-2">
          <ProcessTypeChip
            processType={processTypeName as ProcessTypeKey}
            size="sm"
            abbreviate={true}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">New Sub-Status</span>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <div>
            <Label htmlFor="create-name" className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-name"
              value={subStatusName}
              onChange={(e) => {
                setSubStatusName(e.target.value);
                setFieldErrors((p) => ({ ...p, subStatusName: '' }));
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="e.g., In Progress"
              className="mt-1"
            />
            {fieldErrors.subStatusName && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.subStatusName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="create-description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="mt-1 resize-none"
            />
          </div>

          <div className="w-32">
            <Label htmlFor="create-order" className="text-xs">
              Display Order
            </Label>
            <Input
              id="create-order"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Auto"
              className="mt-1"
            />
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t px-4 py-3 shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!isValid || isPending}>
          {isPending ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

// ─── Edit mode ──────────────────────────────────────────────────────────────

interface EditSubStatusSheetProps {
  subStatusId: number;
  onClose: () => void;
}

function EditSubStatusSheet({ subStatusId, onClose }: EditSubStatusSheetProps) {
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
      {/* Header */}
      <div className="border-b px-4 py-3 shrink-0">
        <div className="mb-2">
          <ProcessTypeChip
            processType={subStatus.processName as ProcessTypeKey}
            size="sm"
            abbreviate={true}
          />
        </div>
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
      <div className="flex-1 overflow-y-auto min-h-0">
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
