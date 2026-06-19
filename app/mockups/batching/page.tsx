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
import { Lock, Unlock, Activity, ChevronDown } from "lucide-react";

import {
  ALL_BT_WOS,
  OPEN_WOS,
  OPEN_BATCHES,
  INITIAL_SESSION_STATE,
  ROUTING_TEMPLATES,
  PROJECT_COLOR_MAP,
  type BtWorkOrder,
  type BtOpenWO,
  type BtOpenBatch,
  type BtSessionState,
  type BtCandidateGroup,
  getDerivedRowValues,
  getOpenRowDerivedValues,
  isEligibleTarget,
  isEligibleOpenTarget,
  getChipsInCell,
  getOpenRowHostIds,
  getPartIdsWithOpenWork,
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
  addChipToOpenRow,
  removeChipFromOpenRow,
  resetDraft,
} from "./_data";

import ProjectChip, {
  ProjectChipOverlay,
} from "@/app/mockups/_shared/project-chip";

// ─── View Mode ────────────────────────────────────────────────────────────────

type ViewMode = "All" | "Batching" | "QuantityPlanning";

// ─── Precomputed Open row host IDs (stable reference) ────────────────────────

const OPEN_ROW_HOST_IDS = getOpenRowHostIds(OPEN_WOS, OPEN_BATCHES);

// Active in Production indicator: the amber Activity icon on Part Number cells
// signals that this partId has at least one Open WO or Open Batch already running
// in production. Planners use this to decide whether to compose candidates with
// existing work vs. creating new standalone batches. The icon appears on BOTH
// candidate rows and Open rows for the same partId.
const PART_IDS_WITH_OPEN_WORK = getPartIdsWithOpenWork(OPEN_WOS, OPEN_BATCHES);

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
              "focus:outline-none rounded-md",
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

// ─── Open Composition Cell (droppable drop zone for Open rows) ────────────────

function OpenCompositionCell({
  openHostId,
  openChip,    // the static open identity chip
  draftChips,  // candidate WOs placed in this Open row's draft
  isEligible,
  isDragActive,
  onRemoveDraftChip,
}: {
  openHostId: number;
  openChip: React.ReactNode;
  draftChips: BtWorkOrder[];
  isEligible: boolean;
  isDragActive: boolean;
  onRemoveDraftChip: (candidateWoId: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `open-cell-${openHostId}`,
    disabled: !isEligible && isDragActive,
    data: { hostWoId: openHostId, isOpenRow: true },
  });

  const showDropHighlight = isOver && isEligible;

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-wrap gap-1 p-1 rounded min-h-[1.75rem] min-w-[130px] transition-colors items-center",
        showDropHighlight ? "bg-emerald-500/15 ring-1 ring-emerald-500/50" : "",
        isEligible && isDragActive ? "ring-1 ring-border/50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Static Open identity chip */}
      {openChip}
      {/* Draft candidate chips placed onto this Open row */}
      {draftChips.map((wo) => (
        <button
          key={wo.woId}
          onClick={() => onRemoveDraftChip(wo.woId)}
          title={`${wo.topLevelRef} / Qty ${wo.quantity} — click to remove`}
          className="focus:outline-none rounded-md"
        >
          <ProjectChip
            woId={wo.woId}
            projectNumber={wo.projectNumber}
            topLevelRef={wo.topLevelRef}
            demandQty={wo.quantity}
            color={wo.projectColor}
            isAtHome={false}
            isRoot={false}
            isAnchoredRoot={false}
            disabled={false}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Open WO Chip (static, crescent/left-bar style) ──────────────────────────

function OpenWoChip({
  openWo,
}: {
  openWo: BtOpenWO;
}) {
  const meta = openWo.projectColor ? PROJECT_COLOR_MAP[openWo.projectColor] : null;
  const borderColor = meta ? meta.hex : "#6b7280";

  return (
    <div
      style={{ borderLeftColor: borderColor }}
      className="inline-flex items-center gap-1 border-l-4 bg-muted/50 px-2 py-0.5 text-xs rounded-md whitespace-nowrap select-none"
      title={`Open WO — ${openWo.topLevelRef} — Qty ${openWo.openQty} (${openWo.mockProductionState})`}
    >
      <span className="font-mono font-semibold text-muted-foreground">{openWo.topLevelRef}</span>
      <span className="text-muted-foreground/60">/</span>
      <span className="text-muted-foreground/80">Qty: {openWo.openQty}</span>
    </div>
  );
}

function OpenBatchChip({
  openBatch,
}: {
  openBatch: BtOpenBatch;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 border-l-4 border-border bg-background px-2 py-0.5 text-xs rounded-md whitespace-nowrap select-none"
      title={`Open Batch — ${openBatch.batchId} — Qty ${openBatch.openQty} (${openBatch.mockProductionState})`}
    >
      <span className="font-mono font-semibold text-muted-foreground">{openBatch.batchId}</span>
      <span className="text-muted-foreground/60">/</span>
      <span className="text-muted-foreground/80">Qty: {openBatch.openQty}</span>
    </div>
  );
}

// ─── Open Production Row ──────────────────────────────────────────────────────

function OpenProductionRow({
  openWo,
  openBatch,
  openHostId,
  draftChipWoIds,
  isDragActive,
  activeChipWoId,
  state,
  wos,
  onRemoveDraftChip,
  isFirstInGroup,
  isGreyedOut,
}: {
  openWo: BtOpenWO | null;
  openBatch: BtOpenBatch | null;
  openHostId: number;
  draftChipWoIds: number[];
  isDragActive: boolean;
  activeChipWoId: number | null;
  state: BtSessionState;
  wos: BtWorkOrder[];
  onRemoveDraftChip: (candidateWoId: number, openHostId: number) => void;
  isFirstInGroup: boolean;
  isGreyedOut?: boolean;
}) {
  const partId = openWo?.partId ?? openBatch?.partId ?? 0;
  const partNumber = openWo?.partNumber ?? openBatch?.partNumber ?? "";
  const partName = openWo?.partName ?? openBatch?.partName ?? "";
  const routingTemplateId = openWo?.routingTemplateId ?? openBatch?.routingTemplateId ?? "";
  const mockProductionState = openWo?.mockProductionState ?? openBatch?.mockProductionState ?? "case1";
  const mockActiveStepIndex = openWo?.mockActiveStepIndex ?? openBatch?.mockActiveStepIndex ?? null;
  const mockCompletedQty = openWo?.mockCompletedQty ?? openBatch?.mockCompletedQty ?? 0;
  const projectNumbers = openWo
    ? [openWo.projectNumber]
    : (openBatch?.memberProjectNums ?? []);

  const isEligible =
    isDragActive && activeChipWoId !== null
      ? isEligibleOpenTarget(openHostId, OPEN_WOS, OPEN_BATCHES) &&
        (() => {
          // Also must be same partId as drag chip
          const dragWo = wos.find((w) => w.woId === activeChipWoId);
          return dragWo?.partId === partId;
        })()
      : false;

  const draftChips = draftChipWoIds
    .map((id) => wos.find((w) => w.woId === id)!)
    .filter(Boolean);

  const derived = getOpenRowDerivedValues(
    openHostId,
    OPEN_WOS,
    OPEN_BATCHES,
    draftChipWoIds,
    wos
  );

  const baseHeadroom = openWo?.mockHeadroom ?? openBatch?.mockHeadroom ?? 0;
  const draftQtyTotal = draftChips.reduce((sum, w) => sum + (w?.quantity ?? 0), 0);
  const headroom = baseHeadroom - draftQtyTotal;
  const headroomChanged = draftQtyTotal > 0;

  const blueVal = (changed: boolean) =>
    changed ? "text-[#0EA5E9] font-semibold" : "";

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "2-digit",
        })
      : "—";

  const openIdentityChip = openWo ? (
    <OpenWoChip openWo={openWo} />
  ) : openBatch ? (
    <OpenBatchChip openBatch={openBatch} />
  ) : null;

  return (
    <tr
      className={[
        "bg-muted/5 text-muted-foreground/70",
        isFirstInGroup
          ? "border-t-2 border-foreground/30"
          : "border-t border-foreground/10",
        "transition-opacity",
        isGreyedOut ? "opacity-30 pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Empty checkbox cell — Open rows not selectable */}
      <td className="px-4 py-1.5 align-middle text-center w-9" />

      {/* Empty lock cell */}
      <td className="px-4 py-1.5 align-middle text-center" />

      {/* Composition cell */}
      <td className="px-4 py-1.5 align-top">
        <OpenCompositionCell
          openHostId={openHostId}
          openChip={openIdentityChip}
          draftChips={draftChips}
          isEligible={isEligible}
          isDragActive={isDragActive}
          onRemoveDraftChip={(candidateWoId) => onRemoveDraftChip(candidateWoId, openHostId)}
        />
      </td>

      {/* Part Number */}
      <td className="px-4 py-1.5 align-middle">
        <span className="font-mono text-xs text-muted-foreground/70">
          {partNumber}
        </span>
      </td>

      {/* Part Name */}
      <td className="px-4 py-1.5 align-middle max-w-[160px]">
        <span className="text-xs truncate block text-muted-foreground/70" title={partName}>
          {partName}
        </span>
      </td>

      {/* Demand Qty — openQty + draft additions in blue */}
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["font-mono text-xs", blueVal(derived.demandChanged)].join(" ")}>
          {derived.demand}
        </span>
      </td>

      {/* Planned — dash for Open rows */}
      <td className="px-4 py-1.5 align-middle text-right">
        <span className="text-muted-foreground/30 text-xs">—</span>
      </td>

      {/* Headroom */}
      <td className="px-4 py-1.5 align-middle text-right">
        {mockProductionState === "case3" ? (
          <span className="font-mono text-xs text-red-500 font-semibold">{headroom}</span>
        ) : (
          <span className={["font-mono text-xs", headroomChanged ? "text-[#0EA5E9] font-semibold" : "text-muted-foreground/70"].join(" ")}>
            {headroom}
          </span>
        )}
      </td>

      {/* Priority */}
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["font-mono text-xs", blueVal(derived.priorityChanged)].join(" ")}>
          {derived.priority}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["text-xs tabular-nums", blueVal(derived.dueDateChanged)].join(" ")}>
          {formatDate(derived.dueDate)}
        </span>
      </td>

      {/* Project(s) */}
      <td className="px-4 py-1.5 align-middle">
        {projectNumbers.length === 1 ? (
          <span className="font-mono text-xs text-muted-foreground/70">{projectNumbers[0]}</span>
        ) : (
          <span
            className="font-mono text-xs text-muted-foreground/70 cursor-default"
            title={projectNumbers.join(", ")}
          >
            {projectNumbers.slice(0, 2).join(", ")}
            {projectNumbers.length > 2 ? ` +${projectNumbers.length - 2}` : ""}
          </span>
        )}
      </td>

      {/* Routing */}
      <td className="px-4 py-1.5 align-middle">
        <RoutingPills templateId={routingTemplateId} activeStepIndex={mockActiveStepIndex} />
      </td>

      {/* Completed */}
      <td className="px-4 py-1.5 align-middle text-right">
        {mockProductionState === "case2" ? (
          <span className="font-mono text-xs text-muted-foreground/70">{mockCompletedQty}</span>
        ) : (
          <span className="text-muted-foreground/30 text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Routing pills ─────────────────────────────────────────────────────────────

function RoutingPills({
  templateId,
  activeStepIndex,
}: {
  templateId: string;
  activeStepIndex?: number | null;
}) {
  const tmpl = ROUTING_TEMPLATES[templateId];
  if (!tmpl) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-nowrap gap-1">
      {tmpl.steps.map((step, idx) => {
        const isActive = activeStepIndex !== null && activeStepIndex !== undefined && idx === activeStepIndex;
        return (
          <span
            key={step}
            className={[
              "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium",
              isActive
                ? "border-foreground/40 bg-white text-black"
                : "border-border bg-muted text-muted-foreground",
            ].join(" ")}
          >
            {step}
          </span>
        );
      })}
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

  // For placement note: check if it's an Open row or candidate row
  let placementNoteRef: string | null = null;
  if (homeChipHost !== null && homeChipHost !== undefined) {
    if (OPEN_ROW_HOST_IDS.has(homeChipHost)) {
      // Chip is in an Open row
      const openWo = OPEN_WOS.find((w) => w.openWoId === homeChipHost);
      const openBatch = OPEN_BATCHES.find((b) => b.openBatchWoId === homeChipHost);
      placementNoteRef = openWo?.topLevelRef ?? openBatch?.batchId ?? "open row";
    } else {
      const hostWo = wos.find((w) => w.woId === homeChipHost);
      placementNoteRef = hostWo ? hostWo.topLevelRef : null;
    }
  }

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
          ? "border-t-2 border-foreground/30"
          : "border-t border-foreground/15",
        isGreyedOut ? "opacity-30 pointer-events-none" : "",
        isSelected ? "bg-sky-500/5" : "",
        "transition-opacity",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Select checkbox */}
      <td className="px-4 py-1.5 align-middle text-center w-9">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(wo.woId)}
          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
        />
      </td>

      {/* Lock Toggle */}
      <td className="px-4 py-1.5 align-middle text-center">
        <LockToggle
          isLocked={isLocked}
          isDisabled={lockDisabled}
          onToggle={() => onToggleLock(wo.woId)}
        />
      </td>

      {/* Composition Column */}
      <td className="px-4 py-1.5 align-top">
        <CompositionCell
          hostWoId={wo.woId}
          chips={chipsInCell}
          isEligible={isEligible}
          isDragActive={isDragActive}
          isCurrentDragHome={activeChipWoId === wo.woId}
          chipMovedAway={chipMovedAway}
          placementNoteTargetRef={placementNoteRef}
          onChipClick={onChipClick}
          onCellClick={onCellClick}
          selectedChipWoId={selectedChipWoId}
          isEligibleForSelected={isEligibleForSelected}
          state={state}
          wos={wos}
        />
      </td>

      {/* Part Number — hover shows ancestry for non-top-level WOs */}
      <td className="px-4 py-1.5 align-middle">
        <span
          className={[
            "font-mono text-xs",
            isAssembly ? "text-foreground/70" : "text-foreground",
          ].join(" ")}
          title={
            wo.parentPartName
              ? wo.ancestryPath.length > 0
                ? [...wo.ancestryPath]
                    .reverse()
                    .map((a) => `${a.partNumber} — ${a.partName}`)
                    .join("\n")
                : wo.parentPartName
              : undefined
          }
        >
          {wo.partNumber}
          {PART_IDS_WITH_OPEN_WORK.has(wo.partId) && (
            <span title="This part has Work in Progress" className="inline-block ml-1">
              <Activity
                className="h-2.5 w-2.5 text-amber-500"
                aria-label="Has Work in Progress"
              />
            </span>
          )}
        </span>
      </td>

      {/* Part Name */}
      <td className="px-4 py-1.5 align-middle max-w-[160px]">
        <span className="text-xs truncate block" title={wo.partName}>
          {wo.partName}
        </span>
      </td>

      {/* Demand Qty */}
      <td className="px-4 py-1.5 align-middle text-right">
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
      <td className="px-4 py-1.5 align-middle text-right">
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

      {/* Headroom — blank for candidates */}
      <td className="px-4 py-1.5 align-middle" />

      {/* Priority */}
      <td className="px-4 py-1.5 align-middle text-right">
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
      <td className="px-4 py-1.5 align-middle text-right">
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
      <td className="px-4 py-1.5 align-middle">
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
      <td className="px-4 py-1.5 align-middle">
        <RoutingPills templateId={wo.routingTemplateId} />
      </td>

      {/* Completed — blank for candidates */}
      <td className="px-4 py-1.5 align-middle" />
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
          all Planned Quantity edits and Open row draft assignments. This cannot be undone.
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

  // Three-tier Auto-Batch dropdown:
  //   Tier 1: "Candidates Only" — groups candidates by PartID (Phase 1 behavior)
  //   Tier 2: "Include Unstarted WIP" — also places singleton candidates onto
  //           matching Case 1 Open rows (Phase 2, unstarted = no steps begun)
  //   Tier 3: "Include Started WIP" — disabled; requires real execution data (Phase 2.5)
  // Selected tier is persisted in session state (autoBatchTier) so it survives
  // multiple auto-batch runs without re-selecting.
  const [autoBatchDropdownOpen, setAutoBatchDropdownOpen] = useState(false);

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
  // Singleton = exactly 1 candidate WO AND no Open work in the lens for this PartID.
  // Candidates with an Open host are NOT singletons — they have composition decisions to make.
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
      const isSingleton = partWOs.length === 1 && !PART_IDS_WITH_OPEN_WORK.has(partId);
      groups.push({
        partId,
        partNumber: first.partNumber,
        partName: first.partName,
        partType: first.partType,
        woIds: partWOs.map((w) => w.woId),
        isSingleton,
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

  // View mode behavior for Open rows:
  //   Batching view: always show (they're drop targets regardless of draft state)
  //   All view: always show
  //   QP view: show ONLY if the Open row has at least one draft chip addition
  //     (the open row "participates" in the QP workflow only when a planner
  //      has added candidates to it, so it appears dynamically as chips are added)
  const openRowsVisibleInQP = useMemo(() => {
    return new Set(
      Object.keys(state.openRowChips)
        .map(Number)
        .filter((id) => (state.openRowChips[id]?.length ?? 0) > 0)
    );
  }, [state.openRowChips]);

  // Open row visibility function
  const openRowVisibleInMode = useCallback(
    (openHostId: number): boolean => {
      if (viewMode === "All" || viewMode === "Batching") return true;
      if (viewMode === "QuantityPlanning") return openRowsVisibleInQP.has(openHostId);
      return false;
    },
    [viewMode, openRowsVisibleInQP]
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

  // Open rows for display: grouped by partId
  // Each entry: { partId, openWo?: BtOpenWO, openBatch?: BtOpenBatch, openHostId }
  type OpenRowEntry = {
    partId: number;
    openHostId: number;
    openWo: BtOpenWO | null;
    openBatch: BtOpenBatch | null;
  };

  const allOpenRows = useMemo((): OpenRowEntry[] => {
    const rows: OpenRowEntry[] = [];
    for (const w of OPEN_WOS) {
      rows.push({ partId: w.partId, openHostId: w.openWoId, openWo: w, openBatch: null });
    }
    for (const b of OPEN_BATCHES) {
      rows.push({ partId: b.partId, openHostId: b.openBatchWoId, openWo: null, openBatch: b });
    }
    return rows;
  }, []);

  // Open rows filtered by text search
  const filteredOpenRows = useMemo((): OpenRowEntry[] => {
    return allOpenRows.filter((row) => {
      // Text filter: match part number or part name
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const pn = (row.openWo?.partNumber ?? row.openBatch?.partNumber ?? "").toLowerCase();
        const pname = (row.openWo?.partName ?? row.openBatch?.partName ?? "").toLowerCase();
        if (!pn.includes(q) && !pname.includes(q)) return false;
      }
      // View mode filter
      if (!openRowVisibleInMode(row.openHostId)) return false;
      // Non-actionable Case 2 rows (headroom <= 0) are hidden implicitly.
      // Case 1 and Case 3 are always visible.
      const ps = row.openWo?.mockProductionState ?? row.openBatch?.mockProductionState;
      if (ps === "case2") {
        const headroom = row.openWo?.mockHeadroom ?? row.openBatch?.mockHeadroom ?? 0;
        if (headroom <= 0) return false;
      }
      return true;
    });
  }, [allOpenRows, filterSearch, openRowVisibleInMode]);

  // Build a map of partId → open rows for rendering alongside candidate groups
  const openRowsByPartId = useMemo((): Map<number, OpenRowEntry[]> => {
    const map = new Map<number, OpenRowEntry[]>();
    for (const row of filteredOpenRows) {
      if (!map.has(row.partId)) map.set(row.partId, []);
      map.get(row.partId)!.push(row);
    }
    return map;
  }, [filteredOpenRows]);

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
    // Add candidate WOs in Open row draft chips that are visible
    for (const [openHostIdStr, draftWoIds] of Object.entries(state.openRowChips)) {
      const openHostId = Number(openHostIdStr);
      if (!openRowVisibleInMode(openHostId)) continue;
      count += draftWoIds.length;
    }
    return count;
  }, [viewMode, visibleLockedHostWoIds, state.chipHome, state.openRowChips, openRowVisibleInMode]);

  // Auto-batch enabled: only in Batching or All views, and when visible unlocked groups have 2+ members
  const autoBatchEnabled = useMemo(() => {
    if (viewMode === "QuantityPlanning") return false;
    return filteredNonSingletonGroups.some((g) => g.woIds.length >= 2);
  }, [viewMode, filteredNonSingletonGroups]);

  // Reset Draft enabled when any chip is not at home or any planned qty exceeds demand
  // or any Open row chips exist
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

  const hasAnyOpenRowChips = useMemo(
    () => Object.values(state.openRowChips).some((arr) => arr.length > 0),
    [state.openRowChips]
  );

  const resetDraftEnabled = hasAnyChipNotAtHome || hasAnyPlannedQtyEdited || hasAnyOpenRowChips;

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

  // Quantity Rules Case 1: dropping a candidate chip onto a Case 1 Open row
  // adds the chip to that row's draft composition. Case 2 and Case 3 rows are
  // greyed-out during drag (isEligibleOpenTarget returns false) so drops on
  // those rows never reach the addChipToOpenRow path.
  function handleDragEnd(event: DragEndEvent) {
    const woId = event.active.data.current?.woId as number | undefined;
    const targetData = event.over?.data.current;
    const targetHostWoId = targetData?.hostWoId as number | undefined;
    const isOpenRowTarget = targetData?.isOpenRow === true;

    if (woId !== undefined && targetHostWoId !== undefined) {
      if (isOpenRowTarget) {
        // Dropping onto an Open row
        if (isEligibleOpenTarget(targetHostWoId, OPEN_WOS, OPEN_BATCHES)) {
          const dragWo = ALL_BT_WOS.find((w) => w.woId === woId);
          const openWo = OPEN_WOS.find((w) => w.openWoId === targetHostWoId);
          const openBatch = OPEN_BATCHES.find((b) => b.openBatchWoId === targetHostWoId);
          const openPartId = openWo?.partId ?? openBatch?.partId;
          if (dragWo && dragWo.partId === openPartId) {
            setState((prev) => addChipToOpenRow(woId, targetHostWoId, prev));
          }
        }
      } else {
        // Normal candidate-to-candidate move
        setState((prev) => moveChip(woId, targetHostWoId, prev, ALL_BT_WOS));
      }
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

  function handleRemoveDraftChipFromOpenRow(candidateWoId: number, openHostId: number) {
    setState((prev) => removeChipFromOpenRow(candidateWoId, openHostId, prev));
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
    let msg = `Confirmed ${stats.totalWOs} WO${stats.totalWOs > 1 ? "s" : ""}`;
    if (parts.length > 0) msg += ` (${parts.join(", ")})`;
    if (stats.openRowsExtended > 0)
      msg += `. ${stats.openRowsExtended} Open row${stats.openRowsExtended !== 1 ? "s" : ""} extended.`;
    else
      msg += ". Open in execution lenses.";
    toast.success(msg);
  }

  function handleAutoBatch() {
    const openRowHostWoIds = new Set<number>(OPEN_ROW_HOST_IDS);
    const { newState, stats } = autoBatchCandidates(
      state,
      ALL_BT_WOS,
      allVisibleWoIds,
      openRowHostWoIds,
      state.autoBatchTier,
      OPEN_WOS,
      OPEN_BATCHES
    );
    setState(newState);
    if (stats.batchesCreated === 0) {
      toast("No batchable candidates found.");
      return;
    }
    const tierLabel = state.autoBatchTier === "include-unstarted-wip" ? " (incl. unstarted WIP)" : "";
    toast.success(
      `Auto-batched${tierLabel} ${stats.totalBatched} candidate${stats.totalBatched !== 1 ? "s" : ""} into ${stats.batchesCreated} draft batch${stats.batchesCreated !== 1 ? "es" : ""}.`
    );
  }

  function handleSetAutoBatchTier(tier: "candidates-only" | "include-unstarted-wip") {
    setState((prev) => ({ ...prev, autoBatchTier: tier }));
    setAutoBatchDropdownOpen(false);
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
      (state.showHiddenSingletons && filteredSingletonGroups.length > 0) ||
      filteredOpenRows.length > 0;

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
      (!state.showHiddenSingletons || filteredSingletonGroups.length === 0) &&
      filteredOpenRows.length === 0);

  // Render a group of candidate rows (with Open rows appended for each partId)
  function renderCandidateGroupWithOpenRows(woIds: number[], partId: number) {
    const candidateRows = woIds.map((woId, idx) => {
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
        // Not greyed if this IS the active chip's own row
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

    // Append Open rows for this partId
    const openRowsForPartId = openRowsByPartId.get(partId) ?? [];
    const openRows = openRowsForPartId.map((row, idx) => {
      const draftChipWoIds = state.openRowChips[row.openHostId] ?? [];

      // Grey out Open rows during drag if:
      // - they are not eligible (case2/case3 or wrong partId)
      const isOpenGreyedOut =
        isDragActive && activeChipWoId !== null
          ? (() => {
              const dragWo = ALL_BT_WOS.find((w) => w.woId === activeChipWoId);
              const isPartIdMatch = dragWo?.partId === row.partId;
              const isEligibleCase = isEligibleOpenTarget(row.openHostId, OPEN_WOS, OPEN_BATCHES);
              return !(isPartIdMatch && isEligibleCase);
            })()
          : false;

      return (
        <OpenProductionRow
          key={row.openHostId}
          openWo={row.openWo}
          openBatch={row.openBatch}
          openHostId={row.openHostId}
          draftChipWoIds={draftChipWoIds}
          isDragActive={isDragActive}
          activeChipWoId={activeChipWoId}
          state={state}
          wos={ALL_BT_WOS}
          onRemoveDraftChip={handleRemoveDraftChipFromOpenRow}
          isFirstInGroup={false}
          isGreyedOut={isOpenGreyedOut}
        />
      );
    });

    return [...candidateRows, ...openRows];
  }

  // For rendering Open rows that belong to partIds NOT in any candidate group
  // (i.e. partIds that only have Open rows, no visible candidates in current view)
  const candidatePartIds = useMemo(() => {
    const ids = new Set<number>();
    for (const g of filteredNonSingletonGroups) ids.add(g.partId);
    if (state.showHiddenSingletons) {
      for (const g of filteredSingletonGroups) ids.add(g.partId);
    }
    return ids;
  }, [filteredNonSingletonGroups, filteredSingletonGroups, state.showHiddenSingletons]);

  const orphanOpenRows = useMemo(() => {
    return filteredOpenRows.filter((row) => !candidatePartIds.has(row.partId));
  }, [filteredOpenRows, candidatePartIds]);

  const hasSelection = selectedRowIds.size > 0;

  // Tooltip for Confirm Draft
  const confirmDraftTooltip = useMemo(() => {
    if (viewMode === "Batching") {
      return "Confirm Draft commits locked rows. Switch to Quantity Planning view to commit.";
    }
    if (confirmableCount > 0) {
      const openRowCount = Object.values(state.openRowChips).reduce(
        (sum, arr) => sum + (arr.length > 0 ? 1 : 0), 0
      );
      let tip = `Commit ${confirmableCount} WO${confirmableCount !== 1 ? "s" : ""} to Open`;
      if (openRowCount > 0) tip += `. ${openRowCount} Open row${openRowCount !== 1 ? "s" : ""} receive new members.`;
      return tip;
    }
    return "No locked rows visible";
  }, [viewMode, confirmableCount, state.openRowChips]);

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

            {/* Auto-Batch Candidates button with dropdown */}
            <div className="relative flex shrink-0">
              <button
                disabled={!autoBatchEnabled}
                title={
                  viewMode === "QuantityPlanning"
                    ? "Auto-Batch operates on unlocked rows. Switch to Batching or All view."
                    : autoBatchEnabled
                    ? `Combines eligible unlocked candidates into draft batches. Tier: ${
                        state.autoBatchTier === "include-unstarted-wip"
                          ? "Include Unstarted WIP"
                          : "Candidates Only"
                      }`
                    : "No batchable candidates available"
                }
                onClick={handleAutoBatch}
                className={[
                  "rounded-l px-3 py-1.5 text-sm font-medium transition-colors border-r border-border/30",
                  autoBatchEnabled
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                ].join(" ")}
              >
                Auto-Batch
              </button>
              <button
                onClick={() => setAutoBatchDropdownOpen((o) => !o)}
                className={[
                  "rounded-r px-2 py-1.5 text-sm font-medium transition-colors",
                  autoBatchEnabled
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                ].join(" ")}
                title="Select auto-batch tier"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {/* Dropdown */}
              {autoBatchDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 rounded border border-border bg-background shadow-lg min-w-[220px] py-1">
                  <button
                    onClick={() => handleSetAutoBatchTier("candidates-only")}
                    className={[
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                      state.autoBatchTier === "candidates-only"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    <div className="font-medium">Auto-Batch: Only Candidates</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Groups candidates by PartID only
                    </div>
                  </button>
                  <button
                    onClick={() => handleSetAutoBatchTier("include-unstarted-wip")}
                    className={[
                      "w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                      state.autoBatchTier === "include-unstarted-wip"
                        ? "text-foreground font-medium"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    <div className="font-medium">Auto-Batch: Include Unstarted WIP</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Also assigns singletons to matching Case 1 Open rows
                    </div>
                  </button>
                  <div className="px-3 py-1.5 text-xs text-muted-foreground/50 cursor-not-allowed border-t border-border mt-1 pt-1">
                    <div className="font-medium line-through">Auto-Batch: Include Started WIP</div>
                    <div className="text-[10px] mt-0.5">
                      Available when execution data exists (Phase 2.5)
                    </div>
                  </div>
                </div>
              )}
            </div>

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
              title={confirmDraftTooltip}
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
            {totalVisibleCandidates > 0 || (state.showHiddenSingletons && visibleSingletonCount > 0) || filteredOpenRows.length > 0 ? (
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
                {filteredOpenRows.length > 0 && (
                  <span>
                    {totalVisibleCandidates > 0 || visibleSingletonCount > 0 ? " · " : ""}
                    <span className="text-muted-foreground">
                      {filteredOpenRows.length} open production row
                      {filteredOpenRows.length !== 1 ? "s" : ""}
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
          {/* Close dropdown on outside click */}
          {autoBatchDropdownOpen && (
            <div
              className="fixed inset-0 z-10"
              onClick={() => setAutoBatchDropdownOpen(false)}
            />
          )}
          <div className="flex-1 overflow-auto">
            {showEmptyState && !allConfirmed ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center px-8">
                {emptyMessage || "No candidates match the current filters."}
              </div>
            ) : allConfirmed &&
              filteredNonSingletonGroups.length === 0 &&
              (!state.showHiddenSingletons ||
                filteredSingletonGroups.length === 0) &&
              filteredOpenRows.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                All candidates confirmed.
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                {/* col order: checkbox, lock, composition, part#, part name, demand, planned, priority, due date, project(s), routing */}
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col style={{ width: 48 }} />
                  <col style={{ width: 150 }} />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 96 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 260 }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    {/* Select-all checkbox */}
                    <th className="px-4 py-2 text-center w-9">
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
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">
                      Lock
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Composition
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Part #
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Part Name
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Demand
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Planned
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Headroom
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Priority
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Project(s)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">
                      Routing
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* PartID groups (non-singletons) — with Open rows appended per group */}
                  {filteredNonSingletonGroups.map((group) => (
                    <React.Fragment key={group.partId}>
                      {renderCandidateGroupWithOpenRows(group.woIds, group.partId)}
                    </React.Fragment>
                  ))}

                  {/* Hidden Singletons section */}
                  {state.showHiddenSingletons &&
                    filteredSingletonGroups.length > 0 && (
                      <>
                        <tr>
                          <td
                            colSpan={13}
                            className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t-4 border-border bg-muted/20 uppercase tracking-wide"
                          >
                            Unbatchable Parts ({visibleSingletonCount})
                          </td>
                        </tr>
                        {filteredSingletonGroups.map((group) => (
                          <React.Fragment key={group.partId}>
                            {renderCandidateGroupWithOpenRows(group.woIds, group.partId)}
                          </React.Fragment>
                        ))}
                      </>
                    )}

                  {/* Orphan Open rows — Open rows for partIds with no visible candidate rows */}
                  {orphanOpenRows.length > 0 && (
                    <>
                      <tr>
                        <td
                          colSpan={13}
                          className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t-4 border-border bg-muted/10 uppercase tracking-wide"
                        >
                          Open Production Only ({orphanOpenRows.length})
                        </td>
                      </tr>
                      {orphanOpenRows.map((row) => {
                        const draftChipWoIds = state.openRowChips[row.openHostId] ?? [];
                        return (
                          <OpenProductionRow
                            key={row.openHostId}
                            openWo={row.openWo}
                            openBatch={row.openBatch}
                            openHostId={row.openHostId}
                            draftChipWoIds={draftChipWoIds}
                            isDragActive={isDragActive}
                            activeChipWoId={activeChipWoId}
                            state={state}
                            wos={ALL_BT_WOS}
                            onRemoveDraftChip={handleRemoveDraftChipFromOpenRow}
                            isFirstInGroup={true}
                          />
                        );
                      })}
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
