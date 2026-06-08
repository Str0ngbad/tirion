'use client';

import { useState, useMemo } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useMaterialSpecs, useCreateMaterialSpec } from '@/lib/api/material-specs';
import { MaterialSpecGrid, type SortKey } from './_components/material-spec-grid';
import { MaterialSpecSheet } from './_components/material-spec-sheet';
import { MaterialSpecCascadeModal } from '@/components/material-specs/material-spec-cascade-modal';
import type { MaterialSpecRow } from '@/lib/api/material-specs';
import { ApiError } from '@/lib/api/client-error';

function sortSpecs(specs: MaterialSpecRow[], key: SortKey, dir: 'asc' | 'desc'): MaterialSpecRow[] {
  return [...specs].sort((a, b) => {
    let cmp: number;
    if (key === 'usedByCount') {
      cmp = a.usedByCount - b.usedByCount;
    } else if (key === 'isActive') {
      cmp = (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1);
    } else {
      cmp = a[key].localeCompare(b[key]);
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

export default function MaterialSpecsPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('materialName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: specs = [], isLoading } = useMaterialSpecs({
    active: showInactive ? 'all' : 'true',
  });
  // Always load all specs for the cascade modal (needs all names/forms including inactive)
  const { data: allSpecs = [] } = useMaterialSpecs({ active: 'all' });

  const { mutate: create, isPending: isCreating } = useCreateMaterialSpec();

  const sorted = useMemo(() => sortSpecs(specs, sortKey, sortDir), [specs, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function handleCreateOrUseExisting(spec: MaterialSpecRow) {
    if (spec.materialSpecId !== 0) {
      // "Use Existing" path — spec already exists
      setCreateModalOpen(false);
      setSelectedId(spec.materialSpecId);
      return;
    }
    // New pair — call the API
    create(
      { materialName: spec.materialName, form: spec.form },
      {
        onSuccess: (created) => {
          setCreateModalOpen(false);
          setSelectedId(created.materialSpecId);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.errorCode === 'MATERIAL_SPEC_COLLISION') {
            // Race condition: pair was created between client check and server write.
            // Refresh list; the modal will show "Use Existing" on reopen.
            setCreateModalOpen(false);
          }
        },
      }
    );
  }

  return (
    <ConfigurationPageChrome
      title="Material Specs"
      count={specs.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Material Spec"
      onAdd={() => setCreateModalOpen(true)}
    >
      <div className="flex h-full min-h-0">
        <div className="w-[calc(100%-400px)] shrink-0 overflow-auto">
          <div className="max-w-md h-full">
            <MaterialSpecGrid
              specs={sorted}
              isLoading={isLoading}
              selectedId={selectedId}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            />
          </div>
        </div>

        <div className="w-[400px] shrink-0 border-l border-border h-full flex flex-col overflow-hidden">
          {selectedId === null ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a row to view details
            </div>
          ) : (
            <MaterialSpecSheet
              materialSpecId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      {createModalOpen && (
        <MaterialSpecCascadeModal
          mode="create"
          open={createModalOpen}
          existingSpecs={allSpecs}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreateOrUseExisting}
        />
      )}
    </ConfigurationPageChrome>
  );
}
