'use client';

import { useState, useMemo } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useProcurementCategories } from '@/lib/api/procurement-categories';
import { ProcurementCategoryGrid } from './_components/procurement-category-grid';
import { ProcurementCategorySheet } from './_components/procurement-category-sheet';

type SheetState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; categoryId: number };

export default function ProcurementCategoriesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>({ type: 'closed' });

  const { data: categories = [], isLoading } = useProcurementCategories({
    active: showInactive ? 'all' : 'true',
  });

  // Always render in displayOrder ascending; drag-to-reorder is the sole ordering mechanism
  const sorted = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const selectedId = sheetState.type === 'edit' ? sheetState.categoryId : null;

  return (
    <ConfigurationPageChrome
      title="Procurement Categories"
      count={categories.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Category"
      onAdd={() => setSheetState({ type: 'create' })}
    >
      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-4xl h-full">
            <ProcurementCategoryGrid
              categories={sorted}
              isLoading={isLoading}
              selectedId={selectedId}
              onSelect={(id) =>
                setSheetState((prev) =>
                  prev.type === 'edit' && prev.categoryId === id
                    ? { type: 'closed' }
                    : { type: 'edit', categoryId: id }
                )
              }
            />
          </div>
        </div>

        <div className="w-[400px] shrink-0 border-l border-border min-h-0 h-full flex flex-col overflow-hidden">
          {sheetState.type === 'closed' ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
              Select a category to view details
            </div>
          ) : (
            <ProcurementCategorySheet
              mode={
                sheetState.type === 'create'
                  ? { type: 'create', existingCategories: categories }
                  : { type: 'edit', categoryId: sheetState.categoryId }
              }
              onClose={() => setSheetState({ type: 'closed' })}
              onCreated={(newId) => setSheetState({ type: 'edit', categoryId: newId })}
            />
          )}
        </div>
      </div>
    </ConfigurationPageChrome>
  );
}
