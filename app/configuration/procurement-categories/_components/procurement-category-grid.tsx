'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ProcurementCategoryRow } from '@/lib/api/procurement-categories';

type SortKey = 'categoryCode' | 'categoryName' | 'displayOrder' | 'usedByCount';

interface ProcurementCategoryGridProps {
  categories: ProcurementCategoryRow[];
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

export function ProcurementCategoryGrid({
  categories,
  isLoading,
  selectedId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
}: ProcurementCategoryGridProps) {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
        No procurement categories found.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 shrink-0">
        <div className="w-20 shrink-0">
          <SortHeader
            label="Code"
            sortKey="categoryCode"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="flex-1 min-w-0">
          <SortHeader
            label="Name"
            sortKey="categoryName"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="flex-1 min-w-0 hidden md:block">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Description
          </span>
        </div>
        <div className="w-16 shrink-0">
          <SortHeader
            label="Order"
            sortKey="displayOrder"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="justify-end"
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
        {categories.map((cat) => (
          <button
            key={cat.procurementCategoryId}
            onClick={() => onSelect(cat.procurementCategoryId)}
            className={cn(
              'flex w-full items-center gap-3 border-b px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left',
              selectedId === cat.procurementCategoryId && 'bg-muted/70',
              !cat.isActive && 'opacity-40'
            )}
          >
            <div className="w-20 shrink-0 font-mono text-xs">{cat.categoryCode}</div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="truncate font-medium">{cat.categoryName}</span>
              {!cat.isActive && (
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1 py-0">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="flex-1 min-w-0 hidden md:block">
              <span className="truncate text-muted-foreground text-xs">
                {cat.description ?? ''}
              </span>
            </div>
            <div className="w-16 shrink-0 text-right text-muted-foreground text-xs">
              {cat.displayOrder}
            </div>
            <div className="w-20 shrink-0 text-right text-muted-foreground text-xs">
              {cat.usedByCount}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
