'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import ProcessTypeChip from '@/components/process-type-chip';
import type { ProcessTypeKey } from '@/lib/process-types';
import {
  useProcessTypeDetail,
  useUpdateProcessType,
  useProcessTypeAuditLog,
} from '@/lib/api/process-types';

interface ProcessTypeSheetProps {
  processTypeId: number;
  onClose: () => void;
}

export function ProcessTypeSheet({ processTypeId, onClose }: ProcessTypeSheetProps) {
  const { data: processType, isLoading } = useProcessTypeDetail(processTypeId);
  const { data: auditEntries, isLoading: auditLoading } = useProcessTypeAuditLog(
    processTypeId,
    true
  );
  const { mutate: update, isPending: isSaving } = useUpdateProcessType();

  const [description, setDescription] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (processType) {
      setDescription(processType.description ?? '');
      setIsDirty(false);
    }
  }, [processType]);

  function handleSave() {
    if (!processType || !isDirty) return;
    update(
      {
        id: processTypeId,
        input: { description: description.trim() || null },
      },
      {
        onSuccess: () => setIsDirty(false),
      }
    );
  }

  if (isLoading || !processType) {
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <ProcessTypeChip
              processType={processType.processName as ProcessTypeKey}
              size="lg"
              abbreviate={false}
            />
            <Switch checked={processType.isActive} disabled />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Description */}
        <section className="border-b px-4 py-4">
          <Label className="text-xs">Description</Label>
          <Textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setIsDirty(true);
            }}
            rows={3}
            className="mt-1 resize-none"
            placeholder="Optional description"
          />
        </section>

        {/* Reference counts */}
        <section className="border-b px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
            References
          </p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Routing templates</span>
              <span className="tabular-nums font-medium">
                {processType.routingTemplatesCount}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Active parts</span>
              <span className="tabular-nums font-medium">
                {processType.partsCount}
              </span>
            </div>
          </div>
        </section>

        {/* Audit log */}
        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end border-t px-4 py-3 shrink-0">
        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
