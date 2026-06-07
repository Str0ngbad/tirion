'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import { ReferenceList } from '@/components/configuration/reference-list';
import { DeactivationDialog } from '@/components/configuration/deactivation-dialog';
import {
  useProcurementCategory,
  useProcurementCategoryAuditLog,
  useUpdateProcurementCategory,
  useDeactivateProcurementCategory,
  useReactivateProcurementCategory,
} from '@/lib/api/procurement-categories';

interface ProcurementCategorySheetProps {
  categoryId: number;
  onClose: () => void;
}

export function ProcurementCategorySheet({
  categoryId,
  onClose,
}: ProcurementCategorySheetProps) {
  const { data: category, isLoading } = useProcurementCategory(categoryId);
  const { data: auditEntries, isLoading: auditLoading } = useProcurementCategoryAuditLog(
    categoryId,
    true
  );

  const { mutate: update, isPending: isSaving } = useUpdateProcurementCategory();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateProcurementCategory();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateProcurementCategory();

  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  useEffect(() => {
    if (category) {
      setCategoryCode(category.categoryCode);
      setCategoryName(category.categoryName);
      setDescription(category.description ?? '');
      setDisplayOrder(String(category.displayOrder));
      setIsDirty(false);
    }
  }, [category]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleSave() {
    if (!category) return;
    const order = parseInt(displayOrder, 10);
    update(
      {
        id: categoryId,
        input: {
          categoryCode: categoryCode.trim(),
          categoryName: categoryName.trim(),
          description: description.trim() || null,
          displayOrder: isNaN(order) ? category.displayOrder : order,
        },
      },
      {
        onSuccess: () => setIsDirty(false),
      }
    );
  }

  function handleDeactivateConfirm() {
    deactivate(categoryId, {
      onSuccess: () => setDeactivateDialogOpen(false),
    });
  }

  function handleReactivate() {
    reactivate(categoryId);
  }

  if (isLoading || !category) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const referenceItems = category.parts.map((p) => ({
    id: p.partId,
    primary: p.partNumber,
    secondary: p.partName,
    link: `/parts/${p.partId}`,
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sheet header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold">{category.categoryCode}</span>
          <span className="text-sm text-muted-foreground truncate">{category.categoryName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity section */}
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <Label className="text-xs">Code</Label>
              <Input
                value={categoryCode}
                onChange={(e) => {
                  setCategoryCode(e.target.value.toUpperCase());
                  markDirty();
                }}
                maxLength={10}
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  markDirty();
                }}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id={`active-${categoryId}`}
              checked={category.isActive}
              disabled
            />
            <label
              htmlFor={`active-${categoryId}`}
              className="text-xs text-muted-foreground"
            >
              {category.isActive ? 'Active' : 'Inactive'}
            </label>
          </div>
        </section>

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
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Used By ({category.usedByCount} active{' '}
            {category.usedByCount === 1 ? 'part' : 'parts'})
          </p>
          <ReferenceList
            items={referenceItems}
            emptyMessage="No active parts reference this category."
          />
        </section>

        {/* Audit log */}
        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3 shrink-0 gap-2">
        {category.isActive ? (
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

        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
        >
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <DeactivationDialog
        variant="standard"
        open={deactivateDialogOpen}
        entityName={`${category.categoryCode} — ${category.categoryName}`}
        entityType="procurement category"
        onCancel={() => setDeactivateDialogOpen(false)}
        onConfirm={handleDeactivateConfirm}
      />
    </div>
  );
}
