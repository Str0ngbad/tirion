'use client';

import { useState, useMemo } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useProcurementCategories } from '@/lib/api/procurement-categories';
import { ProcurementCategoryGrid } from './_components/procurement-category-grid';
import { ProcurementCategorySheet } from './_components/procurement-category-sheet';
import type { ProcurementCategoryRow } from '@/lib/api/procurement-categories';

type SortKey = 'categoryCode' | 'categoryName' | 'usedByCount';

type SheetState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; categoryId: number };

function sortCategories(
  categories: ProcurementCategoryRow[],
  key: SortKey,
  dir: 'asc' | 'desc'
): ProcurementCategoryRow[] {
  return [...categories].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    let cmp: number;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      cmp = aVal.localeCompare(bVal);
    } else {
      cmp = (aVal as number) - (bVal as number);
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function ProcurementCategoriesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>({ type: 'closed' });
  const [sortKey, setSortKey] = useState<SortKey>('categoryCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: categories = [], isLoading } = useProcurementCategories({
    active: showInactive ? 'all' : 'true',
  });

  // When no column sort is active, preserve displayOrder from the server
  const sorted = useMemo(
    () => sortCategories(categories, sortKey, sortDir),
    [categories, sortKey, sortDir]
  );

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

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
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
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
