'use client';

import { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import { ReferenceList } from '@/components/configuration/reference-list';
import { DeactivationDialog } from '@/components/configuration/deactivation-dialog';
import { MaterialSpecCascadeModal } from '@/components/material-specs/material-spec-cascade-modal';
import {
  useMaterialSpec,
  useMaterialSpecAuditLog,
  useMaterialSpecs,
  useUpdateMaterialSpec,
  useDeactivateMaterialSpec,
  useReactivateMaterialSpec,
} from '@/lib/api/material-specs';
import { ApiError } from '@/lib/api/client-error';

interface MaterialSpecSheetProps {
  materialSpecId: number;
  onClose: () => void;
}

export function MaterialSpecSheet({ materialSpecId, onClose }: MaterialSpecSheetProps) {
  const { data: spec, isLoading } = useMaterialSpec(materialSpecId);
  const { data: auditEntries, isLoading: auditLoading } = useMaterialSpecAuditLog(materialSpecId, true);
  const { data: allSpecs = [] } = useMaterialSpecs({ active: 'all' });

  const { mutate: update, isPending: isUpdating } = useUpdateMaterialSpec();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateMaterialSpec();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateMaterialSpec();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState<
    | { variant: 'standard' }
    | { variant: 'blocked-by-references'; blockingReferences: Array<{ id: number; primary: string; secondary: string; link: string }> }
    | null
  >(null);

  function handleDeactivateClick() {
    if (!spec) return;
    if (spec.usedByCount > 0) {
      setDeactivateDialog({
        variant: 'blocked-by-references',
        blockingReferences: spec.parts.map((p) => ({
          id: p.partId,
          primary: p.partNumber,
          secondary: p.partName,
          link: `/parts?partId=${p.partId}`,
        })),
      });
    } else {
      setDeactivateDialog({ variant: 'standard' });
    }
  }

  function handleDeactivateConfirm() {
    deactivate(materialSpecId, {
      onSuccess: () => setDeactivateDialog(null),
    });
  }

  function handleUpdate(updated: { materialName: string; form: string }) {
    update(
      { id: materialSpecId, input: updated },
      {
        onSuccess: () => setEditModalOpen(false),
        onError: (err) => {
          if (err instanceof ApiError && err.errorCode === 'MATERIAL_SPEC_COLLISION') {
            // The cascade modal already shows the pair-collision warning,
            // but a race could still produce a 409 from the server.
            // The modal stays open; user sees nothing special here.
          }
        },
      }
    );
  }

  if (isLoading || !spec) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="font-medium text-sm truncate">
          {spec.materialName} — {spec.form}
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity section */}
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                Material / Form
              </p>
              <p className="text-sm font-mono">
                {spec.materialName} — {spec.form}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              disabled={isUpdating}
            >
              <Pencil className="h-3 w-3 mr-1.5" />
              Edit
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`active-${materialSpecId}`} checked={spec.isActive} disabled />
            <label htmlFor={`active-${materialSpecId}`} className="text-xs text-muted-foreground">
              {spec.isActive ? 'Active' : 'Inactive'}
            </label>
          </div>
        </section>

        {/* Used By section */}
        <section className="border-b px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Used By ({spec.usedByCount} active{' '}
            {spec.usedByCount === 1 ? 'part' : 'parts'})
          </p>
          <ReferenceList
            items={spec.parts.map((p) => ({
              id: p.partId,
              primary: p.partNumber,
              secondary: p.partName,
              link: `/parts?partId=${p.partId}`,
            }))}
            emptyMessage="No active parts reference this MaterialSpec."
          />
        </section>

        {/* Audit Log */}
        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t px-4 py-3 shrink-0">
        {spec.isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeactivateClick}
            disabled={isDeactivating}
          >
            {isDeactivating ? 'Deactivating…' : 'Deactivate'}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactivate(materialSpecId)}
            disabled={isReactivating}
          >
            {isReactivating ? 'Reactivating…' : 'Reactivate'}
          </Button>
        )}
      </div>

      {/* Edit cascade modal */}
      {editModalOpen && (
        <MaterialSpecCascadeModal
          mode="edit"
          open={editModalOpen}
          existingSpecs={allSpecs}
          currentSpec={spec}
          onClose={() => setEditModalOpen(false)}
          onUpdate={(updated) => handleUpdate({ materialName: updated.materialName, form: updated.form })}
        />
      )}

      {/* Deactivation dialogs */}
      {deactivateDialog?.variant === 'standard' && (
        <DeactivationDialog
          variant="standard"
          open
          entityName={`${spec.materialName} — ${spec.form}`}
          entityType="material spec"
          onCancel={() => setDeactivateDialog(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}

      {deactivateDialog?.variant === 'blocked-by-references' && (
        <DeactivationDialog
          variant="blocked-by-references"
          open
          entityName={`${spec.materialName} — ${spec.form}`}
          entityType="material spec"
          blockingReferences={deactivateDialog.blockingReferences}
          onCancel={() => setDeactivateDialog(null)}
        />
      )}
    </div>
  );
}
