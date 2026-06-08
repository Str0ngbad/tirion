'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import { ReferenceList } from '@/components/configuration/reference-list';
import { DeactivationDialog } from '@/components/configuration/deactivation-dialog';
import { ApiError } from '@/lib/api/client-error';
import {
  useProcurementCategory,
  useProcurementCategoryAuditLog,
  useCreateProcurementCategory,
  useUpdateProcurementCategory,
  useDeactivateProcurementCategory,
  useReactivateProcurementCategory,
  type ProcurementCategoryRow,
} from '@/lib/api/procurement-categories';

export type CategorySheetMode =
  | { type: 'create'; existingCategories: ProcurementCategoryRow[] }
  | { type: 'edit'; categoryId: number };

interface ProcurementCategorySheetProps {
  mode: CategorySheetMode;
  onClose: () => void;
  onCreated?: (newCategoryId: number) => void;
}

export function ProcurementCategorySheet({
  mode,
  onClose,
  onCreated,
}: ProcurementCategorySheetProps) {
  if (mode.type === 'create') {
    return (
      <CreateSheet
        existingCategories={mode.existingCategories}
        onClose={onClose}
        onCreated={onCreated}
      />
    );
  }
  return <EditSheet categoryId={mode.categoryId} onClose={onClose} />;
}

// ─── Create mode ─────────────────────────────────────────────────────────────

function CreateSheet({
  existingCategories,
  onClose,
  onCreated,
}: {
  existingCategories: ProcurementCategoryRow[];
  onClose: () => void;
  onCreated?: (newCategoryId: number) => void;
}) {
  const [categoryCode, setCategoryCode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { mutate: create, isPending } = useCreateProcurementCategory();

  const isValid =
    categoryCode.trim().length >= 2 &&
    categoryCode.trim().length <= 10 &&
    categoryName.trim().length > 0;

  function handleCreate() {
    const errors: Record<string, string> = {};

    const code = categoryCode.trim().toUpperCase();
    if (code.length < 2 || code.length > 10) {
      errors.categoryCode = 'Code must be 2–10 characters';
    } else if (existingCategories.some((c) => c.categoryCode === code)) {
      errors.categoryCode = 'Code already in use';
    }

    const name = categoryName.trim();
    if (!name) {
      errors.categoryName = 'Name is required';
    } else if (
      existingCategories.some((c) => c.categoryName.toLowerCase() === name.toLowerCase())
    ) {
      errors.categoryName = 'Name already in use';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const nextDisplayOrder =
      existingCategories.length === 0
        ? 1
        : Math.max(...existingCategories.map((c) => c.displayOrder)) + 1;

    create(
      {
        categoryCode: code,
        categoryName: name,
        description: description.trim() || null,
        displayOrder: nextDisplayOrder,
      },
      {
        onSuccess: (created) => {
          onCreated?.(created.procurementCategoryId);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.errorCode === 'PROCUREMENT_CATEGORY_CODE_COLLISION') {
              setFieldErrors((p) => ({ ...p, categoryCode: 'This code is already in use' }));
            } else if (err.errorCode === 'PROCUREMENT_CATEGORY_NAME_COLLISION') {
              setFieldErrors((p) => ({ ...p, categoryName: 'This name is already in use' }));
            }
          }
        },
      }
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="text-sm font-semibold">New Procurement Category</span>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="w-24 shrink-0">
              <Label className="text-xs">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                value={categoryCode}
                onChange={(e) => {
                  setCategoryCode(e.target.value.toUpperCase());
                  setFieldErrors((p) => ({ ...p, categoryCode: '' }));
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="CTL"
                maxLength={10}
                className="mt-1 font-mono"
              />
              {fieldErrors.categoryCode && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.categoryCode}</p>
              )}
            </div>
            <div className="flex-1">
              <Label className="text-xs">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setFieldErrors((p) => ({ ...p, categoryName: '' }));
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Cut to Length"
                className="mt-1"
              />
              {fieldErrors.categoryName && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.categoryName}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className="mt-1 resize-none"
            />
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end border-t px-4 py-3 shrink-0">
        <Button size="sm" onClick={handleCreate} disabled={!isValid || isPending}>
          {isPending ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

// ─── Edit mode ────────────────────────────────────────────────────────────────

function EditSheet({
  categoryId,
  onClose,
}: {
  categoryId: number;
  onClose: () => void;
}) {
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
  const [isDirty, setIsDirty] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);

  useEffect(() => {
    if (category) {
      setCategoryCode(category.categoryCode);
      setCategoryName(category.categoryName);
      setDescription(category.description ?? '');
      setIsDirty(false);
    }
  }, [category]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleSave() {
    if (!category) return;
    update(
      {
        id: categoryId,
        input: {
          categoryCode: categoryCode.trim(),
          categoryName: categoryName.trim(),
          description: description.trim() || null,
        },
      },
      { onSuccess: () => setIsDirty(false) }
    );
  }

  function handleDeactivateConfirm() {
    deactivate(categoryId, {
      onSuccess: () => setDeactivateDialogOpen(false),
    });
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
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm font-semibold">{category.categoryCode}</span>
          <span className="text-sm text-muted-foreground truncate">{category.categoryName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
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
        </section>

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

        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

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
            onClick={() => reactivate(categoryId)}
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
        entityName={`${category.categoryCode} — ${category.categoryName}`}
        entityType="procurement category"
        onCancel={() => setDeactivateDialogOpen(false)}
        onConfirm={handleDeactivateConfirm}
      />
    </div>
  );
}
