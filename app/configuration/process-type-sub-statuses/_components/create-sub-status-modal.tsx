'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProcessTypeSubStatus, type ProcessTypeSubStatusRow } from '@/lib/api/process-type-sub-statuses';
import { ApiError } from '@/lib/api/client-error';

interface CreateSubStatusModalProps {
  open: boolean;
  processTypeId: number;
  processTypeName: string;
  existing: ProcessTypeSubStatusRow[];
  onClose: () => void;
  onCreated: (newId: number) => void;
}

export function CreateSubStatusModal({
  open,
  processTypeId,
  processTypeName,
  existing,
  onClose,
  onCreated,
}: CreateSubStatusModalProps) {
  const [subStatusName, setSubStatusName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { mutate: create, isPending } = useCreateProcessTypeSubStatus();

  function reset() {
    setSubStatusName('');
    setDescription('');
    setDisplayOrder('');
    setFieldErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

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
          reset();
          onCreated(created.processTypeSubStatusId);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.errorCode === 'PROCESS_TYPE_SUB_STATUS_COLLISION') {
              setFieldErrors({ subStatusName: `A sub-status with this name already exists for ${processTypeName}` });
            }
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sub-Status to {processTypeName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <Label htmlFor="subStatusName" className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subStatusName"
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
            <Label htmlFor="description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="mt-1 resize-none"
            />
          </div>

          <div className="w-32">
            <Label htmlFor="displayOrder" className="text-xs">
              Display Order
            </Label>
            <Input
              id="displayOrder"
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Auto"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
