'use client';

import { useState, useMemo } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useVendors } from '@/lib/api/vendors';
import { VendorGrid } from './_components/vendor-grid';
import { VendorSheet } from './_components/vendor-sheet';
import { VendorCreateModal } from './_components/vendor-create-modal';
import type { VendorRow } from '@/lib/api/vendors';

type SortKey = 'vendorName' | 'location' | 'leadTimeDays' | 'defaultVendorForCount' | 'openSupplyOrderCount';

function sortVendors(vendors: VendorRow[], key: SortKey, dir: 'asc' | 'desc'): VendorRow[] {
  return [...vendors].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    let cmp: number;
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
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function VendorsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
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

  return (
    <ConfigurationPageChrome
      title="Vendors"
      count={vendors.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Vendor"
      onAdd={() => setCreateModalOpen(true)}
    >
      <div className="flex h-full min-h-0">
        <div className="w-[calc(100%-400px)] shrink-0 overflow-auto">
          <div className="max-w-4xl h-full">
            <VendorGrid
              vendors={sorted}
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
            <VendorSheet
              vendorId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      <VendorCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(newId) => {
          setCreateModalOpen(false);
          setSelectedId(newId);
        }}
      />
    </ConfigurationPageChrome>
  );
}
