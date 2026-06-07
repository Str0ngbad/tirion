'use client';

import { useState, useMemo } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useProcurementCategories } from '@/lib/api/procurement-categories';
import { ProcurementCategoryGrid } from './_components/procurement-category-grid';
import { ProcurementCategorySheet } from './_components/procurement-category-sheet';
import { ProcurementCategoryCreateModal } from './_components/procurement-category-create-modal';
import type { ProcurementCategoryRow } from '@/lib/api/procurement-categories';

type SortKey = 'categoryCode' | 'categoryName' | 'displayOrder' | 'usedByCount';

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('displayOrder');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: categories = [], isLoading } = useProcurementCategories({
    active: showInactive ? 'all' : 'true',
  });

  const sorted = useMemo(
    () => sortCategories(categories, sortKey, sortDir),
    [categories, sortKey, sortDir]
  );

  const nextDisplayOrder = useMemo(() => {
    if (categories.length === 0) return 0;
    return Math.max(...categories.map((c) => c.displayOrder)) + 1;
  }, [categories]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <ConfigurationPageChrome
      title="Procurement Categories"
      count={categories.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Category"
      onAdd={() => setCreateModalOpen(true)}
    >
      <div className="flex h-full min-h-0">
        <div className="w-[calc(100%-400px)] shrink-0 overflow-auto">
          <div className="max-w-4xl h-full">
          <ProcurementCategoryGrid
            categories={sorted}
            isLoading={isLoading}
            selectedId={selectedId}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />
          </div>
        </div>

        {selectedId !== null && (
          <div className="w-[400px] shrink-0 border-l border-border overflow-hidden">
            <ProcurementCategorySheet
              categoryId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      <ProcurementCategoryCreateModal
        open={createModalOpen}
        nextDisplayOrder={nextDisplayOrder}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(newId) => {
          setCreateModalOpen(false);
          setSelectedId(newId);
        }}
      />
    </ConfigurationPageChrome>
  );
}
