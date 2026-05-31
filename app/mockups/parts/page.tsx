"use client";

import { useState, useMemo } from "react";
import {
  MOCK_PARTS,
  MockPart,
  MockPartAuditEntry,
} from "./_data";
import type { ColumnId } from "./_lib/columns";
import { ALL_COLUMNS } from "./_lib/columns";
import type { Filter } from "./_lib/filter-engine";
import { applyFilters } from "./_lib/filter-engine";
import { SEEDED_VIEWS, type View } from "./_lib/views";
import PartsGrid from "./_components/parts-grid";
import ViewSwitcher from "./_components/view-switcher";
import ColumnsButton from "./_components/columns-button";
import PartFormSheet from "./_components/part-form-sheet";
import ProcessTypeLegend from "@/app/mockups/routing-templates/_components/process-type-legend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_VIEW = SEEDED_VIEWS.find((v) => v.isDefault)!;

export default function PartsPage() {
  const [parts, setParts] = useState<MockPart[]>(MOCK_PARTS);
  const [activeView, setActiveView] = useState<View>(DEFAULT_VIEW);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<ColumnId>(DEFAULT_VIEW.defaultSort.columnId);
  const [sortAsc, setSortAsc] = useState(DEFAULT_VIEW.defaultSort.direction === "asc");
  const [selectedPart, setSelectedPart] = useState<MockPart | null>(null);
  const [condensed, setCondensed] = useState(true);

  // Active filters — start from view's saved filters; ad-hoc changes update this array.
  const [activeFilters, setActiveFilters] = useState<Filter[]>(DEFAULT_VIEW.filters);

  // Session-level column visibility override — null means "use the view's columns".
  const [sessionColumns, setSessionColumns] = useState<ColumnId[] | null>(null);

  const actorName = "Jane Chen";

  // ── Derived visible columns ──────────────────────────────────────────────────
  const visibleColumns = sessionColumns ?? activeView.visibleColumns;

  // ── Sort handlers ────────────────────────────────────────────────────────────

  function handleSort(col: ColumnId) {
    if (sortCol === col) setSortAsc((p) => !p);
    else { setSortCol(col); setSortAsc(true); }
  }

  function handleSortDir(col: ColumnId, asc: boolean) {
    setSortCol(col);
    setSortAsc(asc);
  }

  function handleClearSort() {
    setSortCol(activeView.defaultSort.columnId);
    setSortAsc(activeView.defaultSort.direction === "asc");
  }

  // ── View change ──────────────────────────────────────────────────────────────

  function handleViewChange(v: View) {
    setActiveView(v);
    setSortCol(v.defaultSort.columnId);
    setSortAsc(v.defaultSort.direction === "asc");
    // Replace active filters with the view's saved filters (clears ad-hoc)
    setActiveFilters(v.filters);
    // Reset session column overrides so the view's column set takes effect
    setSessionColumns(null);
  }

  // ── Filter handlers ──────────────────────────────────────────────────────────

  function handleApplyFilter(filter: Filter) {
    setActiveFilters((prev) => {
      const without = prev.filter((f) => f.columnId !== filter.columnId);
      return [...without, filter];
    });
  }

  function handleRemoveFilter(col: ColumnId) {
    setActiveFilters((prev) => prev.filter((f) => f.columnId !== col));
  }

  // ── Column visibility handlers ───────────────────────────────────────────────

  function handleHideColumn(col: ColumnId) {
    const base = sessionColumns ?? activeView.visibleColumns;
    setSessionColumns(base.filter((c) => c !== col));
  }

  function handleToggleColumn(col: ColumnId) {
    const base = sessionColumns ?? activeView.visibleColumns;
    if (base.includes(col)) {
      setSessionColumns(base.filter((c) => c !== col));
    } else {
      // Re-insert in the canonical ALL_COLUMNS order
      const allIds = ALL_COLUMNS.map((c) => c.id);
      const withCol = [...base, col];
      setSessionColumns(allIds.filter((id) => withCol.includes(id)));
    }
  }

  // ── Inline edit handlers ─────────────────────────────────────────────────────

  function handleUpdateStock(partId: number, stockCount: number) {
    setParts((prev) =>
      prev.map((p) => {
        if (p.partId !== partId) return p;
        const entry: MockPartAuditEntry = {
          timestamp: new Date().toISOString(),
          userName: actorName,
          action: "PartUpdated",
          changedFields: [
            { field: "stockCount", before: p.stockCount.toString(), after: stockCount.toString() },
          ],
        };
        return { ...p, stockCount, auditLog: [entry, ...p.auditLog] };
      })
    );
    if (selectedPart?.partId === partId) {
      setSelectedPart((prev) => prev ? { ...prev, stockCount } : null);
    }
  }

  function handleUpdateLocation(partId: number, inventoryLocation: string) {
    const loc = inventoryLocation.trim() || null;
    setParts((prev) =>
      prev.map((p) => {
        if (p.partId !== partId) return p;
        const entry: MockPartAuditEntry = {
          timestamp: new Date().toISOString(),
          userName: actorName,
          action: "PartUpdated",
          changedFields: [
            { field: "inventoryLocation", before: p.inventoryLocation, after: loc },
          ],
        };
        return { ...p, inventoryLocation: loc, auditLog: [entry, ...p.auditLog] };
      })
    );
    if (selectedPart?.partId === partId) {
      setSelectedPart((prev) => prev ? { ...prev, inventoryLocation: loc } : null);
    }
  }

  function handleUpdate(updated: MockPart) {
    setParts((prev) => prev.map((p) => (p.partId === updated.partId ? updated : p)));
    setSelectedPart(updated);
  }

  // ── Filtered + sorted parts ──────────────────────────────────────────────────

  const displayed = useMemo(() => {
    // 1. Apply column-level filters
    let result = applyFilters(parts, activeFilters);

    // 2. Apply global text search (part number or name)
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(s) ||
          p.partName.toLowerCase().includes(s)
      );
    }

    // 3. Sort
    result = [...result].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortCol) {
        case "partNumber":
          return dir * a.partNumber.localeCompare(b.partNumber);
        case "partName":
          return dir * a.partName.localeCompare(b.partName);
        case "material": {
          const ma = a.materialSpec?.materialName ?? "";
          const mb = b.materialSpec?.materialName ?? "";
          return dir * ma.localeCompare(mb);
        }
        case "vendor": {
          const va = a.defaultVendor?.vendorName ?? "";
          const vb = b.defaultVendor?.vendorName ?? "";
          return dir * va.localeCompare(vb);
        }
        case "stockCount":
          return dir * (a.stockCount - b.stockCount);
        case "location": {
          const la = a.inventoryLocation ?? "";
          const lb = b.inventoryLocation ?? "";
          return dir * la.localeCompare(lb);
        }
        case "cost": {
          const ca = a.cost ?? -Infinity;
          const cb = b.cost ?? -Infinity;
          return dir * (ca - cb);
        }
        case "costLastUpdated": {
          const da = a.costLastUpdated ?? "";
          const db = b.costLastUpdated ?? "";
          return dir * da.localeCompare(db);
        }
        case "assembliesUsedInCount":
          return dir * (a.assembliesUsedInCount - b.assembliesUsedInCount);
        default:
          return 0;
      }
    });

    return result;
  }, [parts, activeFilters, search, sortCol, sortAsc]);

  const hasActiveFilters = activeFilters.length > 0 || search.trim() !== "";
  const activeCount = parts.filter((p) => p.isActive).length;
  const inactiveCount = parts.filter((p) => !p.isActive).length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — Parts Master Configuration Grid</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Parts</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCount} active
              {inactiveCount > 0 && `, ${inactiveCount} inactive`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="search"
              placeholder="Search part number or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-64 text-xs"
            />
            <Button>
              <span className="text-base leading-none">+</span>
              Add Part
            </Button>
          </div>
        </div>
      </div>

      {/* View switcher + Columns button row */}
      <div className="border-b border-border bg-muted/20 px-8 py-2.5">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            View
          </span>
          <ViewSwitcher
            views={SEEDED_VIEWS}
            activeView={activeView}
            onViewChange={handleViewChange}
          />
          <div className="ml-auto flex items-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setActiveFilters(activeView.filters);
                  setSearch("");
                }}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
            <ColumnsButton
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
            />
          </div>
        </div>
      </div>

      {/* ProcessType legend + Condense toggle */}
      <div className="relative">
        <ProcessTypeLegend />
        <div className="absolute right-8 top-3 flex items-center gap-2">
          <Label
            htmlFor="parts-condense"
            className="cursor-pointer font-normal text-sm text-muted-foreground"
          >
            Condense
          </Label>
          <Switch
            id="parts-condense"
            size="sm"
            checked={condensed}
            onCheckedChange={setCondensed}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-screen-2xl px-8 py-6">
        {displayed.length === 0 && !hasActiveFilters ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">
              No parts found. Add your first part to get started.
            </p>
            <Button className="mt-4">
              <span className="text-base leading-none">+</span>
              Add Part
            </Button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-muted-foreground">No parts match the current filters.</p>
            <button
              type="button"
              onClick={() => { setActiveFilters(activeView.filters); setSearch(""); }}
              className="mt-2 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <PartsGrid
            parts={displayed}
            allParts={parts}
            visibleColumns={visibleColumns}
            sortCol={sortCol}
            sortAsc={sortAsc}
            activeFilters={activeFilters}
            onSort={handleSort}
            onSortDir={handleSortDir}
            onClearSort={handleClearSort}
            onHideColumn={handleHideColumn}
            onApplyFilter={handleApplyFilter}
            onRemoveFilter={handleRemoveFilter}
            onRowClick={setSelectedPart}
            onUpdateStock={handleUpdateStock}
            onUpdateLocation={handleUpdateLocation}
            condensed={condensed}
          />
        )}
      </div>

      {/* Part Form Sheet */}
      {selectedPart !== null && (
        <PartFormSheet
          part={selectedPart}
          actorName={actorName}
          onClose={() => setSelectedPart(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
