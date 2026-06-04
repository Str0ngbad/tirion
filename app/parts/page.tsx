"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PlusIcon, SearchIcon, AlertCircleIcon } from "lucide-react";
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
import {
  applyClientSort,
  type ColumnId,
} from "./_lib/columns";
import type { PartRowClient } from "@/lib/api/parts";
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

// ─── Sort toggle ──────────────────────────────────────────────────────────────

type SortState = { columnId: ColumnId; direction: "asc" | "desc" } | null;

function toggleSort(current: SortState, columnId: ColumnId): SortState {
  if (current?.columnId === columnId) {
    // asc → desc; desc stays desc (no clear via click)
    return current.direction === "asc"
      ? { columnId, direction: "desc" }
      : { columnId, direction: "desc" };
  }
  return { columnId, direction: "asc" };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PartsPage() {
  const viewsQuery = useViews();
  const views: ViewRow[] = viewsQuery.data ?? [];

  // Track active view ID — initialised when views first load.
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
  const [draftSort, setDraftSort] = useState<SortState>(null);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[] | null>(null);

  const isDirty = draftSort !== null || draftVisibleColumns !== null;

  const effectiveVisibleColumns: string[] =
    draftVisibleColumns ?? activeView?.visibleColumns ?? [];

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 200);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [condensed, setCondensed] = useState(true);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [viewManagementOpen, setViewManagementOpen] = useState(false);

  // Save as new input state
  const [saveAsMode, setSaveAsMode] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  // ── Grid data ──────────────────────────────────────────────────────────────
  const gridQuery = usePartsGrid(
    activeViewId !== null
      ? { viewId: activeViewId }
      : { filters: [], sort: [] }
  );

  // Apply client-side search filter and draft sort.
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

    if (draftSort) {
      rows = applyClientSort(rows, draftSort.columnId, draftSort.direction);
    }

    return rows;
  })();

  // ── View mutations ─────────────────────────────────────────────────────────
  const createView = useCreateView();
  const updateView = useUpdateView();
  const deleteView = useDeleteView();

  function handleSelectView(viewId: number) {
    setActiveViewId(viewId);
    setDraftSort(null);
    setDraftVisibleColumns(null);
    setSaveAsMode(false);
    setSaveAsName("");
  }

  function handleSave() {
    if (!activeView || activeView.isLocked || !activeViewId) return;
    const update: Parameters<typeof updateView.mutate>[0]["input"] = {};
    if (draftSort !== null) update.defaultSort = [{ column: draftSort.columnId, direction: draftSort.direction }];
    if (draftVisibleColumns !== null) update.visibleColumns = draftVisibleColumns;
    updateView.mutate(
      { id: activeViewId, input: update },
      {
        onSuccess: () => {
          setDraftSort(null);
          setDraftVisibleColumns(null);
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
        visibleColumns: effectiveVisibleColumns.length > 0 ? effectiveVisibleColumns : (activeView.visibleColumns),
        defaultSort: draftSort ? [{ column: draftSort.columnId, direction: draftSort.direction }] : activeView.defaultSort,
        filters: activeView.filters,
      },
      {
        onSuccess: (newView) => {
          setActiveViewId(newView.viewId);
          setDraftSort(null);
          setDraftVisibleColumns(null);
          setSaveAsMode(false);
          setSaveAsName("");
          toast.success(`View "${newView.name}" created`);
        },
        onError: (err) => toast.error(err.message),
      }
    );
  }

  function handleRevert() {
    setDraftSort(null);
    setDraftVisibleColumns(null);
    setSaveAsMode(false);
    setSaveAsName("");
  }

  function handleSortToggle(columnId: ColumnId) {
    setDraftSort((current) => toggleSort(current, columnId));
  }

  function handleSortSet(columnId: ColumnId, direction: "asc" | "desc") {
    setDraftSort({ columnId, direction });
  }

  function handleClearSort() {
    setDraftSort(null);
  }

  function handleHideColumn(columnId: ColumnId) {
    const base = effectiveVisibleColumns;
    setDraftVisibleColumns(base.filter((id) => id !== columnId));
  }

  function handleColumnToggle(columnId: ColumnId, visible: boolean) {
    const base = effectiveVisibleColumns;
    if (visible) {
      // Insert at its natural ALL_COLUMNS order position.
      const allIds = ["partNumber","partName","partType","procurementCategory","material","materialForm","vendor","vendorPartNumber","routing","buildableCount","stockCount","inventoryLocation","stockSize","blankLength","partCost","partCostUpdatedAt","assembliesUsedInCount","machineCycleTime","numberOfSetups","isActive"];
      const next = allIds.filter((id) => id === columnId || base.includes(id));
      setDraftVisibleColumns(next);
    } else {
      setDraftVisibleColumns(base.filter((id) => id !== columnId));
    }
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
                  className="h-8 pl-8 text-sm w-56"
                />
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

          <div className="ml-auto flex items-center gap-3">
            <CondenseToggle checked={condensed} onCheckedChange={setCondensed} />
            <ColumnsButton
              visibleColumns={effectiveVisibleColumns}
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
                sortState={draftSort}
                condensed={condensed}
                selectedPartId={selectedPartId}
                onSelectPart={setSelectedPartId}
                onSortToggle={handleSortToggle}
                onSortSet={handleSortSet}
                onClearSort={handleClearSort}
                onHideColumn={handleHideColumn}
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
