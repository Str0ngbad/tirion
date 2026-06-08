'use client';

import { cn } from '@/lib/utils';
import { ActiveIndicator } from '@/components/ui/active-indicator';
import type { MaterialSpecRow } from '@/lib/api/material-specs';

export type SortKey = 'isActive' | 'materialName' | 'form' | 'usedByCount';

interface MaterialSpecGridProps {
  specs: MaterialSpecRow[];
  isLoading: boolean;
  selectedId: number | null;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  onSelect: (id: number) => void;
}

function SortHeader({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeSortKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors',
        active && 'text-foreground',
        className
      )}
    >
      {label}
      <span className="text-[10px]">
        {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}

export function MaterialSpecGrid({
  specs,
  isLoading,
  selectedId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
}: MaterialSpecGridProps) {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (specs.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
        No material specs found.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 shrink-0">
        <div className="w-14 shrink-0 flex justify-center">
          <SortHeader
            label="Active"
            sortKey="isActive"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="flex-1 min-w-0">
          <SortHeader
            label="Material"
            sortKey="materialName"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="w-32 shrink-0">
          <SortHeader
            label="Form"
            sortKey="form"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="w-20 shrink-0">
          <SortHeader
            label="Used By"
            sortKey="usedByCount"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="justify-end"
          />
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {specs.map((spec) => (
          <button
            key={spec.materialSpecId}
            onClick={() => onSelect(spec.materialSpecId)}
            className={cn(
              'flex w-full items-center gap-3 border-b px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left',
              selectedId === spec.materialSpecId && 'bg-muted/70',
              !spec.isActive && 'opacity-40 hover:opacity-60'
            )}
          >
            <div className="w-14 shrink-0 flex justify-center">
              <ActiveIndicator active={spec.isActive} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="truncate font-medium">{spec.materialName}</span>
            </div>
            <div className="w-32 shrink-0 text-muted-foreground text-xs truncate">
              {spec.form}
            </div>
            <div className="w-20 shrink-0 text-right text-muted-foreground text-xs">
              {spec.usedByCount}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
