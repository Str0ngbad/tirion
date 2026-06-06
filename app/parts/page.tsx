"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PlusIcon, SearchIcon, AlertCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { usePartsGrid, useUpdateStockCount, useUpdateInventoryLocation } from "@/lib/api/parts";
import {
  useViews,
  useCreateView,
  useUpdateView,
  useDeleteView,
} from "@/lib/api/views";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PartRowClient } from "@/lib/api/parts";
import { CondenseToggle } from "@/components/condense-toggle";
import ProcessTypeLegend from "@/app/routing-templates/_components/process-type-legend";
import PartsGrid from "./_components/parts-grid";
import ViewSwitcher from "./_components/view-switcher";
import ViewManagementModal from "./_components/view-management-modal";
import ColumnsButton from "./_components/columns-button";
import ActiveFiltersChrome from "./_components/active-filters-chrome";
import ActiveSortsChrome from "./_components/active-sorts-chrome";
import PartFormSheet, { SECTION_IDS, type SectionId } from "./_components/part-form-sheet";
import {
  applyClientSorts,
  type ColumnId,
} from "./_lib/columns";
import type { FilterObject, SortSpec } from "@/lib/views/types";
import type { ViewRow } from "@/lib/api/views";

// ─── Column → Sheet section mapping ──────────────────────────────────────────

const COLUMN_SECTION: Partial<Record<ColumnId, SectionId>> = {
  partNumber:            SECTION_IDS.description,
  partName:              SECTION_IDS.description,
  partType:              SECTION_IDS.description,
  isActive:              SECTION_IDS.description,
  procurementCategory:   SECTION_IDS.materialVendor,
  blankLength:           SECTION_IDS.materialVendor,
  material:              SECTION_IDS.materialVendor,
  materialForm:          SECTION_IDS.materialVendor,
  vendor:                SECTION_IDS.materialVendor,
  vendorPartNumber:      SECTION_IDS.materialVendor,
  stockSize:             SECTION_IDS.materialVendor,
  partCost:              SECTION_IDS.materialVendor,
  partCostUpdatedAt:     SECTION_IDS.materialVendor,
  routing:               SECTION_IDS.routing,
  machineCycleTime:      SECTION_IDS.routing,
  numberOfSetups:        SECTION_IDS.routing,
  stockCount:            SECTION_IDS.inventory,
  inventoryLocation:     SECTION_IDS.inventory,
  buildableCount:        SECTION_IDS.children,
  assembliesUsedInCount: SECTION_IDS.parents,
};

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Dirty detection helpers ──────────────────────────────────────────────────

function sortSpecsEqual(a: SortSpec[], b: SortSpec[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((s, i) => s.column === b[i]!.column && s.direction === b[i]!.direction);
}

function filterObjectsEqual(a: FilterObject[], b: FilterObject[]): boolean {
  if (a.length !== b.length) return false;
  // Sort by column so filter order doesn't matter for AND semantics.
  const sortedA = [...a].sort((x, y) => x.column.localeCompare(y.column));
  const sortedB = [...b].sort((x, y) => x.column.localeCompare(y.column));
  return sortedA.every((f, i) => JSON.stringify(f) === JSON.stringify(sortedB[i]));
}

function columnsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c === b[i]);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartsPage() {
  const viewsQuery = useViews();
  const views: ViewRow[] = viewsQuery.data ?? [];

  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current && views.length > 0) {
      const defaultView = views.find((v) => v.isDefault) ?? views[0]!;
      setActiveViewId(defaultView.viewId);
      initialised.current = true;
    }
  }, [views]);

  const activeView = views.find((v) => v.viewId === activeViewId) ?? null;

  // Draft overrides (null = no override, use view's saved state).
  const [draftSorts, setDraftSorts] = useState<SortSpec[] | null>(null);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[] | null>(null);
  const [draftFilters, setDraftFilters] = useState<FilterObject[] | null>(null);

  // Bidirectional dirty: compares current state against the View's saved state.
  // Manually returning to the saved state clears the dirty indicator.
  const isDirty = useMemo(() => {
    if (!activeView) return false;
    const currentSorts = draftSorts ?? activeView.defaultSort;
    const currentFilters = draftFilters ?? activeView.filters;
    const currentColumns = draftVisibleColumns ?? activeView.visibleColumns;
    return (
      !sortSpecsEqual(currentSorts, activeView.defaultSort) ||
      !filterObjectsEqual(currentFilters, activeView.filters) ||
      !columnsEqual(currentColumns, activeView.visibleColumns)
    );
  }, [activeView, draftSorts, draftFilters, draftVisibleColumns]);

  const effectiveVisibleColumns = useMemo<string[]>(
    () => draftVisibleColumns ?? activeView?.visibleColumns ?? [],
    [draftVisibleColumns, activeView]
  );

  const effectiveFilters = useMemo<FilterObject[]>(
    () => draftFilters ?? activeView?.filters ?? [],
    [draftFilters, activeView]
  );

  const effectiveSorts = useMemo<SortSpec[]>(
    () => draftSorts ?? activeView?.defaultSort ?? [],
    [draftSorts, activeView]
  );

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 200);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [condensed, setCondensed] = useState(true);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [panelSection, setPanelSection] = useState<SectionId | undefined>(undefined);
  const [viewManagementOpen, setViewManagementOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleNavigateToPart = useCallback((partId: number) => {
    setSelectedPartId(partId);
    setPanelSection(SECTION_IDS.description);
  }, []);

  const [saveAsMode, setSaveAsMode] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  // ── Collision dialog state ─────────────────────────────────────────────────
  type CollisionDialog = {
    location: string;
    collidingPart: PartRowClient;
    onConfirm: () => void;
    onCancel: () => void;
  };
  const [locationCollisionDialog, setLocationCollisionDialog] = useState<CollisionDialog | null>(null);

  // ── Grid data ──────────────────────────────────────────────────────────────
  // Explicit mode when draft overrides are present so changes take effect server-side.
  const gridQuery = usePartsGrid(
    activeViewId !== null && draftFilters === null && draftSorts === null
      ? { viewId: activeViewId }
      : { filters: effectiveFilters, sort: effectiveSorts }
  );

  const displayRows = useMemo(() => {
    let rows: PartRowClient[] = gridQuery.data ?? [];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.partNumber.toLowerCase().includes(q) ||
          r.partName.toLowerCase().includes(q)
      );
    }

    // Client-side sort only when in viewId mode (explicit mode sorts server-side)
    if (draftSorts !== null && draftFilters === null && draftSorts.length > 0) {
      rows = applyClientSorts(
        rows,
        draftSorts.map((s) => ({ columnId: s.column as ColumnId, direction: s.direction }))
      );
    }

    return rows;
  }, [gridQuery.data, search, draftSorts, draftFilters]);

  // ── Inline edit mutations ──────────────────────────────────────────────────
  const updateStockCount = useUpdateStockCount();
  const updateInventoryLocation = useUpdateInventoryLocation();

  const handleStockCountChange = useCallback((partId: number, value: number) => {
    updateStockCount.mutate({ partId, stockCount: value }, {
      onError: () => toast.error("Failed to update stock count."),
    });
  }, [updateStockCount]);

  const handleInventoryLocationChange = useCallback(async (partId: number, location: string | null) => {
    if (location !== null && location.length > 0) {
      const allParts = gridQuery.data;
      const collision = allParts?.find(
        (r) => r.partId !== partId && r.inventoryLocation === location && r.isActive
      );
      if (collision) {
        const confirmed = await new Promise<boolean>((resolve) => {
          setLocationCollisionDialog({
            location,
            collidingPart: collision,
            onConfirm: () => {
              setLocationCollisionDialog(null);
              resolve(true);
            },
            onCancel: () => {
              setLocationCollisionDialog(null);
              resolve(false);
            },
          });
        });
        if (!confirmed) return;
      }
    }
    updateInventoryLocation.mutate({ partId, inventoryLocation: location }, {
      onError: () => toast.error("Failed to update inventory location."),
    });
  }, [updateInventoryLocation, gridQuery.data]);

  // ── View mutations ─────────────────────────────────────────────────────────
  const createView = useCreateView();
  const updateView = useUpdateView();
  const deleteView = useDeleteView();

  function handleSelectView(viewId: number) {
    setActiveViewId(viewId);
    setDraftSorts(null);
    setDraftVisibleColumns(null);
    setDraftFilters(null);
    setSaveAsMode(false);
    setSaveAsName("");
  }

  function handleSave() {
    if (!activeView || activeView.isLocked || !activeViewId) return;
    const update: Parameters<typeof updateView.mutate>[0]["input"] = {};
    if (draftSorts !== null) update.defaultSort = draftSorts;
    if (draftVisibleColumns !== null) update.visibleColumns = draftVisibleColumns;
    if (draftFilters !== null) update.filters = draftFilters;
    updateView.mutate(
      { id: activeViewId, input: update },
      {
        onSuccess: () => {
          setDraftSorts(null);
          setDraftVisibleColumns(null);
          setDraftFilters(null);
          toast.success("View saved");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleSaveAsNew() {
    if (!activeView) return;
    const name = saveAsName.trim();
    if (!name) return;
    createView.mutate(
      {
        name,
        visibleColumns: effectiveVisibleColumns.length > 0 ? effectiveVisibleColumns : activeView.visibleColumns,
        defaultSort: draftSorts ?? activeView.defaultSort,
        filters: effectiveFilters,
      },
      {
        onSuccess: (newView) => {
          setActiveViewId(newView.viewId);
          setDraftSorts(null);
          setDraftVisibleColumns(null);
          setDraftFilters(null);
          setSaveAsMode(false);
          setSaveAsName("");
          toast.success(`View "${newView.name}" created`);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleRevert() {
    setDraftSorts(null);
    setDraftVisibleColumns(null);
    setDraftFilters(null);
    setSaveAsMode(false);
    setSaveAsName("");
  }

  const handleSortToggle = useCallback((columnId: ColumnId, addToStack: boolean) => {
    if (addToStack) {
      setDraftSorts((current) => {
        const base = current ?? effectiveSorts;
        const existing = base.find((s) => s.column === columnId);
        if (existing) {
          return base.map((s) =>
            s.column === columnId
              ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
              : s
          );
        }
        return [...base, { column: columnId, direction: "asc" }];
      });
    } else {
      setDraftSorts((current) => {
        const base = current ?? effectiveSorts;
        const existing = base.find((s) => s.column === columnId);
        if (existing && base.length === 1) {
          return [{ column: columnId, direction: existing.direction === "asc" ? "desc" : "asc" }];
        }
        return [{ column: columnId, direction: "asc" }];
      });
    }
  }, [effectiveSorts]);

  const handleSortSet = useCallback((columnId: ColumnId, direction: "asc" | "desc") => {
    setDraftSorts([{ column: columnId, direction }]);
  }, []);

  const handleAddToSort = useCallback((columnId: ColumnId) => {
    setDraftSorts((current) => {
      const base = current ?? effectiveSorts;
      const existing = base.find((s) => s.column === columnId);
      if (existing) {
        return base.map((s) =>
          s.column === columnId
            ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
            : s
        );
      }
      return [...base, { column: columnId, direction: "asc" }];
    });
  }, [effectiveSorts]);

  const handleClearThisSort = useCallback((columnId: ColumnId) => {
    setDraftSorts((current) => {
      const base = current ?? effectiveSorts;
      return base.filter((s) => s.column !== columnId);
    });
  }, [effectiveSorts]);

  const handleReorderSorts = useCallback((sorts: SortSpec[]) => {
    setDraftSorts(sorts);
  }, []);

  const handleToggleSortDirection = useCallback((column: string) => {
    setDraftSorts((current) => {
      const base = current ?? effectiveSorts;
      return base.map((s) =>
        s.column === column
          ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
          : s
      );
    });
  }, [effectiveSorts]);

  const handleHideColumn = useCallback((columnId: ColumnId) => {
    setDraftVisibleColumns((current) => {
      const base = current ?? effectiveVisibleColumns;
      return base.filter((id) => id !== columnId);
    });
  }, [effectiveVisibleColumns]);

  const handleColumnToggle = useCallback((columnId: ColumnId, visible: boolean) => {
    setDraftVisibleColumns((current) => {
      const base = current ?? effectiveVisibleColumns;
      if (visible) {
        const allIds = ["partNumber","partName","partType","procurementCategory","material","materialForm","vendor","vendorPartNumber","routing","buildableCount","stockCount","inventoryLocation","stockSize","blankLength","partCost","partCostUpdatedAt","assembliesUsedInCount","machineCycleTime","numberOfSetups","isActive"];
        return allIds.filter((id) => id === columnId || base.includes(id));
      }
      return base.filter((id) => id !== columnId);
    });
  }, [effectiveVisibleColumns]);

  const handleApplyFilter = useCallback((filter: FilterObject) => {
    setDraftFilters((current) => {
      const base = current ?? effectiveFilters;
      const idx = base.findIndex((f) => f.column === filter.column);
      return idx >= 0
        ? base.map((f, i) => (i === idx ? filter : f))
        : [...base, filter];
    });
  }, [effectiveFilters]);

  const handleRemoveFilter = useCallback((column: string) => {
    setDraftFilters((current) => {
      const base = current ?? effectiveFilters;
      return base.filter((f) => f.column !== column);
    });
  }, [effectiveFilters]);

  function handleRenameView(viewId: number, newName: string) {
    updateView.mutate(
      { id: viewId, input: { name: newName } },
      {
        onSuccess: () => toast.success("View renamed"),
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleDeleteView(viewId: number) {
    deleteView.mutate(viewId, {
      onSuccess: () => {
        if (activeViewId === viewId) {
          const fallback = views.find((v) => v.viewId !== viewId && v.isDefault);
          if (fallback) setActiveViewId(fallback.viewId);
        }
        toast.success("View deleted");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLoading = gridQuery.isLoading || viewsQuery.isLoading;
  const hasError = gridQuery.isError || viewsQuery.isError;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Page header */}
      <div className="border-b bg-background">
        <div className="mx-auto max-w-7xl px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Parts</h1>
              <p className="text-sm text-muted-foreground">
                {gridQuery.data ? `${gridQuery.data.length.toLocaleString()} parts` : "Parts library"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search parts…"
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  className="h-8 pl-8 pr-7 text-sm w-56"
                />
                {searchRaw.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchRaw("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Button size="sm" disabled className="gap-1.5 text-sm">
                <PlusIcon className="h-3.5 w-3.5" />
                Add Part
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b bg-muted/20 px-8 py-2.5">
        <div className="mx-auto max-w-7xl flex items-start gap-4">

          {/* Left: View switcher — dirty actions stack below when dirty */}
          <div className="shrink-0 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <ViewSwitcher
                views={views}
                activeViewId={activeViewId}
                isDirty={isDirty}
                onSelectView={handleSelectView}
                onOpenManage={() => setViewManagementOpen(true)}
              />
            </div>

            {isDirty && !saveAsMode && (
              <div className="flex items-center gap-1">
                {activeView && !activeView.isLocked && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleSave}
                    disabled={updateView.isPending}
                  >
                    Save
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setSaveAsMode(true)}
                >
                  Save as new
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleRevert}
                >
                  Revert
                </Button>
              </div>
            )}

            {saveAsMode && (
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  placeholder="View name…"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveAsNew();
                    if (e.key === "Escape") {
                      setSaveAsMode(false);
                      setSaveAsName("");
                    }
                  }}
                  className="h-7 w-40 text-xs"
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleSaveAsNew}
                  disabled={!saveAsName.trim() || createView.isPending}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSaveAsMode(false);
                    setSaveAsName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Middle: Active Sorts + Active Filters chrome groups — always rendered */}
          <div className="flex-1 flex items-start gap-4 min-w-0">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-none">
                Active Sorts
              </span>
              {effectiveSorts.length > 0 ? (
                <ActiveSortsChrome
                  sorts={effectiveSorts}
                  viewSorts={activeView?.defaultSort ?? []}
                  onReorderSorts={handleReorderSorts}
                  onToggleDirection={handleToggleSortDirection}
                  onRemoveSort={(column) => handleClearThisSort(column as ColumnId)}
                />
              ) : (
                <span className="text-xs text-muted-foreground/60 italic">No active sorts</span>
              )}
            </div>

            <div className="w-px self-stretch bg-border mt-4 shrink-0" />

            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium leading-none">
                Active Filters
              </span>
              {effectiveFilters.length > 0 ? (
                <ActiveFiltersChrome
                  filters={effectiveFilters}
                  viewFilters={activeView?.filters ?? []}
                  onRemoveFilter={handleRemoveFilter}
                />
              ) : (
                <span className="text-xs text-muted-foreground/60 italic">No active filters</span>
              )}
            </div>
          </div>

          {/* Right: Columns picker */}
          <div className="shrink-0 flex items-center gap-2 ml-auto pt-0.5">
            <ColumnsButton
              visibleColumns={effectiveVisibleColumns}
              activeFilters={effectiveFilters}
              onChange={handleColumnToggle}
            />
          </div>

        </div>
      </div>

      {/* Process type legend — Condense toggle anchored to its right edge */}
      <ProcessTypeLegend
        rightSlot={<CondenseToggle checked={condensed} onCheckedChange={setCondensed} />}
      />

      {/* Error banner */}
      {hasError && (
        <div className="mx-auto w-full max-w-7xl px-8 pt-4">
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircleIcon className="h-4 w-4 shrink-0" />
            <span>Failed to load parts data.</span>
            <button
              className="ml-auto font-medium underline"
              onClick={() => {
                gridQuery.refetch();
                viewsQuery.refetch();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Grid area — scrolls internally; everything above is anchored */}
      <div className="relative flex flex-1 overflow-hidden">
        <div ref={scrollContainerRef} className="flex-1 overflow-auto px-8 pb-4">
          <div className="mx-auto max-w-7xl">
            {isLoading ? (
              <div className="space-y-2 pt-2">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : displayRows.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No parts found.
              </div>
            ) : (
              <PartsGrid
                rows={displayRows}
                visibleColumns={effectiveVisibleColumns}
                sorts={effectiveSorts}
                condensed={condensed}
                selectedPartId={selectedPartId}
                filters={effectiveFilters}
                scrollContainerRef={scrollContainerRef}
                onSelectPart={(partId) => {
                  setSelectedPartId(partId);
                  setPanelSection(undefined);
                }}
                onStockCountChange={handleStockCountChange}
                onInventoryLocationChange={handleInventoryLocationChange}
                onSortToggle={handleSortToggle}
                onSortSet={handleSortSet}
                onAddToSort={handleAddToSort}
                onClearThisSort={handleClearThisSort}
                onHideColumn={handleHideColumn}
                onApplyFilter={handleApplyFilter}
                onRemoveFilter={handleRemoveFilter}
              />
            )}
          </div>
        </div>

        {/* Part Form Sheet — inline flex sibling so it sits below sticky chrome */}
        {selectedPartId !== null && (() => {
          const part = displayRows.find((r) => r.partId === selectedPartId);
          if (!part) return null;
          return (
            <div className="w-[480px] shrink-0 border-l bg-background flex flex-col overflow-hidden">
              <PartFormSheet
                key={part.partId}
                part={part}
                initialSection={panelSection}
                onClose={() => setSelectedPartId(null)}
                onUpdate={() => {
                  // Optimistic update applied by mutation; grid refetches on settle.
                }}
                onNavigateToPart={handleNavigateToPart}
              />
            </div>
          );
        })()}
      </div>

      {locationCollisionDialog && (
        <Dialog open onOpenChange={() => locationCollisionDialog.onCancel()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Location already assigned</DialogTitle>
              <DialogDescription>
                The location <strong>{locationCollisionDialog.location}</strong> is currently
                assigned to{" "}
                <strong>{locationCollisionDialog.collidingPart.partNumber}</strong> (
                {locationCollisionDialog.collidingPart.partName}). You can assign both
                Parts to this location, but confirm this is intentional.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={locationCollisionDialog.onCancel}>
                Cancel
              </Button>
              <Button onClick={locationCollisionDialog.onConfirm}>Assign anyway</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ViewManagementModal
        open={viewManagementOpen}
        onClose={() => setViewManagementOpen(false)}
        views={views}
        activeViewId={activeViewId}
        onRename={handleRenameView}
        onDelete={handleDeleteView}
      />
    </div>
  );
}
