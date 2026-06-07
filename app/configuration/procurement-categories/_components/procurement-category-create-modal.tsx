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
import { useCreateProcurementCategory } from '@/lib/api/procurement-categories';
import { ApiError } from '@/lib/api/client-error';

interface ProcurementCategoryCreateModalProps {
  open: boolean;
  nextDisplayOrder: number;
  onClose: () => void;
  onCreated: (newId: number) => void;
}

export function ProcurementCategoryCreateModal({
  open,
  nextDisplayOrder,
  onClose,
  onCreated,
}: ProcurementCategoryCreateModalProps) {
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState(String(nextDisplayOrder));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { mutate: create, isPending } = useCreateProcurementCategory();

  function reset() {
    setCategoryCode('');
    setCategoryName('');
    setDescription('');
    setDisplayOrder(String(nextDisplayOrder));
    setFieldErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!categoryCode.trim()) errors.categoryCode = 'Code is required';
    if (!categoryName.trim()) errors.categoryName = 'Name is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const order = parseInt(displayOrder, 10);

    create(
      {
        categoryCode: categoryCode.trim(),
        categoryName: categoryName.trim(),
        description: description.trim() || null,
        displayOrder: isNaN(order) ? nextDisplayOrder : order,
      },
      {
        onSuccess: (created) => {
          reset();
          onCreated(created.procurementCategoryId);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.errorCode === 'PROCUREMENT_CATEGORY_CODE_COLLISION') {
              setFieldErrors({ categoryCode: 'This code is already in use' });
            } else if (err.errorCode === 'PROCUREMENT_CATEGORY_NAME_COLLISION') {
              setFieldErrors({ categoryName: 'This name is already in use' });
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
          <DialogTitle>Add Procurement Category</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex gap-3">
            <div className="w-28 shrink-0">
              <Label htmlFor="categoryCode" className="text-xs">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryCode"
                value={categoryCode}
                onChange={(e) => {
                  setCategoryCode(e.target.value.toUpperCase());
                  setFieldErrors((p) => ({ ...p, categoryCode: '' }));
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="CTL"
                maxLength={10}
                className="mt-1 font-mono"
              />
              {fieldErrors.categoryCode && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.categoryCode}</p>
              )}
            </div>

            <div className="flex-1">
              <Label htmlFor="categoryName" className="text-xs">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setFieldErrors((p) => ({ ...p, categoryName: '' }));
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Cut to Length"
                className="mt-1"
              />
              {fieldErrors.categoryName && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.categoryName}</p>
              )}
            </div>
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

          <div className="w-28">
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
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
