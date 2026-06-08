'use client';

import { useState, useMemo } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useVendors } from '@/lib/api/vendors';
import { VendorGrid } from './_components/vendor-grid';
import { VendorSheet } from './_components/vendor-sheet';
import type { VendorRow } from '@/lib/api/vendors';

type SortKey = 'isActive' | 'vendorName' | 'location' | 'leadTimeDays' | 'defaultVendorForCount' | 'openSupplyOrderCount';

type SheetState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; vendorId: number };

function sortVendors(vendors: VendorRow[], key: SortKey, dir: 'asc' | 'desc'): VendorRow[] {
  return [...vendors].sort((a, b) => {
    let cmp: number;
    if (key === 'isActive') {
      cmp = (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1);
    } else {
      const aVal = a[key];
      const bVal = b[key];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        cmp = aVal.localeCompare(bVal);
      } else if (aVal === null && bVal === null) {
        cmp = 0;
      } else if (aVal === null) {
        cmp = 1;
      } else if (bVal === null) {
        cmp = -1;
      } else {
        cmp = (aVal as number) - (bVal as number);
      }
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function VendorsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>({ type: 'closed' });
  const [sortKey, setSortKey] = useState<SortKey>('vendorName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: vendors = [], isLoading } = useVendors({
    active: showInactive ? 'all' : 'true',
  });

  const sorted = useMemo(
    () => sortVendors(vendors, sortKey, sortDir),
    [vendors, sortKey, sortDir]
  );

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const selectedId = sheetState.type === 'edit' ? sheetState.vendorId : null;

  return (
    <ConfigurationPageChrome
      title="Vendors"
      count={vendors.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Vendor"
      onAdd={() => setSheetState({ type: 'create' })}
    >
      <div className="flex h-full min-h-0">
        <div className="flex-1 min-w-0 overflow-auto">
          <div className="max-w-4xl h-full">
            <VendorGrid
              vendors={sorted}
              isLoading={isLoading}
              selectedId={selectedId}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onSelect={(id) =>
                setSheetState((prev) =>
                  prev.type === 'edit' && prev.vendorId === id
                    ? { type: 'closed' }
                    : { type: 'edit', vendorId: id }
                )
              }
            />
          </div>
        </div>

        <div className="w-[400px] shrink-0 border-l border-border min-h-0 h-full flex flex-col overflow-hidden">
          {sheetState.type === 'closed' ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground italic">
              Select a vendor to view details
            </div>
          ) : (
            <VendorSheet
              mode={
                sheetState.type === 'create'
                  ? { type: 'create' }
                  : { type: 'edit', vendorId: sheetState.vendorId }
              }
              onClose={() => setSheetState({ type: 'closed' })}
              onCreated={(newId) => setSheetState({ type: 'edit', vendorId: newId })}
            />
          )}
        </div>
      </div>
    </ConfigurationPageChrome>
  );
}
