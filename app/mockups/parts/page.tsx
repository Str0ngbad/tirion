"use client";

import { useState, useMemo, useEffect } from "react";
import {
  MOCK_PARTS,
  MockPart,
  MockPartAuditEntry,
} from "./_data";
import type { ColumnId } from "./_lib/columns";
import { ALL_COLUMNS } from "./_lib/columns";
import type { Filter } from "./_lib/filter-engine";
import { applyFilters } from "./_lib/filter-engine";
import {
  SEEDED_VIEWS,
  type View,
  nextViewId,
  updateView,
  setDefaultView,
  deleteViewById,
  duplicateView,
} from "./_lib/views";
import { isViewDirty } from "./_lib/view-diff";
import PartsGrid from "./_components/parts-grid";
import ViewSwitcher from "./_components/view-switcher";
import ViewManagementModal from "./_components/view-management-modal";
import ColumnsButton from "./_components/columns-button";
import PartFormSheet, { SECTION_IDS, type SectionId } from "./_components/part-form-sheet";
import ProcessTypeLegend from "@/app/mockups/routing-templates/_components/process-type-legend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ─── Column → panel section mapping ──────────────────────────────────────────

const INLINE_EDIT_COLS = new Set<ColumnId>(["stockCount", "location"]);

const COLUMN_SECTION: Record<ColumnId, SectionId> = {
  partNumber: SECTION_IDS.header,
  partName: SECTION_IDS.header,
  partType: SECTION_IDS.header,
  procurement: SECTION_IDS.coreDetails,
  material: SECTION_IDS.materialVendor,
  materialForm: SECTION_IDS.materialVendor,
  vendor: SECTION_IDS.materialVendor,
  vendorPartNumber: SECTION_IDS.materialVendor,
  routing: SECTION_IDS.routing,
  stockCount: SECTION_IDS.inventory,   // inline edit — handled separately
  location: SECTION_IDS.inventory,     // inline edit — handled separately
  stockSize: SECTION_IDS.materialVendor,
  blankLength: SECTION_IDS.coreDetails,
  modelLink: SECTION_IDS.header,
  drawingLink: SECTION_IDS.header,
  binMin: SECTION_IDS.inventory,
  binMax: SECTION_IDS.inventory,
  cost: SECTION_IDS.materialVendor,
  costLastUpdated: SECTION_IDS.materialVendor,
  assembliesUsedInCount: SECTION_IDS.parents,
  machineCycleTime: SECTION_IDS.routing,
  numberOfSetups: SECTION_IDS.routing,
  active: SECTION_IDS.header,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const DEFAULT_VIEW = SEEDED_VIEWS.find((v) => v.isDefault)!;

export default function PartsPage() {
  const [parts, setParts] = useState<MockPart[]>(MOCK_PARTS);

  // ── Views state ──────────────────────────────────────────────────────────────

  const [viewsList, setViewsList] = useState<View[]>(() =>
    SEEDED_VIEWS.map((v) => ({ ...v }))
  );
  const [activeViewId, setActiveViewId] = useState<number>(DEFAULT_VIEW.viewId);

  const activeView = viewsList.find((v) => v.viewId === activeViewId) ?? viewsList[0]!;

  const [showManageViews, setShowManageViews] = useState(false);

  // ── Grid state ───────────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<ColumnId>(DEFAULT_VIEW.defaultSort.columnId);
  const [sortAsc, setSortAsc] = useState(DEFAULT_VIEW.defaultSort.direction === "asc");
  const [condensed, setCondensed] = useState(true);

  const [activeFilters, setActiveFilters] = useState<Filter[]>(DEFAULT_VIEW.filters);
  const [sessionColumns, setSessionColumns] = useState<ColumnId[] | null>(null);

  // ── Panel state ──────────────────────────────────────────────────────────────

  const [selectedPart, setSelectedPart] = useState<MockPart | null>(null);
  const [panelSection, setPanelSection] = useState<SectionId | null>(null);

  const actorName = "Jane Chen";

  // ── ESC key closes panel ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedPart) setSelectedPart(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedPart]);

  // ── Derived visible columns ──────────────────────────────────────────────────

  const visibleColumns = sessionColumns ?? activeView.visibleColumns;

  // ── Dirty state ──────────────────────────────────────────────────────────────

  const isDirty = useMemo(
    () =>
      isViewDirty(activeView, {
        visibleColumns,
        sort: { columnId: sortCol, direction: sortAsc ? "asc" : "desc" },
        filters: activeFilters,
      }),
    [activeView, visibleColumns, sortCol, sortAsc, activeFilters]
  );

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
    setActiveViewId(v.viewId);
    setSortCol(v.defaultSort.columnId);
    setSortAsc(v.defaultSort.direction === "asc");
    setActiveFilters(v.filters);
    setSessionColumns(null);
  }

  // ── View modification actions ────────────────────────────────────────────────

  function handleSaveOverwrite() {
    const updated: View = {
      ...activeView,
      visibleColumns,
      defaultSort: { columnId: sortCol, direction: sortAsc ? "asc" : "desc" },
      filters: activeFilters,
    };
    setViewsList((prev) => updateView(prev, updated));
    setSessionColumns(null);
  }

  function handleSaveAsNew(name: string) {
    const newView: View = {
      viewId: nextViewId(viewsList),
      name,
      isDefault: false,
      visibleColumns,
      defaultSort: { columnId: sortCol, direction: sortAsc ? "asc" : "desc" },
      filters: activeFilters,
    };
    setViewsList((prev) => [...prev, newView]);
    setActiveViewId(newView.viewId);
    setSessionColumns(null);
  }

  function handleRevert() {
    setSortCol(activeView.defaultSort.columnId);
    setSortAsc(activeView.defaultSort.direction === "asc");
    setActiveFilters(activeView.filters);
    setSessionColumns(null);
  }

  // ── Manage views modal handlers ──────────────────────────────────────────────

  function handleRename(viewId: number, name: string) {
    setViewsList((prev) => prev.map((v) => (v.viewId === viewId ? { ...v, name } : v)));
  }

  function handleSetDefault(viewId: number) {
    setViewsList((prev) => setDefaultView(prev, viewId));
  }

  function handleDuplicate(viewId: number) {
    setViewsList((prev) => duplicateView(prev, viewId));
  }

  function handleDelete(viewId: number) {
    const newList = deleteViewById(viewsList, viewId);
    setViewsList(newList);
    if (activeViewId === viewId) {
      const fallback = newList.find((v) => v.isDefault) ?? newList[0];
      if (fallback) {
        setActiveViewId(fallback.viewId);
        setSortCol(fallback.defaultSort.columnId);
        setSortAsc(fallback.defaultSort.direction === "asc");
        setActiveFilters(fallback.filters);
        setSessionColumns(null);
      }
    }
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

  // ── Row click handler ────────────────────────────────────────────────────────

  function handleRowClick(part: MockPart, col: ColumnId) {
    if (INLINE_EDIT_COLS.has(col)) return;
    const section = COLUMN_SECTION[col];
    if (selectedPart?.partId === part.partId) {
      // Same part — just scroll to the new section
      setPanelSection(section);
    } else {
      // New part — update and scroll
      setSelectedPart(part);
      setPanelSection(section);
    }
  }

  // ── Filtered + sorted parts ──────────────────────────────────────────────────

  const displayed = useMemo(() => {
    let result = applyFilters(parts, activeFilters);

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(s) ||
          p.partName.toLowerCase().includes(s)
      );
    }

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
  const panelOpen = selectedPart !== null;

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center shrink-0">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — Parts Master Configuration Grid</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header — clicking empty area closes panel */}
      <div
        className="border-b border-border px-8 py-5 shrink-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedPart(null);
        }}
      >
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

      {/* View switcher + Columns button row — clicking empty area closes panel */}
      <div
        className="border-b border-border bg-muted/20 px-8 py-2.5 shrink-0"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedPart(null);
        }}
      >
        <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
            View
          </span>
          <ViewSwitcher
            views={viewsList}
            activeView={activeView}
            isDirty={isDirty}
            onViewChange={handleViewChange}
            onSaveConfirmed={handleSaveOverwrite}
            onSaveAsNew={handleSaveAsNew}
            onRevert={handleRevert}
            onManageViews={() => setShowManageViews(true)}
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
      <div className="relative shrink-0">
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

      {/* Grid + Panel — push-grid layout */}
      <div className="flex flex-1 min-h-0">
        {/* Grid area */}
        <div className="flex-1 min-w-0 min-h-0 overflow-x-auto overflow-y-auto px-8 py-6">
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
              selectedPartId={selectedPart?.partId ?? null}
              onSort={handleSort}
              onSortDir={handleSortDir}
              onClearSort={handleClearSort}
              onHideColumn={handleHideColumn}
              onApplyFilter={handleApplyFilter}
              onRemoveFilter={handleRemoveFilter}
              onRowClick={handleRowClick}
              onUpdateStock={handleUpdateStock}
              onUpdateLocation={handleUpdateLocation}
              condensed={condensed}
            />
          )}
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="w-1/3 shrink-0 min-h-0 border-l border-border overflow-hidden">
            <PartFormSheet
              part={selectedPart}
              actorName={actorName}
              scrollToSectionId={panelSection}
              onClose={() => setSelectedPart(null)}
              onUpdate={handleUpdate}
            />
          </div>
        )}
      </div>

      {/* Manage Views modal */}
      <ViewManagementModal
        views={viewsList}
        open={showManageViews}
        onClose={() => setShowManageViews(false)}
        onRename={handleRename}
        onSetDefault={handleSetDefault}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />
    </div>
  );
}
