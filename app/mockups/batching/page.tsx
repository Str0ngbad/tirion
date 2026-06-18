"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";

import {
  ALL_BT_WOS,
  INITIAL_SESSION_STATE,
  ROUTING_TEMPLATES,
  PROJECT_COLOR_MAP,
  type BtWorkOrder,
  type BtSessionState,
  type BtCandidateGroup,
  getDerivedRowValues,
  isEligibleTarget,
  getChipsInCell,
  moveChip,
  toggleLock,
  lockMultiple,
  unlockMultiple,
  resetPlannedToDemand,
  multiplyPlannedQty,
  addToPlannedQty,
  updatePlannedQty,
  confirmDraft,
  autoBatchCandidates,
  resetDraft,
} from "./_data";

import ProjectChip, {
  ProjectChipOverlay,
} from "@/app/mockups/_shared/project-chip";

// ─── View Mode ────────────────────────────────────────────────────────────────

type ViewMode = "All" | "Batching" | "QuantityPlanning";

// ─── Composition Cell (droppable) ─────────────────────────────────────────────

function CompositionCell({
  hostWoId,
  chips,
  isEligible,
  isDragActive,
  isCurrentDragHome,
  chipMovedAway,
  placementNoteTargetRef,
  onChipClick,
  onCellClick,
  selectedChipWoId,
  isEligibleForSelected,
  state,
  wos,
}: {
  hostWoId: number;
  chips: BtWorkOrder[];
  isEligible: boolean;
  isDragActive: boolean;
  isCurrentDragHome: boolean;
  chipMovedAway: boolean;
  placementNoteTargetRef: string | null;
  onChipClick: (woId: number) => void;
  onCellClick?: (hostWoId: number) => void;
  selectedChipWoId: number | null;
  isEligibleForSelected: boolean;
  state: BtSessionState;
  wos: BtWorkOrder[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${hostWoId}`,
    disabled: !isEligible && isDragActive,
    data: { hostWoId },
  });

  const showDropHighlight = isOver && isEligible;
  const showSelectHighlight = isEligibleForSelected && !isDragActive;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onCellClick?.(hostWoId)}
      className={[
        "flex flex-wrap gap-1 p-1 rounded min-h-[1.75rem] min-w-[130px] transition-colors items-center",
        showDropHighlight ? "bg-emerald-500/15 ring-1 ring-emerald-500/50" : "",
        showSelectHighlight ? "bg-sky-500/10 ring-1 ring-sky-500/50 cursor-pointer" : "",
        isEligible && isDragActive ? "ring-1 ring-border/50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {chipMovedAway && chips.length === 0 ? (
        <span className="text-[10px] text-muted-foreground italic leading-tight px-1">
          Drafted → {placementNoteTargetRef ?? "batch"}
        </span>
      ) : (
        chips.map((wo) => (
          <button
            key={wo.woId}
            onClick={() => onChipClick(wo.woId)}
            className={[
              "focus:outline-none rounded-full",
              selectedChipWoId === wo.woId
                ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <ProjectChip
              woId={wo.woId}
              projectNumber={wo.projectNumber}
              topLevelRef={wo.topLevelRef}
              demandQty={wo.quantity}
              color={wo.projectColor}
              isAtHome={state.chipHome[wo.woId] === hostWoId && wo.woId === hostWoId}
              isRoot={wo.woId === hostWoId}
              isAnchoredRoot={wo.woId === hostWoId && chips.length >= 2}
              disabled={isDragActive}
            />
          </button>
        ))
      )}
    </div>
  );
}

// ─── Routing pills ─────────────────────────────────────────────────────────────

function RoutingPills({ templateId }: { templateId: string }) {
  const tmpl = ROUTING_TEMPLATES[templateId];
  if (!tmpl) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tmpl.steps.map((step) => (
        <span
          key={step}
          className="inline-block rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {step}
        </span>
      ))}
    </div>
  );
}

// ─── Planned Qty input ────────────────────────────────────────────────────────

function PlannedQtyInput({
  hostWoId,
  demand,
  plannedQty,
  isLocked,
  onUpdate,
}: {
  hostWoId: number;
  demand: number;
  plannedQty: number | null;
  isLocked: boolean;
  onUpdate: (hostWoId: number, qty: number | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  // Only locked rows show Planned Qty
  if (!isLocked) {
    return <span className="text-muted-foreground/30 text-xs">—</span>;
  }

  const effectiveQty = plannedQty ?? demand;
  const isEdited = effectiveQty > demand;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val === "") {
      setError(null);
      onUpdate(hostWoId, demand); // empty → reset to demand
      return;
    }
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) {
      setError("Must be ≥ 0");
      return;
    }
    if (n < demand) {
      setError(`Min ${demand}`);
      onUpdate(hostWoId, demand); // clamp to demand
      return;
    }
    setError(null);
    onUpdate(hostWoId, n);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="number"
        min={demand}
        value={String(effectiveQty)}
        onChange={handleChange}
        className={[
          "w-16 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring",
          isEdited ? "text-[#0EA5E9] font-semibold" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}

// ─── Lock Toggle ──────────────────────────────────────────────────────────────

function LockToggle({
  isLocked,
  isDisabled,
  onToggle,
}: {
  isLocked: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      title={
        isDisabled
          ? "Chip moved away — will commit with destination batch"
          : isLocked
          ? "Locked — click to unlock (enables composition)"
          : "Unlocked — click to lock (enables quantity planning)"
      }
      className={[
        "flex items-center justify-center w-7 h-7 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
        isDisabled
          ? "opacity-20 cursor-not-allowed"
          : isLocked
          ? "text-foreground hover:bg-muted"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isLocked ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        <Unlock className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ─── Candidate Row ─────────────────────────────────────────────────────────────

function CandidateRow({
  wo,
  state,
  wos,
  isDragActive,
  activeChipWoId,
  isGreyedOut,
  onChipClick,
  onCellClick,
  selectedChipWoId,
  onToggleLock,
  onUpdatePlannedQty,
  isFirstInGroup,
  isSelected,
  onToggleSelect,
}: {
  wo: BtWorkOrder;
  state: BtSessionState;
  wos: BtWorkOrder[];
  isDragActive: boolean;
  activeChipWoId: number | null;
  isGreyedOut: boolean;
  onChipClick: (woId: number) => void;
  onCellClick: (hostWoId: number) => void;
  selectedChipWoId: number | null;
  onToggleLock: (hostWoId: number) => void;
  onUpdatePlannedQty: (hostWoId: number, qty: number | null) => void;
  isFirstInGroup: boolean;
  isSelected: boolean;
  onToggleSelect: (woId: number) => void;
}) {
  const derived = getDerivedRowValues(wo.woId, wos, state.chipHome);
  const isLocked = state.lockedWoIds.has(wo.woId);
  const isSourceRow = state.chipHome[wo.woId] !== wo.woId;
  const lockDisabled = isSourceRow;

  const chipMovedAway = isSourceRow;

  const homeChipHost = chipMovedAway ? state.chipHome[wo.woId] : null;
  const hostWo = homeChipHost ? wos.find((w) => w.woId === homeChipHost) : null;

  const chipsInCell = derived.chipsInCell.map(
    (id) => wos.find((w) => w.woId === id)!
  ).filter(Boolean);

  const isEligible =
    isDragActive && activeChipWoId !== null
      ? isEligibleTarget(
          activeChipWoId,
          wo.woId,
          wos,
          state.chipHome,
          state.confirmedWoIds,
          state.lockedWoIds
        )
      : false;

  const isEligibleForSelected =
    !isDragActive && selectedChipWoId !== null
      ? isEligibleTarget(
          selectedChipWoId,
          wo.woId,
          wos,
          state.chipHome,
          state.confirmedWoIds,
          state.lockedWoIds
        )
      : false;

  const isAssembly = wo.partType === "Assembly";
  const rowBg = isAssembly ? "bg-muted/30" : "";

  const blueVal = (changed: boolean) =>
    changed ? "text-[#0EA5E9] font-semibold" : "";

  const projectWoIds = derived.chipsInCell;
  const projectNums = [
    ...new Set(
      projectWoIds
        .map((id) => wos.find((w) => w.woId === id)?.projectNumber)
        .filter(Boolean)
    ),
  ] as string[];
  if (projectNums.length === 0) projectNums.push(wo.projectNumber);

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
        })
      : "—";

  return (
    <tr
      className={[
        rowBg,
        isFirstInGroup
          ? "border-t-2 border-muted-foreground/20"
          : "border-t border-border/40",
        isGreyedOut ? "opacity-30 pointer-events-none" : "",
        isSelected ? "bg-sky-500/5" : "",
        "transition-opacity",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Select checkbox */}
      <td className="px-2 py-1.5 align-middle text-center w-9">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(wo.woId)}
          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
        />
      </td>

      {/* Composition Column */}
      <td className="px-2 py-1.5 align-top">
        <CompositionCell
          hostWoId={wo.woId}
          chips={chipsInCell}
          isEligible={isEligible}
          isDragActive={isDragActive}
          isCurrentDragHome={activeChipWoId === wo.woId}
          chipMovedAway={chipMovedAway}
          placementNoteTargetRef={hostWo ? `${hostWo.topLevelRef}` : null}
          onChipClick={onChipClick}
          onCellClick={onCellClick}
          selectedChipWoId={selectedChipWoId}
          isEligibleForSelected={isEligibleForSelected}
          state={state}
          wos={wos}
        />
      </td>

      {/* Parent */}
      <td className="px-2 py-1.5 align-middle">
        {wo.parentPartName ? (
          <span
            className="text-xs text-muted-foreground cursor-default truncate max-w-[120px] inline-block"
            title={
              wo.ancestryPath.length > 0
                ? [...wo.ancestryPath]
                    .reverse()
                    .map((a) => `${a.partNumber} — ${a.partName}`)
                    .join("\n")
                : wo.parentPartName
            }
          >
            {wo.parentPartName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/40">—</span>
        )}
      </td>

      {/* Part Number */}
      <td className="px-2 py-1.5 align-middle">
        <span
          className={[
            "font-mono text-xs",
            isAssembly ? "text-foreground/70" : "text-foreground",
          ].join(" ")}
        >
          {wo.partNumber}
        </span>
      </td>

      {/* Part Name */}
      <td className="px-2 py-1.5 align-middle max-w-[160px]">
        <span className="text-xs truncate block" title={wo.partName}>
          {wo.partName}
        </span>
      </td>

      {/* Demand Qty */}
      <td className="px-2 py-1.5 align-middle text-right">
        <span
          className={[
            "font-mono text-xs",
            blueVal(derived.demandChanged),
          ].join(" ")}
        >
          {derived.demand}
        </span>
      </td>

      {/* Planned Qty */}
      <td className="px-2 py-1.5 align-middle">
        {isAssembly ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <PlannedQtyInput
            hostWoId={wo.woId}
            demand={derived.demand}
            plannedQty={state.plannedQty[wo.woId] ?? null}
            isLocked={isLocked}
            onUpdate={onUpdatePlannedQty}
          />
        )}
      </td>

      {/* Priority */}
      <td className="px-2 py-1.5 align-middle text-center">
        <span
          className={[
            "font-mono text-xs",
            blueVal(derived.priorityChanged),
          ].join(" ")}
        >
          {derived.priority}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-2 py-1.5 align-middle text-right">
        <span
          className={[
            "text-xs tabular-nums",
            blueVal(derived.dueDateChanged),
          ].join(" ")}
        >
          {formatDate(derived.dueDate)}
        </span>
      </td>

      {/* Project(s) */}
      <td className="px-2 py-1.5 align-middle">
        {projectNums.length === 1 ? (
          <span className="font-mono text-xs">{projectNums[0]}</span>
        ) : (
          <span
            className="font-mono text-xs cursor-default"
            title={projectNums.join(", ")}
          >
            {projectNums.slice(0, 2).join(", ")}
            {projectNums.length > 2 ? ` +${projectNums.length - 2}` : ""}
          </span>
        )}
      </td>

      {/* Routing */}
      <td className="px-2 py-1.5 align-middle">
        <RoutingPills templateId={wo.routingTemplateId} />
      </td>

      {/* Lock Toggle */}
      <td className="px-2 py-1.5 align-middle text-center">
        <LockToggle
          isLocked={isLocked}
          isDisabled={lockDisabled}
          onToggle={() => onToggleLock(wo.woId)}
        />
      </td>
    </tr>
  );
}

// ─── Multi-Select Toolbar ─────────────────────────────────────────────────────

function MultiSelectToolbar({
  selectedCount,
  viewMode,
  onLockSelected,
  onUnlockSelected,
  onResetPlanned,
  onMultiplyPlanned,
  onAddPlanned,
  onClearSelection,
}: {
  selectedCount: number;
  viewMode: ViewMode;
  onLockSelected: () => void;
  onUnlockSelected: () => void;
  onResetPlanned: () => void;
  onMultiplyPlanned: (n: number) => void;
  onAddPlanned: (n: number) => void;
  onClearSelection: () => void;
}) {
  const [multiplyN, setMultiplyN] = useState("2");
  const [addN, setAddN] = useState("10");

  if (selectedCount === 0) return null;

  const showBatchingActions = viewMode === "Batching" || viewMode === "All";
  const showQpActions = viewMode === "QuantityPlanning" || viewMode === "All";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2.5 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg">
      <span className="text-xs font-medium text-foreground shrink-0">
        {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
      </span>

      <div className="h-4 w-px bg-border" />

      {/* Batching view actions */}
      {showBatchingActions && (
        <button
          onClick={onLockSelected}
          className="rounded px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          Lock selected
        </button>
      )}

      {/* QP view actions */}
      {showQpActions && (
        <>
          <button
            onClick={onUnlockSelected}
            className="rounded px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Unlock selected
          </button>

          <button
            onClick={onResetPlanned}
            className="rounded px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Reset Planned to Demand
          </button>

          {/* ×N */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">×</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={multiplyN}
              onChange={(e) => setMultiplyN(e.target.value)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => {
                const n = parseFloat(multiplyN);
                if (!isNaN(n) && n >= 1) onMultiplyPlanned(n);
              }}
              className="rounded px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Apply
            </button>
          </div>

          {/* +N */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">+</span>
            <input
              type="number"
              min="0"
              value={addN}
              onChange={(e) => setAddN(e.target.value)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={() => {
                const n = parseInt(addN, 10);
                if (!isNaN(n) && n >= 0) onAddPlanned(n);
              }}
              className="rounded px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              Apply
            </button>
          </div>
        </>
      )}

      <div className="flex-1" />

      <button
        onClick={onClearSelection}
        className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        Clear selection
      </button>
    </div>
  );
}

// ─── Reset Draft Modal ────────────────────────────────────────────────────────

function ResetDraftModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative z-10 rounded-lg border border-border bg-background p-6 shadow-xl max-w-md w-full mx-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">
          Reset Draft?
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          Reset Draft will return all chips to their home rows, restore default
          lock states (singletons locked, batch candidates unlocked), and clear
          all Planned Quantity edits. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            autoFocus
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BatchingPage() {
  const [state, setState] = useState<BtSessionState>(INITIAL_SESSION_STATE);
  const [activeChipWoId, setActiveChipWoId] = useState<number | null>(null);
  const [selectedChipWoId, setSelectedChipWoId] = useState<number | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("Batching");

  // Row selection (multi-select)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());

  // Reset Draft modal
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Filters
  const [filterSearch, setFilterSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Visible (non-confirmed) WOs
  const visibleWOs = useMemo(
    () => ALL_BT_WOS.filter((w) => !state.confirmedWoIds.has(w.woId)),
    [state.confirmedWoIds]
  );

  // Recompute candidate groups from visible WOs (grouped by partId for singleton classification)
  const liveGroups = useMemo(() => {
    const byPartId = new Map<number, BtWorkOrder[]>();
    for (const wo of visibleWOs) {
      if (!byPartId.has(wo.partId)) byPartId.set(wo.partId, []);
      byPartId.get(wo.partId)!.push(wo);
    }
    const groups: BtCandidateGroup[] = [];
    for (const [partId, partWOs] of byPartId) {
      const first = partWOs[0];
      if (!first) continue;
      groups.push({
        partId,
        partNumber: first.partNumber,
        partName: first.partName,
        partType: first.partType,
        woIds: partWOs.map((w) => w.woId),
        isSingleton: partWOs.length === 1,
      });
    }
    return groups.sort((a, b) => {
      if (a.isSingleton !== b.isSingleton) return a.isSingleton ? 1 : -1;
      return a.partId - b.partId;
    });
  }, [visibleWOs]);

  const nonSingletonGroups = useMemo(
    () => liveGroups.filter((g) => !g.isSingleton),
    [liveGroups]
  );
  const singletonGroups = useMemo(
    () => liveGroups.filter((g) => g.isSingleton),
    [liveGroups]
  );

  // Filter predicate (applied to both non-singleton and singleton groups)
  const passesTextFilters = useCallback(
    (woId: number) => {
      const wo = visibleWOs.find((w) => w.woId === woId);
      if (!wo) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !wo.partNumber.toLowerCase().includes(q) &&
          !wo.partName.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    },
    [visibleWOs, filterSearch]
  );

  // View mode filter predicate
  const passesViewMode = useCallback(
    (woId: number) => {
      if (viewMode === "Batching") return !state.lockedWoIds.has(woId);
      if (viewMode === "QuantityPlanning") return state.lockedWoIds.has(woId);
      return true; // "All"
    },
    [viewMode, state.lockedWoIds]
  );

  // Apply both filters to non-singleton groups
  const filteredNonSingletonGroups = useMemo(() => {
    return nonSingletonGroups
      .map((g) => ({
        ...g,
        woIds: g.woIds.filter(
          (woId) => passesTextFilters(woId) && passesViewMode(woId)
        ),
      }))
      .filter((g) => g.woIds.length > 0);
  }, [nonSingletonGroups, passesTextFilters, passesViewMode]);

  // Singleton groups filtered for display (text + view mode)
  const filteredSingletonGroups = useMemo(() => {
    return singletonGroups
      .map((g) => ({
        ...g,
        woIds: g.woIds.filter(
          (woId) => passesTextFilters(woId) && passesViewMode(woId)
        ),
      }))
      .filter((g) => g.woIds.length > 0);
  }, [singletonGroups, passesTextFilters, passesViewMode]);

  // Counts for display
  const totalVisibleCandidates = filteredNonSingletonGroups.reduce(
    (sum, g) => sum + g.woIds.length,
    0
  );
  const totalVisiblePartIds = filteredNonSingletonGroups.length;

  // Singleton display count (visible in current view)
  const visibleSingletonCount = filteredSingletonGroups.reduce(
    (sum, g) => sum + g.woIds.length,
    0
  );

  // All singleton WOs (for toggle count display)
  const hiddenSingletonCount = singletonGroups.reduce(
    (sum, g) => sum + g.woIds.length,
    0
  );

  // All visible WOs in current view (used for auto-batch scope and select-all)
  const allVisibleWoIds = useMemo(() => {
    const ids: number[] = [];
    for (const g of filteredNonSingletonGroups) ids.push(...g.woIds);
    if (state.showHiddenSingletons) {
      for (const g of filteredSingletonGroups) ids.push(...g.woIds);
    }
    return ids;
  }, [filteredNonSingletonGroups, filteredSingletonGroups, state.showHiddenSingletons]);

  // Visible locked host WO IDs — used for Confirm Draft scope
  const visibleLockedHostWoIds = useMemo(() => {
    const ids = new Set<number>();
    for (const woId of allVisibleWoIds) {
      if (state.lockedWoIds.has(woId)) ids.add(woId);
    }
    return ids;
  }, [allVisibleWoIds, state.lockedWoIds]);

  // Confirm Draft count = total WOs that will commit
  const confirmableCount = useMemo(() => {
    if (viewMode === "Batching") return 0; // disabled in Batching view
    let count = 0;
    for (const hostWoId of visibleLockedHostWoIds) {
      count += getChipsInCell(state.chipHome, hostWoId).length;
    }
    return count;
  }, [viewMode, visibleLockedHostWoIds, state.chipHome]);

  // Auto-batch enabled: only in Batching or All views, and when visible unlocked groups have 2+ members
  const autoBatchEnabled = useMemo(() => {
    if (viewMode === "QuantityPlanning") return false;
    return filteredNonSingletonGroups.some((g) => g.woIds.length >= 2);
  }, [viewMode, filteredNonSingletonGroups]);

  // Reset Draft enabled when any chip is not at home or any planned qty exceeds demand
  const hasAnyChipNotAtHome = useMemo(
    () =>
      Object.entries(state.chipHome).some(
        ([id, host]) => Number(id) !== host
      ),
    [state.chipHome]
  );

  const hasAnyPlannedQtyEdited = useMemo(() => {
    for (const [woIdStr, qty] of Object.entries(state.plannedQty)) {
      if (qty === null) continue;
      const woId = Number(woIdStr);
      const wo = ALL_BT_WOS.find((w) => w.woId === woId);
      if (wo && qty > wo.quantity) return true;
    }
    return false;
  }, [state.plannedQty]);

  const resetDraftEnabled = hasAnyChipNotAtHome || hasAnyPlannedQtyEdited;

  // DnD: get the dragged WO for the overlay
  const activeChipWo = activeChipWoId
    ? ALL_BT_WOS.find((w) => w.woId === activeChipWoId) ?? null
    : null;

  function handleDragStart(event: DragStartEvent) {
    const woId = event.active.data.current?.woId as number | undefined;
    if (woId !== undefined) {
      setActiveChipWoId(woId);
      setSelectedChipWoId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const woId = event.active.data.current?.woId as number | undefined;
    const targetHostWoId = event.over?.data.current?.hostWoId as
      | number
      | undefined;

    if (woId !== undefined && targetHostWoId !== undefined) {
      setState((prev) => moveChip(woId, targetHostWoId, prev, ALL_BT_WOS));
    }

    setActiveChipWoId(null);
  }

  function handleChipClick(woId: number) {
    if (activeChipWoId !== null) return;
    setSelectedChipWoId((prev) => (prev === woId ? null : woId));
  }

  function handleCellClickForSelected(hostWoId: number) {
    if (selectedChipWoId === null) return;
    if (
      isEligibleTarget(
        selectedChipWoId,
        hostWoId,
        ALL_BT_WOS,
        state.chipHome,
        state.confirmedWoIds,
        state.lockedWoIds
      )
    ) {
      setState((prev) =>
        moveChip(selectedChipWoId, hostWoId, prev, ALL_BT_WOS)
      );
    }
    setSelectedChipWoId(null);
  }

  function handleToggleLock(hostWoId: number) {
    setState((prev) => toggleLock(hostWoId, prev, ALL_BT_WOS));
  }

  function handleUpdatePlannedQty(hostWoId: number, qty: number | null) {
    setState((prev) => updatePlannedQty(hostWoId, qty, prev));
  }

  function handleConfirmDraft() {
    const { newState, stats } = confirmDraft(state, ALL_BT_WOS, visibleLockedHostWoIds);
    setState(newState);
    if (stats.totalWOs === 0) return;
    const parts: string[] = [];
    if (stats.draftBatches > 0)
      parts.push(
        `${stats.draftBatches} batch${stats.draftBatches > 1 ? "es" : ""}`
      );
    if (stats.standalone > 0)
      parts.push(`${stats.standalone} standalone`);
    toast.success(
      `Confirmed ${stats.totalWOs} WO${stats.totalWOs > 1 ? "s" : ""} (${parts.join(", ")}). Open in execution lenses.`
    );
  }

  function handleAutoBatch() {
    // Phase 2: populate openRowHostWoIds from Open Production Rows when they exist.
    // Phase 1: no Open rows — empty set is correct and Phase-2-ready.
    const openRowHostWoIds = new Set<number>();
    const { newState, stats } = autoBatchCandidates(
      state,
      ALL_BT_WOS,
      allVisibleWoIds,
      openRowHostWoIds
    );
    setState(newState);
    if (stats.batchesCreated === 0) {
      toast("No batchable candidates found.");
      return;
    }
    toast.success(
      `Auto-batched ${stats.totalBatched} candidate${stats.totalBatched !== 1 ? "s" : ""} into ${stats.batchesCreated} draft batch${stats.batchesCreated !== 1 ? "es" : ""}.`
    );
  }

  function handleResetDraft() {
    setState((prev) => resetDraft(prev, ALL_BT_WOS));
    setResetModalOpen(false);
    toast("Draft reset. All candidates returned home.");
  }

  // ── View mode switching clears selection ──
  function handleSetViewMode(mode: ViewMode) {
    setViewMode(mode);
    setSelectedRowIds(new Set());
  }

  // ── Row selection ──
  function handleToggleSelectRow(woId: number) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId);
      else next.add(woId);
      return next;
    });
  }

  function handleSelectAllVisible() {
    const allSelected = allVisibleWoIds.every((id) => selectedRowIds.has(id));
    if (allSelected) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(allVisibleWoIds));
    }
  }

  const allVisibleSelected =
    allVisibleWoIds.length > 0 &&
    allVisibleWoIds.every((id) => selectedRowIds.has(id));
  const someVisibleSelected = allVisibleWoIds.some((id) => selectedRowIds.has(id));

  // ── Multi-select toolbar handlers ──
  function handleMultiLockSelected() {
    const ids = [...selectedRowIds];
    const { newState, count } = lockMultiple(ids, state, ALL_BT_WOS);
    setState(newState);
    setSelectedRowIds(new Set());
    if (count > 0) toast.success(`Locked ${count} row${count !== 1 ? "s" : ""}.`);
  }

  function handleMultiUnlockSelected() {
    const ids = [...selectedRowIds];
    const { newState, count } = unlockMultiple(ids, state);
    setState(newState);
    setSelectedRowIds(new Set());
    if (count > 0) toast.success(`Unlocked ${count} row${count !== 1 ? "s" : ""}.`);
  }

  function handleMultiResetPlanned() {
    const ids = [...selectedRowIds];
    const { newState, count } = resetPlannedToDemand(ids, state, ALL_BT_WOS);
    setState(newState);
    if (count > 0)
      toast.success(
        `Reset Planned Qty to Demand on ${count} row${count !== 1 ? "s" : ""}.`
      );
  }

  function handleMultiMultiplyPlanned(n: number) {
    const ids = [...selectedRowIds];
    const { newState, count } = multiplyPlannedQty(ids, n, state, ALL_BT_WOS);
    setState(newState);
    if (count > 0)
      toast.success(
        `Updated Planned Qty on ${count} row${count !== 1 ? "s" : ""} (×${n}).`
      );
  }

  function handleMultiAddPlanned(n: number) {
    const ids = [...selectedRowIds];
    const { newState, count } = addToPlannedQty(ids, n, state, ALL_BT_WOS);
    setState(newState);
    if (count > 0)
      toast.success(
        `Updated Planned Qty on ${count} row${count !== 1 ? "s" : ""} (+${n}).`
      );
  }

  const isDragActive = activeChipWoId !== null;

  // Empty state logic — distinguish "items exist in other state-axis" from "no items at all"
  const hasAnyNonSingletonWOs = nonSingletonGroups.some((g) => g.woIds.length > 0);
  const hasAnySingletonWOs = singletonGroups.length > 0;
  const hasAnyLockedNonSingleton = nonSingletonGroups.some((g) =>
    g.woIds.some((id) => state.lockedWoIds.has(id))
  );
  const hasAnyUnlockedNonSingleton = nonSingletonGroups.some((g) =>
    g.woIds.some((id) => !state.lockedWoIds.has(id))
  );

  function getEmptyStateMessage(): string {
    const hasVisibleRows =
      filteredNonSingletonGroups.length > 0 ||
      (state.showHiddenSingletons && filteredSingletonGroups.length > 0);

    if (hasVisibleRows) return ""; // not empty

    if (viewMode === "Batching") {
      if (hasAnyLockedNonSingleton || hasAnySingletonWOs) {
        return "All candidates are locked. Switch to Quantity Planning view to set quantities, or All to see everything.";
      }
      return "No candidates yet.";
    }

    if (viewMode === "QuantityPlanning") {
      if (hasAnyUnlockedNonSingleton) {
        return "No locked rows yet. Lock candidates in Batching view to plan quantities.";
      }
      return "No candidates yet.";
    }

    // All view
    if (filterSearch) {
      return "No candidates match the current filters.";
    }
    return "No candidates yet.";
  }

  const allConfirmed =
    visibleWOs.length === 0 && state.confirmedWoIds.size > 0;

  const emptyMessage = getEmptyStateMessage();
  const showEmptyState =
    emptyMessage !== "" ||
    (allConfirmed &&
      filteredNonSingletonGroups.length === 0 &&
      (!state.showHiddenSingletons || filteredSingletonGroups.length === 0));

  // Render a group of rows
  function renderRows(woIds: number[]) {
    return woIds.map((woId, idx) => {
      const wo = visibleWOs.find((w) => w.woId === woId);
      if (!wo) return null;

      const isGreyedOut =
        isDragActive &&
        activeChipWoId !== null &&
        !isEligibleTarget(
          activeChipWoId,
          wo.woId,
          ALL_BT_WOS,
          state.chipHome,
          state.confirmedWoIds,
          state.lockedWoIds
        ) &&
        wo.woId !== activeChipWoId;

      return (
        <CandidateRow
          key={woId}
          wo={wo}
          state={state}
          wos={ALL_BT_WOS}
          isDragActive={isDragActive}
          activeChipWoId={activeChipWoId}
          isGreyedOut={isGreyedOut}
          onChipClick={handleChipClick}
          onCellClick={handleCellClickForSelected}
          selectedChipWoId={selectedChipWoId}
          onToggleLock={handleToggleLock}
          onUpdatePlannedQty={handleUpdatePlannedQty}
          isFirstInGroup={idx === 0}
          isSelected={selectedRowIds.has(woId)}
          onToggleSelect={handleToggleSelectRow}
        />
      );
    });
  }

  const hasSelection = selectedRowIds.size > 0;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className={[
            "flex flex-col bg-background text-foreground",
            hasSelection ? "h-screen pb-14" : "h-screen",
          ].join(" ")}
        >
          {/* ── View Mode + Filter Bar ── */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 shrink-0 flex-wrap">
            {/* View mode selector */}
            <div className="flex rounded border border-border overflow-hidden text-xs shrink-0">
              {(["Batching", "QuantityPlanning", "All"] as const).map((mode) => {
                const label =
                  mode === "QuantityPlanning" ? "Qty Planning" : mode;
                return (
                  <button
                    key={mode}
                    onClick={() => handleSetViewMode(mode)}
                    className={[
                      "px-2.5 py-1 transition-colors whitespace-nowrap",
                      viewMode === mode
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted text-foreground",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Search */}
            <input
              type="search"
              placeholder="Part # or name…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="rounded border border-border bg-background px-2.5 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-ring"
            />

            {/* Show Hidden Singletons */}
            <button
              role="switch"
              aria-checked={state.showHiddenSingletons}
              aria-label="Show Unbatchable Parts"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  showHiddenSingletons: !prev.showHiddenSingletons,
                }))
              }
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none focus:outline-none"
            >
              <span
                className={[
                  "relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0",
                  state.showHiddenSingletons ? "bg-primary" : "bg-muted",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
                    state.showHiddenSingletons
                      ? "translate-x-4"
                      : "translate-x-0.5",
                  ].join(" ")}
                />
              </span>
              Show Unbatchable Parts
            </button>

            <div className="flex-1" />

            {/* Auto-Batch Candidates button */}
            <button
              disabled={!autoBatchEnabled}
              title={
                viewMode === "QuantityPlanning"
                  ? "Auto-Batch operates on unlocked rows. Switch to Batching or All view."
                  : autoBatchEnabled
                  ? "Combines all eligible unlocked candidates into draft batches by PartID."
                  : "No batchable candidates available"
              }
              onClick={handleAutoBatch}
              className={[
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                autoBatchEnabled
                  ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              ].join(" ")}
            >
              Auto-Batch Candidates
            </button>

            {/* Reset Draft button */}
            <button
              disabled={!resetDraftEnabled}
              title={
                resetDraftEnabled
                  ? "Returns all chips home, restores default lock states, and clears Planned Qty edits."
                  : "Nothing to reset"
              }
              onClick={() => setResetModalOpen(true)}
              className={[
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                resetDraftEnabled
                  ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              ].join(" ")}
            >
              Reset Draft
            </button>

            {/* Confirm Draft button */}
            <button
              disabled={confirmableCount === 0}
              title={
                viewMode === "Batching"
                  ? "Confirm Draft commits locked rows. Switch to Quantity Planning view to commit."
                  : confirmableCount > 0
                  ? `Commit ${confirmableCount} WO${confirmableCount !== 1 ? "s" : ""} to Open`
                  : "No locked rows visible"
              }
              onClick={handleConfirmDraft}
              className={[
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                confirmableCount > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              ].join(" ")}
            >
              Confirm Draft ({confirmableCount})
            </button>
          </div>

          {/* ── Count bar ── */}
          <div className="px-4 py-1.5 border-b border-border text-xs text-muted-foreground shrink-0">
            {totalVisibleCandidates > 0 || (state.showHiddenSingletons && visibleSingletonCount > 0) ? (
              <>
                {totalVisibleCandidates > 0 && (
                  <>
                    <span className="text-foreground font-medium">
                      {totalVisibleCandidates} candidates
                    </span>{" "}
                    across{" "}
                    <span className="text-foreground font-medium">
                      {totalVisiblePartIds} PartID
                      {totalVisiblePartIds !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
                {!state.showHiddenSingletons && hiddenSingletonCount > 0 && (
                  <span>
                    {totalVisibleCandidates > 0 ? " · " : ""}
                    <span className="text-muted-foreground">
                      {hiddenSingletonCount} unbatchable part
                      {hiddenSingletonCount !== 1 ? "s" : ""}
                    </span>
                  </span>
                )}
                {state.showHiddenSingletons && visibleSingletonCount > 0 && (
                  <span>
                    {totalVisibleCandidates > 0 ? " · " : ""}
                    <span className="text-muted-foreground">
                      {visibleSingletonCount} unbatchable part
                      {visibleSingletonCount !== 1 ? "s" : ""}
                    </span>
                  </span>
                )}
              </>
            ) : allConfirmed ? (
              <span>All candidates confirmed.</span>
            ) : (
              <span className="text-muted-foreground italic">
                {emptyMessage || "No candidates match the current filters."}
              </span>
            )}
            {selectedChipWoId !== null && (
              <span className="ml-3 text-[#0EA5E9] font-medium">
                Chip selected — click a highlighted cell to place it.
              </span>
            )}
          </div>

          {/* ── Candidate Table ── */}
          <div className="flex-1 overflow-auto">
            {showEmptyState && !allConfirmed ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center px-8">
                {emptyMessage || "No candidates match the current filters."}
              </div>
            ) : allConfirmed &&
              filteredNonSingletonGroups.length === 0 &&
              (!state.showHiddenSingletons ||
                filteredSingletonGroups.length === 0) ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                All candidates confirmed.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                {/* col order: checkbox, composition, parent, part#, part name, demand, planned, priority, due date, project(s), routing, lock */}
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col style={{ width: 140 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 92 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 190 }} />
                  <col style={{ width: 48 }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    {/* Select-all checkbox */}
                    <th className="px-2 py-2 text-center w-9">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el)
                            el.indeterminate =
                              someVisibleSelected && !allVisibleSelected;
                        }}
                        onChange={handleSelectAllVisible}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Composition
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Parent
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Part #
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Part Name
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Demand
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Planned
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                      Priority
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Due Date
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Project(s)
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Routing
                    </th>
                    <th className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                      Lock
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* PartID groups (non-singletons) */}
                  {filteredNonSingletonGroups.map((group) => (
                    <React.Fragment key={group.partId}>
                      {renderRows(group.woIds)}
                    </React.Fragment>
                  ))}

                  {/* Hidden Singletons section */}
                  {state.showHiddenSingletons &&
                    filteredSingletonGroups.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={12}
                            className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t-4 border-border bg-muted/20 uppercase tracking-wide"
                          >
                            Unbatchable Parts ({visibleSingletonCount})
                          </td>
                        </tr>
                        {filteredSingletonGroups.map((group) => (
                          <React.Fragment key={group.partId}>
                            {renderRows(group.woIds)}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeChipWo && (
            <ProjectChipOverlay
              projectNumber={activeChipWo.projectNumber}
              topLevelRef={activeChipWo.topLevelRef}
              demandQty={activeChipWo.quantity}
              color={activeChipWo.projectColor}
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Multi-select toolbar (outside DndContext so it's always on top) */}
      <MultiSelectToolbar
        selectedCount={selectedRowIds.size}
        viewMode={viewMode}
        onLockSelected={handleMultiLockSelected}
        onUnlockSelected={handleMultiUnlockSelected}
        onResetPlanned={handleMultiResetPlanned}
        onMultiplyPlanned={handleMultiMultiplyPlanned}
        onAddPlanned={handleMultiAddPlanned}
        onClearSelection={() => setSelectedRowIds(new Set())}
      />

      {/* Reset Draft confirmation modal */}
      <ResetDraftModal
        open={resetModalOpen}
        onConfirm={handleResetDraft}
        onCancel={() => setResetModalOpen(false)}
      />
    </>
  );
}
