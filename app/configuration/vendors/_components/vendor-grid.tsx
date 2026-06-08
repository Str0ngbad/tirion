'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { VendorRow } from '@/lib/api/vendors';

type SortKey = 'vendorName' | 'location' | 'leadTimeDays' | 'defaultVendorForCount' | 'openSupplyOrderCount';

interface VendorGridProps {
  vendors: VendorRow[];
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

export function VendorGrid({
  vendors,
  isLoading,
  selectedId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
}: VendorGridProps) {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
        No vendors found.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2 shrink-0">
        <div className="flex-1 min-w-0">
          <SortHeader
            label="Name"
            sortKey="vendorName"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="w-36 shrink-0 hidden md:block">
          <SortHeader
            label="Location"
            sortKey="location"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          />
        </div>
        <div className="w-24 shrink-0">
          <SortHeader
            label="Lead Time"
            sortKey="leadTimeDays"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="justify-end"
          />
        </div>
        <div className="w-24 shrink-0">
          <SortHeader
            label="Default For"
            sortKey="defaultVendorForCount"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="justify-end"
          />
        </div>
        <div className="w-20 shrink-0">
          <SortHeader
            label="Open SOs"
            sortKey="openSupplyOrderCount"
            activeSortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            className="justify-end"
          />
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {vendors.map((vendor) => (
          <button
            key={vendor.vendorId}
            onClick={() => onSelect(vendor.vendorId)}
            className={cn(
              'flex w-full items-start gap-3 border-b px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left',
              selectedId === vendor.vendorId && 'bg-muted/70',
              !vendor.isActive && 'opacity-40 hover:opacity-60'
            )}
          >
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="truncate font-medium">{vendor.vendorName}</span>
              {!vendor.isActive && (
                <Badge variant="secondary" className="shrink-0 text-[10px] px-1 py-0">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="w-36 shrink-0 hidden md:block text-muted-foreground text-xs truncate">
              {vendor.location ?? ''}
            </div>
            <div className="w-24 shrink-0 text-right text-muted-foreground text-xs">
              {vendor.leadTimeDays !== null ? `${vendor.leadTimeDays}d` : '—'}
            </div>
            <div className="w-24 shrink-0 text-right text-muted-foreground text-xs">
              {vendor.defaultVendorForCount}
            </div>
            <div className="w-20 shrink-0 text-right text-muted-foreground text-xs">
              {vendor.openSupplyOrderCount}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
