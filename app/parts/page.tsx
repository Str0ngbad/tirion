"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PlusIcon, SearchIcon, AlertCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { usePartsGrid } from "@/lib/api/parts";
import {
  useViews,
  useCreateView,
  useUpdateView,
  useDeleteView,
} from "@/lib/api/views";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CondenseToggle } from "@/components/condense-toggle";
import ProcessTypeLegend from "@/app/routing-templates/_components/process-type-legend";
import PartsGrid from "./_components/parts-grid";
import ViewSwitcher from "./_components/view-switcher";
import ViewManagementModal from "./_components/view-management-modal";
import ColumnsButton from "./_components/columns-button";
import ActiveFiltersChrome from "./_components/active-filters-chrome";
import ActiveSortsChrome from "./_components/active-sorts-chrome";
import {
  applyClientSorts,
  type ColumnId,
} from "./_lib/columns";
import type { PartRowClient } from "@/lib/api/parts";
import type { FilterObject, SortSpec } from "@/lib/views/types";
import type { ViewRow } from "@/lib/api/views";

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
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

  const isDirty = draftSorts !== null || draftVisibleColumns !== null || draftFilters !== null;

  const effectiveVisibleColumns: string[] =
    draftVisibleColumns ?? activeView?.visibleColumns ?? [];

  const effectiveFilters: FilterObject[] =
    draftFilters ?? activeView?.filters ?? [];

  const effectiveSorts: SortSpec[] =
    draftSorts ?? activeView?.defaultSort ?? [];

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 200);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [condensed, setCondensed] = useState(true);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [viewManagementOpen, setViewManagementOpen] = useState(false);

  const [saveAsMode, setSaveAsMode] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  // ── Grid data ──────────────────────────────────────────────────────────────
  // Explicit mode when draft overrides are present so changes take effect server-side.
  const gridQuery = usePartsGrid(
    activeViewId !== null && draftFilters === null && draftSorts === null
      ? { viewId: activeViewId }
      : { filters: effectiveFilters, sort: effectiveSorts }
  );

  const displayRows = (() => {
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
  })();

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

  function handleSortToggle(columnId: ColumnId, addToStack: boolean) {
    if (addToStack) {
      // Shift-click: add to stack or toggle direction if already present.
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
      // Plain click: replace stack (or toggle direction if already the only sort).
      setDraftSorts((current) => {
        const base = current ?? effectiveSorts;
        const existing = base.find((s) => s.column === columnId);
        if (existing && base.length === 1) {
          return [{ column: columnId, direction: existing.direction === "asc" ? "desc" : "asc" }];
        }
        return [{ column: columnId, direction: "asc" }];
      });
    }
  }

  function handleSortSet(columnId: ColumnId, direction: "asc" | "desc") {
    setDraftSorts([{ column: columnId, direction }]);
  }

  function handleAddToSort(columnId: ColumnId) {
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
  }

  function handleClearThisSort(columnId: ColumnId) {
    setDraftSorts((current) => {
      const base = current ?? effectiveSorts;
      const next = base.filter((s) => s.column !== columnId);
      return next;
    });
  }

  function handleReorderSorts(sorts: SortSpec[]) {
    setDraftSorts(sorts);
  }

  function handleToggleSortDirection(column: string) {
    setDraftSorts((current) => {
      const base = current ?? effectiveSorts;
      return base.map((s) =>
        s.column === column
          ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
          : s
      );
    });
  }

  function handleHideColumn(columnId: ColumnId) {
    const base = effectiveVisibleColumns;
    setDraftVisibleColumns(base.filter((id) => id !== columnId));
  }

  function handleColumnToggle(columnId: ColumnId, visible: boolean) {
    const base = effectiveVisibleColumns;
    if (visible) {
      const allIds = ["partNumber","partName","partType","procurementCategory","material","materialForm","vendor","vendorPartNumber","routing","buildableCount","stockCount","inventoryLocation","stockSize","blankLength","partCost","partCostUpdatedAt","assembliesUsedInCount","machineCycleTime","numberOfSetups","isActive"];
      const next = allIds.filter((id) => id === columnId || base.includes(id));
      setDraftVisibleColumns(next);
    } else {
      setDraftVisibleColumns(base.filter((id) => id !== columnId));
    }
  }

  function handleApplyFilter(filter: FilterObject) {
    const base = effectiveFilters;
    const idx = base.findIndex((f) => f.column === filter.column);
    const next = idx >= 0
      ? base.map((f, i) => (i === idx ? filter : f))
      : [...base, filter];
    setDraftFilters(next);
  }

  function handleRemoveFilter(column: string) {
    const next = effectiveFilters.filter((f) => f.column !== column);
    setDraftFilters(next);
  }

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
    <div className="flex h-full flex-col">
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
        <div className="mx-auto max-w-7xl flex items-center gap-3 flex-wrap">
          <ViewSwitcher
            views={views}
            activeViewId={activeViewId}
            isDirty={isDirty}
            onSelectView={handleSelectView}
            onOpenManage={() => setViewManagementOpen(true)}
          />

          {isDirty && !saveAsMode && (
            <div className="flex items-center gap-2">
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

          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <ActiveSortsChrome
              sorts={effectiveSorts}
              viewSorts={activeView?.defaultSort ?? []}
              onReorderSorts={handleReorderSorts}
              onToggleDirection={handleToggleSortDirection}
              onRemoveSort={(column) => handleClearThisSort(column as ColumnId)}
            />
            <ActiveFiltersChrome
              filters={effectiveFilters}
              viewFilters={activeView?.filters ?? []}
              onRemoveFilter={handleRemoveFilter}
            />
            <CondenseToggle checked={condensed} onCheckedChange={setCondensed} />
            <ColumnsButton
              visibleColumns={effectiveVisibleColumns}
              activeFilters={effectiveFilters}
              onChange={handleColumnToggle}
            />
          </div>
        </div>
      </div>

      {/* Process type legend */}
      <ProcessTypeLegend />

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

      {/* Grid area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto px-8 py-4">
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
                onSelectPart={setSelectedPartId}
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

        {/* Part Form Sheet placeholder */}
        <Sheet
          open={selectedPartId !== null}
          onOpenChange={(open) => { if (!open) setSelectedPartId(null); }}
        >
          <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
            <SheetHeader>
              <SheetTitle>Part Details</SheetTitle>
            </SheetHeader>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Part form coming in Commit 6.
            </div>
          </SheetContent>
        </Sheet>
      </div>

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
