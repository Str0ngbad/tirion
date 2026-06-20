"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { Lock, Unlock, Activity, ChevronDown } from "lucide-react";

import { useBatchingViewData, useConfirmDraft, type BatchingViewDataWire } from "@/lib/api/batching";
import ProjectChip, { ProjectChipOverlay, PROJECT_COLOR_MAP, type ProjectColor } from "@/components/batching/project-chip";
import { RoutingPills } from "@/components/batching/routing-pills";

// ─── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "Batching" | "QuantityPlanning" | "All";

type CandidateRow = {
  workOrderId: number;
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
  demand: number;
  priority: number | null;
  dueDate: string | null;
  routingSteps: Array<{ stepIndex: number; processTypeName: string }>;
  bomPath: Array<{ partNumber: string; partName: string }>;
  topLevelRef: string;
  productionState: "case1" | "case2" | "case3";
  completedQty: number | null;
  lockState: "Locked" | "Unlocked";
  projectNumber: string;
  projectColor: string | null;
};

type OpenRow = {
  openHostId: number; // workOrderId for standalone, batchId-based virtual id for batch
  workOrderId: number | null;
  batchId: number | null;
  batchDisplayId: string | null;
  partId: number;
  partNumber: string;
  partName: string;
  demand: number;
  plannedQty: number | null;
  available: number;
  dueDate: string | null;
  productionState: "case1" | "case2" | "case3";
  completedQty: number | null;
  activeStepIndex: number | null;
  projectColor: string | null;
};

type SessionState = {
  chipHome: Record<number, number>;
  lockedWoIds: Set<number>;
  plannedQty: Record<number, number | null>;
  openRowChips: Record<number, number[]>;
  showHiddenSingletons: boolean;
};

// ─── Data parsing helpers ───────────────────────────────────────────────────────

function parseData(wire: BatchingViewDataWire): {
  candidates: CandidateRow[];
  openRows: OpenRow[];
  partIds: number[];
} {
  const candidates: CandidateRow[] = [];
  for (const [partIdStr, rows] of Object.entries(wire.candidatesByPartId)) {
    for (const r of rows) {
      candidates.push({
        workOrderId: r.workOrderId,
        partId: Number(partIdStr),
        partNumber: r.partNumber,
        partName: r.partName,
        partType: "Part", // service doesn't provide partType; default to Part
        demand: Number(r.demand),
        priority: r.priority,
        dueDate: r.dueDate,
        routingSteps: r.routingSteps,
        bomPath: r.bomPath,
        topLevelRef: r.topLevelRef,
        productionState: r.productionState,
        completedQty: r.completedQty !== null ? Number(r.completedQty) : null,
        lockState: r.lockState,
        projectNumber: r.projectNumber ?? "",
        projectColor: r.projectColor ?? null,
      });
    }
  }

  const openRows: OpenRow[] = [];
  // Use a stable virtual host ID for batch rows: 1_000_000 + batchId
  for (const [, rows] of Object.entries(wire.openRowsByPartId)) {
    for (const r of rows) {
      const openHostId =
        r.workOrderId !== null
          ? r.workOrderId
          : 1_000_000 + (r.batchId ?? 0);
      openRows.push({
        openHostId,
        workOrderId: r.workOrderId,
        batchId: r.batchId,
        batchDisplayId: r.batchDisplayId,
        partId: r.partId,
        partNumber: r.partNumber,
        partName: r.partName,
        demand: Number(r.demand),
        plannedQty: r.plannedQty !== null ? Number(r.plannedQty) : null,
        available: Number(r.available),
        dueDate: (r as { dueDate?: string | null }).dueDate ?? null,
        productionState: r.productionState,
        completedQty: r.completedQty !== null ? Number(r.completedQty) : null,
        activeStepIndex: r.activeStepIndex ?? null,
        projectColor: r.projectColor ?? null,
      });
    }
  }

  return { candidates, openRows, partIds: wire.partIds };
}

// ─── Pure session-state helpers ─────────────────────────────────────────────────

function buildInitialState(
  candidates: CandidateRow[],
  openRows: OpenRow[]
): SessionState {
  const chipHome: Record<number, number> = {};
  for (const c of candidates) {
    chipHome[c.workOrderId] = c.workOrderId;
  }

  const openPartIds = new Set(openRows.map((r) => r.partId));
  const byPartId = new Map<number, CandidateRow[]>();
  for (const c of candidates) {
    if (!byPartId.has(c.partId)) byPartId.set(c.partId, []);
    byPartId.get(c.partId)!.push(c);
  }

  const lockedWoIds = new Set<number>();
  const plannedQty: Record<number, number | null> = {};
  for (const [partId, partCandidates] of byPartId) {
    const isTrueSingleton = partCandidates.length === 1 && !openPartIds.has(partId);
    if (isTrueSingleton) {
      const wo = partCandidates[0]!;
      lockedWoIds.add(wo.workOrderId);
      plannedQty[wo.workOrderId] = wo.demand;
    }
  }

  return {
    chipHome,
    lockedWoIds,
    plannedQty,
    openRowChips: {},
    showHiddenSingletons: false,
  };
}

function getChipsInCell(chipHome: Record<number, number>, hostWoId: number): number[] {
  return Object.entries(chipHome)
    .filter(([, host]) => host === hostWoId)
    .map(([id]) => Number(id));
}

function isEligibleTarget(
  dragWoId: number,
  targetHostWoId: number,
  candidates: CandidateRow[],
  chipHome: Record<number, number>,
  lockedWoIds: Set<number>
): boolean {
  const currentHost = chipHome[dragWoId];
  if (currentHost !== undefined && lockedWoIds.has(currentHost)) return false;
  if (lockedWoIds.has(targetHostWoId)) return false;

  if (targetHostWoId === dragWoId) return true;

  if (currentHost === dragWoId) {
    const occupancy = Object.values(chipHome).filter((h) => h === dragWoId).length;
    if (occupancy > 1) return false;
  }

  if (chipHome[targetHostWoId] !== targetHostWoId) return false;

  const dragCand = candidates.find((c) => c.workOrderId === dragWoId);
  const targetCand = candidates.find((c) => c.workOrderId === targetHostWoId);
  if (!dragCand || !targetCand) return false;
  return dragCand.partId === targetCand.partId;
}

function isEligibleOpenTarget(
  openHostId: number,
  openRow: OpenRow,
  candidateDemand: number,
  existingDraftWoIds: number[],
  candidates: CandidateRow[]
): boolean {
  if (openRow.productionState !== "case1") return false;
  if (candidateDemand > 0) {
    const existingDemand = existingDraftWoIds.reduce((sum, id) => {
      const c = candidates.find((c) => c.workOrderId === id);
      return sum + (c?.demand ?? 0);
    }, 0);
    if (candidateDemand > openRow.available - existingDemand) return false;
  }
  return true;
}

function getDerivedValues(
  hostWoId: number,
  candidates: CandidateRow[],
  chipHome: Record<number, number>
) {
  const chips = getChipsInCell(chipHome, hostWoId);
  const homeC = candidates.find((c) => c.workOrderId === hostWoId);
  if (!homeC || chips.length === 0) {
    return {
      demand: homeC?.demand ?? 0,
      priority: homeC?.priority ?? null,
      dueDate: homeC?.dueDate ?? null,
      isDraftBatch: false,
      demandChanged: false,
      priorityChanged: false,
      dueDateChanged: false,
      chips,
    };
  }
  const chipCands = chips.map((id) => candidates.find((c) => c.workOrderId === id)!).filter(Boolean);
  const demand = chipCands.reduce((s, c) => s + c.demand, 0);
  const priorities = chipCands.map((c) => c.priority).filter((p): p is number => p !== null);
  const priority = priorities.length > 0 ? Math.max(...priorities) : null;
  const dates = chipCands.map((c) => c.dueDate).filter((d): d is string => d !== null).sort();
  const dueDate: string | null = dates[0] ?? null;
  return {
    demand,
    priority,
    dueDate,
    isDraftBatch: chips.length >= 2,
    demandChanged: demand !== homeC.demand,
    priorityChanged: priority !== homeC.priority,
    dueDateChanged: dueDate !== homeC.dueDate,
    chips,
  };
}

function moveChip(
  woId: number,
  targetHostWoId: number,
  state: SessionState,
  candidates: CandidateRow[]
): SessionState {
  const currentHost = state.chipHome[woId];
  if (currentHost === targetHostWoId) return state;
  if (!isEligibleTarget(woId, targetHostWoId, candidates, state.chipHome, state.lockedWoIds)) return state;

  const newChipHome = { ...state.chipHome, [woId]: targetHostWoId };
  let newOpenRowChips = state.openRowChips;
  if (currentHost !== undefined) {
    const prevDraft = state.openRowChips[currentHost];
    if (prevDraft !== undefined) {
      const remaining = prevDraft.filter((id) => id !== woId);
      newOpenRowChips = { ...state.openRowChips };
      if (remaining.length === 0) delete newOpenRowChips[currentHost];
      else newOpenRowChips[currentHost] = remaining;
    }
  }
  return { ...state, chipHome: newChipHome, openRowChips: newOpenRowChips };
}

function addChipToOpenRow(
  candidateWoId: number,
  openHostId: number,
  state: SessionState
): SessionState {
  const existing = state.openRowChips[openHostId] ?? [];
  if (existing.includes(candidateWoId)) return state;

  const newOpenRowChips = { ...state.openRowChips };
  const prevHost = state.chipHome[candidateWoId];
  if (prevHost !== undefined && prevHost !== openHostId && newOpenRowChips[prevHost] !== undefined) {
    const remaining = newOpenRowChips[prevHost].filter((id) => id !== candidateWoId);
    if (remaining.length === 0) delete newOpenRowChips[prevHost];
    else newOpenRowChips[prevHost] = remaining;
  }
  newOpenRowChips[openHostId] = [...existing, candidateWoId];
  const newChipHome = { ...state.chipHome, [candidateWoId]: openHostId };
  return { ...state, openRowChips: newOpenRowChips, chipHome: newChipHome };
}

function toggleLock(
  hostWoId: number,
  state: SessionState,
  candidates: CandidateRow[]
): SessionState {
  if (state.chipHome[hostWoId] !== hostWoId) return state;
  const isLocked = state.lockedWoIds.has(hostWoId);
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };
  if (isLocked) {
    newLockedWoIds.delete(hostWoId);
    delete newPlannedQty[hostWoId];
  } else {
    newLockedWoIds.add(hostWoId);
    const derived = getDerivedValues(hostWoId, candidates, state.chipHome);
    newPlannedQty[hostWoId] = derived.demand;
  }
  return { ...state, lockedWoIds: newLockedWoIds, plannedQty: newPlannedQty };
}

function lockMultiple(woIds: number[], state: SessionState, candidates: CandidateRow[]) {
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;
  for (const woId of woIds) {
    if (state.chipHome[woId] !== woId) continue;
    if (state.lockedWoIds.has(woId)) continue;
    newLockedWoIds.add(woId);
    const derived = getDerivedValues(woId, candidates, state.chipHome);
    newPlannedQty[woId] = derived.demand;
    count++;
  }
  return { newState: { ...state, lockedWoIds: newLockedWoIds, plannedQty: newPlannedQty }, count };
}

function unlockMultiple(woIds: number[], state: SessionState) {
  const newLockedWoIds = new Set(state.lockedWoIds);
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;
  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue;
    newLockedWoIds.delete(woId);
    delete newPlannedQty[woId];
    count++;
  }
  return { newState: { ...state, lockedWoIds: newLockedWoIds, plannedQty: newPlannedQty }, count };
}

function resetPlannedToDemand(woIds: number[], state: SessionState, candidates: CandidateRow[]) {
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;
  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue;
    const derived = getDerivedValues(woId, candidates, state.chipHome);
    const current = state.plannedQty[woId] ?? derived.demand;
    if (current !== derived.demand) { newPlannedQty[woId] = derived.demand; count++; }
  }
  return { newState: { ...state, plannedQty: newPlannedQty }, count };
}

function multiplyPlannedQty(woIds: number[], multiplier: number, state: SessionState, candidates: CandidateRow[]) {
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;
  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue;
    const derived = getDerivedValues(woId, candidates, state.chipHome);
    newPlannedQty[woId] = Math.max(Math.round(derived.demand * multiplier), derived.demand);
    count++;
  }
  return { newState: { ...state, plannedQty: newPlannedQty }, count };
}

function addToPlannedQty(woIds: number[], addend: number, state: SessionState, candidates: CandidateRow[]) {
  const newPlannedQty = { ...state.plannedQty };
  let count = 0;
  for (const woId of woIds) {
    if (!state.lockedWoIds.has(woId)) continue;
    const derived = getDerivedValues(woId, candidates, state.chipHome);
    const current = state.plannedQty[woId] ?? derived.demand;
    newPlannedQty[woId] = Math.max(current + addend, derived.demand);
    count++;
  }
  return { newState: { ...state, plannedQty: newPlannedQty }, count };
}

function resetDraft(state: SessionState, candidates: CandidateRow[], openRows: OpenRow[]): SessionState {
  const newChipHome: Record<number, number> = {};
  for (const c of candidates) {
    newChipHome[c.workOrderId] = c.workOrderId;
  }
  const openPartIds = new Set(openRows.map((r) => r.partId));
  const byPartId = new Map<number, CandidateRow[]>();
  for (const c of candidates) {
    if (!byPartId.has(c.partId)) byPartId.set(c.partId, []);
    byPartId.get(c.partId)!.push(c);
  }
  const lockedWoIds = new Set<number>();
  const plannedQty: Record<number, number | null> = {};
  for (const [partId, partCands] of byPartId) {
    if (partCands.length === 1 && !openPartIds.has(partId)) {
      const wo = partCands[0]!;
      lockedWoIds.add(wo.workOrderId);
      plannedQty[wo.workOrderId] = wo.demand;
    }
  }
  return { ...state, chipHome: newChipHome, lockedWoIds, plannedQty, openRowChips: {} };
}

function autoBatchCandidates(
  state: SessionState,
  candidates: CandidateRow[],
  openRows: OpenRow[],
  visibleWoIds: number[],
  openHostIds: Set<number>,
  tier: "candidates-only" | "include-unstarted-wip"
): { newState: SessionState; stats: { totalBatched: number; batchesCreated: number } } {
  const eligible: number[] = [];
  for (const woId of visibleWoIds) {
    const currentHost = state.chipHome[woId];
    if (currentHost === undefined) continue;
    if (openHostIds.has(currentHost) && currentHost !== woId) continue;
    if (state.lockedWoIds.has(currentHost)) continue;
    eligible.push(woId);
  }

  const newChipHome = { ...state.chipHome };
  for (const woId of eligible) newChipHome[woId] = woId;

  const newOpenRowChips = { ...state.openRowChips };
  for (const [openHostIdStr, draftWoIds] of Object.entries(newOpenRowChips)) {
    const remaining = draftWoIds.filter((id) => !eligible.includes(id));
    if (remaining.length === 0) delete newOpenRowChips[Number(openHostIdStr)];
    else newOpenRowChips[Number(openHostIdStr)] = remaining;
  }

  const byPartId = new Map<number, number[]>();
  for (const woId of eligible) {
    const c = candidates.find((c) => c.workOrderId === woId);
    if (!c) continue;
    if (!byPartId.has(c.partId)) byPartId.set(c.partId, []);
    byPartId.get(c.partId)!.push(woId);
  }

  let totalBatched = 0;
  let batchesCreated = 0;

  for (const [partIdN, woIds] of byPartId) {
    const partId = Number(partIdN);

    if (tier === "include-unstarted-wip") {
      const case1Hosts = openRows.filter(
        (r) => r.partId === partId && r.productionState === "case1"
      );
      if (case1Hosts.length > 0) {
        // Pick host: latest dueDate first, then lowest openHostId
        const sorted = [...case1Hosts].sort((a, b) => {
          if (a.dueDate && b.dueDate) return b.dueDate.localeCompare(a.dueDate);
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.openHostId - b.openHostId;
        });
        const best = sorted[0]!;
        const existing = newOpenRowChips[best.openHostId] ?? [];
        const existingDemand = existing.reduce((s, id) => {
          const c = candidates.find((c) => c.workOrderId === id);
          return s + (c?.demand ?? 0);
        }, 0);
        const totalDemand = woIds.reduce((s, id) => {
          const c = candidates.find((c) => c.workOrderId === id);
          return s + (c?.demand ?? 0);
        }, 0);
        if (totalDemand <= best.available - existingDemand) {
          for (const woId of woIds) newChipHome[woId] = best.openHostId;
          newOpenRowChips[best.openHostId] = [...existing, ...woIds];
          totalBatched += woIds.length;
          batchesCreated++;
        }
        continue;
      }
    }

    if (woIds.length < 2) continue;
    const sorted = [...woIds].sort((a, b) => a - b);
    const hostWoId = sorted[0]!;
    for (const woId of sorted) {
      if (woId !== hostWoId) newChipHome[woId] = hostWoId;
    }
    totalBatched += sorted.length;
    batchesCreated++;
  }

  return {
    newState: { ...state, chipHome: newChipHome, openRowChips: newOpenRowChips },
    stats: { totalBatched, batchesCreated },
  };
}

// ─── Components ─────────────────────────────────────────────────────────────────

function CompositionCell({
  hostWoId,
  chips,
  isEligible,
  isDragActive,
  chipMovedAway,
  placementNoteTargetRef,
  onChipClick,
  onCellClick,
  selectedChipWoId,
  isEligibleForSelected,
  candidates,
  state,
}: {
  hostWoId: number;
  chips: CandidateRow[];
  isEligible: boolean;
  isDragActive: boolean;
  chipMovedAway: boolean;
  placementNoteTargetRef: string | null;
  onChipClick: (woId: number) => void;
  onCellClick?: (hostWoId: number) => void;
  selectedChipWoId: number | null;
  isEligibleForSelected: boolean;
  candidates: CandidateRow[];
  state: SessionState;
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
      ].filter(Boolean).join(" ")}
    >
      {chipMovedAway && chips.length === 0 ? (
        <span className="text-[10px] text-muted-foreground italic leading-tight px-1">
          Drafted → {placementNoteTargetRef ?? "batch"}
        </span>
      ) : (
        chips.map((c) => (
          <button
            key={c.workOrderId}
            onClick={(e) => { e.stopPropagation(); onChipClick(c.workOrderId); }}
            className={[
              "focus:outline-none rounded-md",
              selectedChipWoId === c.workOrderId
                ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "",
            ].filter(Boolean).join(" ")}
          >
            <ProjectChip
              woId={c.workOrderId}
              projectNumber={c.projectNumber}
              topLevelRef={c.topLevelRef}
              demandQty={c.demand}
              color={c.projectColor}
              isAtHome={state.chipHome[c.workOrderId] === hostWoId && c.workOrderId === hostWoId}
              isRoot={c.workOrderId === hostWoId}
              isAnchoredRoot={c.workOrderId === hostWoId && chips.length >= 2}
              disabled={isDragActive}
            />
          </button>
        ))
      )}
    </div>
  );
}

function OpenCompositionCell({
  openHostId,
  openChip,
  draftChips,
  isEligible,
  isDragActive,
}: {
  openHostId: number;
  openChip: React.ReactNode;
  draftChips: CandidateRow[];
  isEligible: boolean;
  isDragActive: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `open-cell-${openHostId}`,
    disabled: !isEligible && isDragActive,
    data: { hostWoId: openHostId, isOpenRow: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-wrap gap-1 p-1 rounded min-h-[1.75rem] min-w-[130px] transition-colors items-center",
        isOver && isEligible ? "bg-emerald-500/15 ring-1 ring-emerald-500/50" : "",
        isEligible && isDragActive ? "ring-1 ring-border/50" : "",
      ].filter(Boolean).join(" ")}
    >
      {openChip}
      {draftChips.map((c) => (
        <ProjectChip
          key={c.workOrderId}
          woId={c.workOrderId}
          projectNumber={c.projectNumber}
          topLevelRef={c.topLevelRef}
          demandQty={c.demand}
          color={c.projectColor}
          isAtHome={false}
          isRoot={false}
          isAnchoredRoot={false}
          disabled={false}
        />
      ))}
    </div>
  );
}

function OpenIdentityChip({ row, available, availableChanged }: { row: OpenRow; available: number; availableChanged: boolean }) {
  const meta = row.projectColor && row.projectColor in PROJECT_COLOR_MAP
    ? PROJECT_COLOR_MAP[row.projectColor as ProjectColor]
    : null;
  const borderColor = meta ? meta.hex : "#6b7280";

  const availableClass =
    row.productionState === "case3"
      ? "text-red-500 font-semibold"
      : availableChanged
      ? "text-[#0EA5E9] font-semibold"
      : "text-muted-foreground/70";

  const label = row.batchDisplayId ?? (row.workOrderId ? `WO-${row.workOrderId}` : "Open");

  return (
    <div
      style={{ borderLeftColor: borderColor }}
      className="inline-flex flex-col border-l-4 bg-muted/50 px-2 py-0.5 text-xs rounded-md select-none"
      title={`${row.batchId !== null ? "Open Batch" : "Open WO"} — ${label} (${row.productionState})`}
    >
      <div className="whitespace-nowrap font-mono font-semibold text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-muted-foreground/70">Qty: {row.demand}</span>
        <span className="text-muted-foreground/30 mx-0.5">·</span>
        <span className="text-muted-foreground/70">Avail:</span>
        <span className={availableClass}>{available}</span>
      </div>
    </div>
  );
}

function LockToggle({ isLocked, isDisabled, onToggle }: { isLocked: boolean; isDisabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      title={isDisabled ? "Chip moved away" : isLocked ? "Locked — click to unlock" : "Unlocked — click to lock"}
      className={[
        "flex items-center justify-center w-7 h-7 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
        isDisabled ? "opacity-20 cursor-not-allowed" : isLocked
          ? "text-foreground hover:bg-muted"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      ].filter(Boolean).join(" ")}
    >
      {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
    </button>
  );
}

function PlannedQtyInput({
  hostWoId, demand, plannedQty, isLocked, onUpdate,
}: {
  hostWoId: number; demand: number; plannedQty: number | null; isLocked: boolean;
  onUpdate: (hostWoId: number, qty: number | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  if (!isLocked) return <span className="text-muted-foreground/30 text-xs">—</span>;

  const effectiveQty = plannedQty ?? demand;
  const isEdited = effectiveQty > demand;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val === "") { setError(null); onUpdate(hostWoId, demand); return; }
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) { setError("Must be ≥ 0"); return; }
    if (n < demand) { setError(`Min ${demand}`); onUpdate(hostWoId, demand); return; }
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
        ].filter(Boolean).join(" ")}
      />
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function blueIf(changed: boolean) {
  return changed ? "text-[#0EA5E9] font-semibold" : "";
}

function CandidateTableRow({
  candidate,
  state,
  candidates,
  openRows,
  openHostIds,
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
  partIdsWithOpenWork,
}: {
  candidate: CandidateRow;
  state: SessionState;
  candidates: CandidateRow[];
  openRows: OpenRow[];
  openHostIds: Set<number>;
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
  partIdsWithOpenWork: Set<number>;
}) {
  const woId = candidate.workOrderId;
  const derived = getDerivedValues(woId, candidates, state.chipHome);
  const isLocked = state.lockedWoIds.has(woId);
  const isSourceRow = state.chipHome[woId] !== woId;
  const chipMovedAway = isSourceRow;

  let placementNoteRef: string | null = null;
  const homeChipHost = chipMovedAway ? state.chipHome[woId] : null;
  if (homeChipHost !== null && homeChipHost !== undefined) {
    if (openHostIds.has(homeChipHost)) {
      const or = openRows.find((r) => r.openHostId === homeChipHost);
      placementNoteRef = or?.batchDisplayId ?? (or?.workOrderId ? `WO-${or.workOrderId}` : "open row");
    } else {
      const hostC = candidates.find((c) => c.workOrderId === homeChipHost);
      placementNoteRef = hostC ? hostC.topLevelRef : null;
    }
  }

  const chipsInCell = derived.chips
    .map((id) => candidates.find((c) => c.workOrderId === id)!)
    .filter(Boolean);

  const isEligible = isDragActive && activeChipWoId !== null
    ? isEligibleTarget(activeChipWoId, woId, candidates, state.chipHome, state.lockedWoIds)
    : false;
  const isEligibleForSelected = !isDragActive && selectedChipWoId !== null
    ? isEligibleTarget(selectedChipWoId, woId, candidates, state.chipHome, state.lockedWoIds)
    : false;

  const isAssembly = candidate.partType === "Assembly";
  const rowBg = isAssembly ? "bg-muted/30" : "";

  return (
    <tr
      className={[
        rowBg,
        isFirstInGroup ? "border-t-2 border-foreground/30" : "border-t border-foreground/15",
        isGreyedOut ? "opacity-30 pointer-events-none" : "",
        isSelected ? "bg-sky-500/5" : "",
        "transition-opacity",
      ].filter(Boolean).join(" ")}
    >
      <td className="px-4 py-1.5 align-middle text-center w-9">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(woId)}
          className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
        />
      </td>
      <td className="px-4 py-1.5 align-middle text-center">
        <LockToggle isLocked={isLocked} isDisabled={isSourceRow} onToggle={() => onToggleLock(woId)} />
      </td>
      <td className="px-4 py-1.5 align-top">
        <CompositionCell
          hostWoId={woId}
          chips={chipsInCell}
          isEligible={isEligible}
          isDragActive={isDragActive}
          chipMovedAway={chipMovedAway}
          placementNoteTargetRef={placementNoteRef}
          onChipClick={onChipClick}
          onCellClick={onCellClick}
          selectedChipWoId={selectedChipWoId}
          isEligibleForSelected={isEligibleForSelected}
          candidates={candidates}
          state={state}
        />
      </td>
      <td className="px-4 py-1.5 align-middle overflow-hidden" style={{ maxWidth: 128 }}>
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={["font-mono text-xs truncate", isAssembly ? "text-foreground/70" : ""].join(" ")}
            title={
              candidate.bomPath.length > 0
                ? candidate.partNumber + "\n" + [...candidate.bomPath].reverse().map((a) => `${a.partNumber} — ${a.partName}`).join("\n")
                : candidate.partNumber
            }
          >
            {candidate.partNumber}
          </span>
          {partIdsWithOpenWork.has(candidate.partId) && (
            <Activity className="h-2.5 w-2.5 text-amber-500 shrink-0" aria-label="Has Work in Progress" />
          )}
        </div>
      </td>
      <td className="px-4 py-1.5 align-middle max-w-[176px]">
        <span className="text-xs truncate block" title={candidate.partName}>{candidate.partName}</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["font-mono text-xs", blueIf(derived.demandChanged)].join(" ")}>{derived.demand}</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        {isAssembly ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <PlannedQtyInput
            hostWoId={woId}
            demand={derived.demand}
            plannedQty={state.plannedQty[woId] ?? null}
            isLocked={isLocked}
            onUpdate={onUpdatePlannedQty}
          />
        )}
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["font-mono text-xs", blueIf(derived.priorityChanged)].join(" ")}>{derived.priority ?? "—"}</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["text-xs tabular-nums whitespace-nowrap", blueIf(derived.dueDateChanged)].join(" ")}>
          {formatDate(derived.dueDate)}
        </span>
      </td>
      <td className="px-4 py-1.5 align-middle">
        <RoutingPills steps={candidate.routingSteps} activeStepIndex={null} />
      </td>
    </tr>
  );
}

function OpenProductionTableRow({
  row,
  state,
  candidates,
  isDragActive,
  activeChipWoId,
  isFirstInGroup,
  isGreyedOut,
}: {
  row: OpenRow;
  state: SessionState;
  candidates: CandidateRow[];
  isDragActive: boolean;
  activeChipWoId: number | null;
  isFirstInGroup: boolean;
  isGreyedOut?: boolean;
}) {
  const draftChipWoIds = state.openRowChips[row.openHostId] ?? [];
  const draftChips = draftChipWoIds.map((id) => candidates.find((c) => c.workOrderId === id)!).filter(Boolean);
  const draftDemand = draftChips.reduce((s, c) => s + c.demand, 0);
  const available = row.available - draftDemand;
  const availableChanged = draftDemand > 0;

  const totalDemand = row.demand + draftDemand;
  const demandChanged = draftDemand > 0;
  const draftPriorities = draftChips.map((c) => c.priority).filter((p): p is number => p !== null);
  const priority = draftPriorities.length > 0 ? Math.max(row.demand, ...draftPriorities) : (row.demand > 0 ? null : null);
  // Actually compute proper priority derivation:
  const basePriority = null; // open rows don't have stored priority in our type currently
  const draftDates = draftChips.map((c) => c.dueDate).filter((d): d is string => d !== null).sort();
  const dueDate = draftDates[0] ?? null;
  const dueDateChanged = draftDates.length > 0;

  const isEligible = isDragActive && activeChipWoId !== null
    ? (() => {
        const dragC = candidates.find((c) => c.workOrderId === activeChipWoId);
        if (!dragC || dragC.partId !== row.partId) return false;
        return isEligibleOpenTarget(row.openHostId, row, dragC.demand, draftChipWoIds, candidates);
      })()
    : false;

  return (
    <tr
      className={[
        "bg-muted/5 text-muted-foreground/70",
        isFirstInGroup ? "border-t-2 border-foreground/30" : "border-t border-foreground/10",
        "transition-opacity",
        isGreyedOut ? "opacity-30 pointer-events-none" : "",
      ].filter(Boolean).join(" ")}
    >
      <td className="px-4 py-1.5 align-middle text-center w-9" />
      <td className="px-4 py-1.5 align-middle text-center" />
      <td className="px-4 py-1.5 align-top">
        <OpenCompositionCell
          openHostId={row.openHostId}
          openChip={<OpenIdentityChip row={row} available={available} availableChanged={availableChanged} />}
          draftChips={draftChips}
          isEligible={isEligible}
          isDragActive={isDragActive}
        />
      </td>
      <td className="px-4 py-1.5 align-middle overflow-hidden" style={{ maxWidth: 128 }}>
        <span className="font-mono text-xs truncate block text-muted-foreground/70" title={row.partNumber}>{row.partNumber}</span>
      </td>
      <td className="px-4 py-1.5 align-middle max-w-[176px]">
        <span className="text-xs truncate block text-muted-foreground/70" title={row.partName}>{row.partName}</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["font-mono text-xs", blueIf(demandChanged)].join(" ")}>{totalDemand}</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className="text-muted-foreground/30 text-xs">—</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className="font-mono text-xs text-muted-foreground/70">—</span>
      </td>
      <td className="px-4 py-1.5 align-middle text-right">
        <span className={["text-xs tabular-nums whitespace-nowrap", blueIf(dueDateChanged)].join(" ")}>
          {formatDate(dueDate)}
        </span>
      </td>
      <td className="px-4 py-1.5 align-middle">
        <RoutingPills steps={[]} activeStepIndex={row.activeStepIndex} />
      </td>
    </tr>
  );
}

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

  const showBatching = viewMode === "Batching" || viewMode === "All";
  const showQp = viewMode === "QuantityPlanning" || viewMode === "All";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-2.5 border-t border-border bg-background/95 backdrop-blur-sm shadow-lg">
      <span className="text-xs font-medium text-foreground shrink-0">
        {selectedCount} row{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="h-4 w-px bg-border" />
      {showBatching && (
        <button onClick={onLockSelected} className="rounded px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          Lock selected
        </button>
      )}
      {showQp && (
        <>
          <button onClick={onUnlockSelected} className="rounded px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            Unlock selected
          </button>
          <button onClick={onResetPlanned} className="rounded px-2.5 py-1 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            Reset Planned to Demand
          </button>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">×</span>
            <input type="number" min="1" step="0.5" value={multiplyN} onChange={(e) => setMultiplyN(e.target.value)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={() => { const n = parseFloat(multiplyN); if (!isNaN(n) && n >= 1) onMultiplyPlanned(n); }}
              className="rounded px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Apply</button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">+</span>
            <input type="number" min="0" value={addN} onChange={(e) => setAddN(e.target.value)}
              className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={() => { const n = parseInt(addN, 10); if (!isNaN(n) && n >= 0) onAddPlanned(n); }}
              className="rounded px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Apply</button>
          </div>
        </>
      )}
      <div className="flex-1" />
      <button onClick={onClearSelection} className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        Clear selection
      </button>
    </div>
  );
}

function ResetDraftModal({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 rounded-lg border border-border bg-background p-6 shadow-xl max-w-md w-full mx-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Reset Draft</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Reset Draft will return all chips to their home rows, restore default lock states (singletons locked,
          batch candidates unlocked), and clear all Planned Quantity edits. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button autoFocus onClick={onCancel}
            className="rounded px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancel</button>
          <button onClick={onConfirm}
            className="rounded px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">Reset</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function BatchingPage() {
  const { data: wireData, isLoading, error, refetch } = useBatchingViewData();
  const confirmDraftMutation = useConfirmDraft();

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [openRows, setOpenRows] = useState<OpenRow[]>([]);
  const [partIds, setPartIds] = useState<number[]>([]);
  const [state, setState] = useState<SessionState>({
    chipHome: {},
    lockedWoIds: new Set(),
    plannedQty: {},
    openRowChips: {},
    showHiddenSingletons: false,
  });

  // Initialize / reinitialize session state from fresh API data
  useEffect(() => {
    if (!wireData) return;
    const { candidates: c, openRows: o, partIds: p } = parseData(wireData);
    setCandidates(c);
    setOpenRows(o);
    setPartIds(p);
    setState(buildInitialState(c, o));
  }, [wireData]);

  const [viewMode, setViewMode] = useState<ViewMode>("Batching");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [activeChipWoId, setActiveChipWoId] = useState<number | null>(null);
  const [selectedChipWoId, setSelectedChipWoId] = useState<number | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [autoBatchDropdownOpen, setAutoBatchDropdownOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const openHostIds = useMemo(() => new Set(openRows.map((r) => r.openHostId)), [openRows]);
  const partIdsWithOpenWork = useMemo(() => new Set(openRows.map((r) => r.partId)), [openRows]);

  // Candidate groups by partId
  const candidatesByPartId = useMemo(() => {
    const map = new Map<number, CandidateRow[]>();
    for (const c of candidates) {
      if (!map.has(c.partId)) map.set(c.partId, []);
      map.get(c.partId)!.push(c);
    }
    return map;
  }, [candidates]);

  const openRowsByPartId = useMemo(() => {
    const map = new Map<number, OpenRow[]>();
    for (const r of openRows) {
      if (!map.has(r.partId)) map.set(r.partId, []);
      map.get(r.partId)!.push(r);
    }
    return map;
  }, [openRows]);

  // Classify groups into singletons / non-singletons
  const { nonSingletonPartIds, singletonPartIds } = useMemo(() => {
    const nonS: number[] = [];
    const sng: number[] = [];
    for (const partId of partIds) {
      const cands = candidatesByPartId.get(partId) ?? [];
      const isSingleton = cands.length === 1 && !partIdsWithOpenWork.has(partId);
      if (isSingleton) sng.push(partId);
      else nonS.push(partId);
    }
    return { nonSingletonPartIds: nonS, singletonPartIds: sng };
  }, [partIds, candidatesByPartId, partIdsWithOpenWork]);

  // View mode filter for candidates
  const passesViewMode = useCallback((woId: number) => {
    if (viewMode === "Batching") return !state.lockedWoIds.has(woId);
    if (viewMode === "QuantityPlanning") return state.lockedWoIds.has(woId);
    return true;
  }, [viewMode, state.lockedWoIds]);

  // Text filter
  const passesSearch = useCallback((c: CandidateRow) => {
    if (!filterSearch) return true;
    const q = filterSearch.toLowerCase();
    return c.partNumber.toLowerCase().includes(q) || c.partName.toLowerCase().includes(q);
  }, [filterSearch]);

  // Filtered non-singleton groups
  const filteredNonSingletonGroups = useMemo(() => {
    return nonSingletonPartIds
      .map((partId) => {
        const all = candidatesByPartId.get(partId) ?? [];
        const visible = all.filter((c) => passesSearch(c) && passesViewMode(c.workOrderId));
        return { partId, candidates: visible };
      })
      .filter((g) => g.candidates.length > 0 || (openRowsByPartId.get(g.partId)?.length ?? 0) > 0);
  }, [nonSingletonPartIds, candidatesByPartId, passesSearch, passesViewMode, openRowsByPartId]);

  const filteredSingletonGroups = useMemo(() => {
    return singletonPartIds
      .map((partId) => {
        const all = candidatesByPartId.get(partId) ?? [];
        const visible = all.filter((c) => passesSearch(c) && passesViewMode(c.workOrderId));
        return { partId, candidates: visible };
      })
      .filter((g) => g.candidates.length > 0);
  }, [singletonPartIds, candidatesByPartId, passesSearch, passesViewMode]);

  // Open rows visible in current mode
  const openRowVisibleInMode = useCallback((openHostId: number) => {
    if (viewMode === "All" || viewMode === "Batching") return true;
    return (state.openRowChips[openHostId]?.length ?? 0) > 0;
  }, [viewMode, state.openRowChips]);

  const filteredOpenRows = useMemo(() => {
    return openRows.filter((r) => {
      if (!openRowVisibleInMode(r.openHostId)) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!r.partNumber.toLowerCase().includes(q) && !r.partName.toLowerCase().includes(q)) return false;
      }
      if (r.productionState === "case2" && r.available <= 0) return false;
      return true;
    });
  }, [openRows, openRowVisibleInMode, filterSearch]);

  const filteredOpenRowsByPartId = useMemo(() => {
    const map = new Map<number, OpenRow[]>();
    for (const r of filteredOpenRows) {
      if (!map.has(r.partId)) map.set(r.partId, []);
      map.get(r.partId)!.push(r);
    }
    return map;
  }, [filteredOpenRows]);

  // All visible WO IDs (for auto-batch, select-all)
  const allVisibleWoIds = useMemo(() => {
    const ids: number[] = [];
    for (const g of filteredNonSingletonGroups) ids.push(...g.candidates.map((c) => c.workOrderId));
    if (state.showHiddenSingletons) {
      for (const g of filteredSingletonGroups) ids.push(...g.candidates.map((c) => c.workOrderId));
    }
    return ids;
  }, [filteredNonSingletonGroups, filteredSingletonGroups, state.showHiddenSingletons]);

  // Confirmable count
  const confirmableCount = useMemo(() => {
    if (viewMode === "Batching") return 0;
    let count = 0;
    for (const woId of allVisibleWoIds) {
      if (state.lockedWoIds.has(woId)) count += getChipsInCell(state.chipHome, woId).length;
    }
    for (const [openHostIdStr, draftWoIds] of Object.entries(state.openRowChips)) {
      if (openRowVisibleInMode(Number(openHostIdStr))) count += draftWoIds.length;
    }
    return count;
  }, [viewMode, allVisibleWoIds, state.lockedWoIds, state.chipHome, state.openRowChips, openRowVisibleInMode]);

  // Auto-batch enabled flags
  const candidatesOnlyEnabled = useMemo(() => {
    if (viewMode === "QuantityPlanning") return false;
    return filteredNonSingletonGroups.some((g) => {
      const unlocked = g.candidates.filter((c) => !state.lockedWoIds.has(c.workOrderId));
      return unlocked.length >= 2;
    });
  }, [viewMode, filteredNonSingletonGroups, state.lockedWoIds]);

  const autoBatchWipEnabled = useMemo(() => {
    if (viewMode === "QuantityPlanning") return false;
    const case1PartIds = new Set(openRows.filter((r) => r.productionState === "case1").map((r) => r.partId));
    return allVisibleWoIds.some((woId) => {
      const currentHost = state.chipHome[woId];
      if (currentHost === undefined) return false;
      if (openHostIds.has(currentHost) && currentHost !== woId) return false;
      if (state.lockedWoIds.has(currentHost)) return false;
      const c = candidates.find((c) => c.workOrderId === woId);
      return c ? case1PartIds.has(c.partId) : false;
    });
  }, [viewMode, allVisibleWoIds, state.chipHome, state.lockedWoIds, openRows, openHostIds, candidates]);

  const autoBatchEnabled = candidatesOnlyEnabled || autoBatchWipEnabled;

  // Reset draft enabled
  const resetDraftEnabled = useMemo(() => {
    return (
      Object.entries(state.chipHome).some(([id, host]) => Number(id) !== host) ||
      Object.values(state.openRowChips).some((arr) => arr.length > 0) ||
      Object.entries(state.plannedQty).some(([idStr, qty]) => {
        if (qty === null) return false;
        const c = candidates.find((c) => c.workOrderId === Number(idStr));
        return c && qty > c.demand;
      })
    );
  }, [state.chipHome, state.openRowChips, state.plannedQty, candidates]);

  // Orphan open rows
  const candidatePartIds = useMemo(() => {
    const ids = new Set<number>();
    for (const g of filteredNonSingletonGroups) ids.add(g.partId);
    if (state.showHiddenSingletons) {
      for (const g of filteredSingletonGroups) ids.add(g.partId);
    }
    return ids;
  }, [filteredNonSingletonGroups, filteredSingletonGroups, state.showHiddenSingletons]);

  const orphanOpenRows = useMemo(() => {
    return filteredOpenRows.filter((r) => !candidatePartIds.has(r.partId));
  }, [filteredOpenRows, candidatePartIds]);

  // Select all
  const allVisibleSelected = allVisibleWoIds.length > 0 && allVisibleWoIds.every((id) => selectedRowIds.has(id));
  const someVisibleSelected = allVisibleWoIds.some((id) => selectedRowIds.has(id));

  const isDragActive = activeChipWoId !== null;
  const activeChipCand = activeChipWoId ? candidates.find((c) => c.workOrderId === activeChipWoId) ?? null : null;

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const woId = event.active.data.current?.woId as number | undefined;
    if (woId !== undefined) {
      setActiveChipWoId(woId);
      setSelectedChipWoId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const woId = event.active.data.current?.woId as number | undefined;
    const targetData = event.over?.data.current;
    const targetHostWoId = targetData?.hostWoId as number | undefined;
    const isOpenRowTarget = targetData?.isOpenRow === true;

    if (woId !== undefined && targetHostWoId !== undefined) {
      if (isOpenRowTarget) {
        const dragC = candidates.find((c) => c.workOrderId === woId);
        const openRow = openRows.find((r) => r.openHostId === targetHostWoId);
        const currentDraftWoIds = state.openRowChips[targetHostWoId] ?? [];
        if (dragC && openRow && dragC.partId === openRow.partId &&
          isEligibleOpenTarget(targetHostWoId, openRow, dragC.demand, currentDraftWoIds, candidates)) {
          setState((prev) => addChipToOpenRow(woId, targetHostWoId, prev));
        }
      } else {
        setState((prev) => moveChip(woId, targetHostWoId, prev, candidates));
      }
    }
    setActiveChipWoId(null);
  }

  function handleChipClick(woId: number) {
    if (activeChipWoId !== null) return;
    setSelectedChipWoId((prev) => (prev === woId ? null : woId));
  }

  function handleCellClick(hostWoId: number) {
    if (selectedChipWoId === null) return;
    if (isEligibleTarget(selectedChipWoId, hostWoId, candidates, state.chipHome, state.lockedWoIds)) {
      setState((prev) => moveChip(selectedChipWoId, hostWoId, prev, candidates));
    }
    setSelectedChipWoId(null);
  }

  function handleToggleLock(hostWoId: number) {
    setState((prev) => toggleLock(hostWoId, prev, candidates));
  }

  function handleUpdatePlannedQty(hostWoId: number, qty: number | null) {
    setState((prev) => ({ ...prev, plannedQty: { ...prev.plannedQty, [hostWoId]: qty } }));
  }

  function handleSetViewMode(mode: ViewMode) {
    setViewMode(mode);
    setSelectedRowIds(new Set());
  }

  function handleToggleSelectRow(woId: number) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(woId)) next.delete(woId); else next.add(woId);
      return next;
    });
  }

  function handleSelectAllVisible() {
    if (allVisibleSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(allVisibleWoIds));
  }

  function handleMultiLockSelected() {
    const { newState, count } = lockMultiple([...selectedRowIds], state, candidates);
    setState(newState);
    setSelectedRowIds(new Set());
    if (count > 0) toast.success(`Locked ${count} row${count !== 1 ? "s" : ""}.`);
  }

  function handleMultiUnlockSelected() {
    const { newState, count } = unlockMultiple([...selectedRowIds], state);
    setState(newState);
    setSelectedRowIds(new Set());
    if (count > 0) toast.success(`Unlocked ${count} row${count !== 1 ? "s" : ""}.`);
  }

  function handleMultiResetPlanned() {
    const { newState, count } = resetPlannedToDemand([...selectedRowIds], state, candidates);
    setState(newState);
    if (count > 0) toast.success(`Reset Planned Qty on ${count} row${count !== 1 ? "s" : ""}.`);
  }

  function handleMultiMultiplyPlanned(n: number) {
    const { newState, count } = multiplyPlannedQty([...selectedRowIds], n, state, candidates);
    setState(newState);
    if (count > 0) toast.success(`Updated Planned Qty on ${count} row${count !== 1 ? "s" : ""} (×${n}).`);
  }

  function handleMultiAddPlanned(n: number) {
    const { newState, count } = addToPlannedQty([...selectedRowIds], n, state, candidates);
    setState(newState);
    if (count > 0) toast.success(`Updated Planned Qty on ${count} row${count !== 1 ? "s" : ""} (+${n}).`);
  }

  function handleSelectAndRunAutoBatch(tier: "candidates-only" | "include-unstarted-wip") {
    setAutoBatchDropdownOpen(false);
    const { newState, stats } = autoBatchCandidates(state, candidates, openRows, allVisibleWoIds, openHostIds, tier);
    setState(newState);
    if (stats.batchesCreated === 0) { toast("No batchable candidates found."); return; }
    const label = tier === "include-unstarted-wip" ? " (incl. unstarted WIP)" : "";
    toast.success(`Auto-batched${label} ${stats.totalBatched} candidate${stats.totalBatched !== 1 ? "s" : ""} into ${stats.batchesCreated} draft batch${stats.batchesCreated !== 1 ? "es" : ""}.`);
  }

  function handleResetDraft() {
    setState((prev) => resetDraft(prev, candidates, openRows));
    setResetModalOpen(false);
    toast("Draft reset. All candidates returned home.");
  }

  async function handleConfirmDraft() {
    const assignments: Array<{
      workOrderIds: number[];
      targetType: "new-batch" | "standalone" | "add-to-open-batch" | "add-to-open-wo";
      targetBatchId?: number;
      targetWorkOrderId?: number;
      plannedQty?: number;
    }> = [];

    for (const woId of allVisibleWoIds) {
      if (!state.lockedWoIds.has(woId)) continue;
      const chips = getChipsInCell(state.chipHome, woId);
      if (chips.length === 0) continue;

      const planned = state.plannedQty[woId] ?? null;
      if (chips.length === 1) {
        assignments.push({ workOrderIds: chips, targetType: "standalone", ...(planned ? { plannedQty: planned } : {}) });
      } else {
        assignments.push({ workOrderIds: chips, targetType: "new-batch", ...(planned ? { plannedQty: planned } : {}) });
      }
    }

    for (const [openHostIdStr, draftWoIds] of Object.entries(state.openRowChips)) {
      if (draftWoIds.length === 0) continue;
      const openHostId = Number(openHostIdStr);
      const row = openRows.find((r) => r.openHostId === openHostId);
      if (!row) continue;
      const openPlanned = state.plannedQty[openHostId] ?? null;
      if (row.batchId !== null) {
        assignments.push({ workOrderIds: draftWoIds, targetType: "add-to-open-batch", targetBatchId: row.batchId, ...(openPlanned ? { plannedQty: openPlanned } : {}) });
      } else if (row.workOrderId !== null) {
        assignments.push({ workOrderIds: draftWoIds, targetType: "add-to-open-wo", targetWorkOrderId: row.workOrderId, ...(openPlanned ? { plannedQty: openPlanned } : {}) });
      }
    }

    if (assignments.length === 0) { toast("Nothing to confirm."); return; }

    try {
      await confirmDraftMutation.mutateAsync({ assignments });
      toast.success(`Confirmed ${assignments.length} batch assignment${assignments.length !== 1 ? "s" : ""}. WOs are now Open.`);
      await refetch();
    } catch (e) {
      toast.error("Confirm failed. Please try again.");
    }
  }

  // ─── Empty state ──────────────────────────────────────────────────────────────

  const hasAnyVisible = filteredNonSingletonGroups.some((g) => g.candidates.length > 0) ||
    (state.showHiddenSingletons && filteredSingletonGroups.length > 0) ||
    filteredOpenRows.length > 0;

  const hasAnyLockedNonSingleton = nonSingletonPartIds.some((pid) =>
    (candidatesByPartId.get(pid) ?? []).some((c) => state.lockedWoIds.has(c.workOrderId))
  );
  const hasAnyUnlockedNonSingleton = nonSingletonPartIds.some((pid) =>
    (candidatesByPartId.get(pid) ?? []).some((c) => !state.lockedWoIds.has(c.workOrderId))
  );

  function getEmptyMessage(): string {
    if (hasAnyVisible) return "";
    if (candidates.length === 0) return "No work orders are ready for batching. Complete Stock Fulfillment review to release WOs here.";
    if (viewMode === "Batching") {
      if (hasAnyLockedNonSingleton) return "All candidates are locked. Switch to Qty Planning to confirm or unlock to continue batching.";
      return "No unlocked candidates.";
    }
    if (viewMode === "QuantityPlanning") {
      if (hasAnyUnlockedNonSingleton) return "No rows are locked. Switch to Batching and lock rows to plan quantities.";
      return "No locked rows.";
    }
    return "No candidates match the current filters.";
  }

  const emptyMessage = getEmptyMessage();
  const showEmpty = !hasAnyVisible && emptyMessage !== "";

  const hiddenSingletonCount = singletonPartIds.reduce((s, pid) => s + (candidatesByPartId.get(pid)?.length ?? 0), 0);
  const visibleSingletonCount = filteredSingletonGroups.reduce((s, g) => s + g.candidates.length, 0);
  const totalVisibleCandidates = filteredNonSingletonGroups.reduce((s, g) => s + g.candidates.length, 0);

  const confirmDraftTooltip = viewMode === "Batching"
    ? "Switch to Qty Planning or All view to confirm"
    : confirmableCount > 0 ? `Commit ${confirmableCount} WO${confirmableCount !== 1 ? "s" : ""} to Open`
    : "No locked rows visible";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Loading batching data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-40 text-destructive text-sm">
        Failed to load batching data. Please refresh.
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className={["flex flex-col bg-background text-foreground", selectedRowIds.size > 0 ? "h-full pb-14" : "h-full"].join(" ")}>

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 shrink-0 flex-wrap">
            {/* View mode */}
            <div className="flex rounded border border-border overflow-hidden text-xs shrink-0">
              {(["Batching", "QuantityPlanning", "All"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleSetViewMode(mode)}
                  className={[
                    "px-2.5 py-1 transition-colors whitespace-nowrap",
                    viewMode === mode ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted text-foreground",
                  ].join(" ")}
                >
                  {mode === "QuantityPlanning" ? "Qty Planning" : mode}
                </button>
              ))}
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

            {/* Show Unbatchable Parts toggle */}
            <button
              role="switch"
              aria-checked={state.showHiddenSingletons}
              aria-label="Show Unbatchable Parts"
              onClick={() => setState((prev) => ({ ...prev, showHiddenSingletons: !prev.showHiddenSingletons }))}
              className="flex items-center gap-1.5 text-xs cursor-pointer select-none focus:outline-none"
            >
              <span className={["relative inline-flex h-4 w-8 items-center rounded-full transition-colors shrink-0", state.showHiddenSingletons ? "bg-primary" : "bg-muted"].join(" ")}>
                <span className={["inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform", state.showHiddenSingletons ? "translate-x-4" : "translate-x-0.5"].join(" ")} />
              </span>
              Show Unbatchable Parts
            </button>

            <div className="flex-1" />

            {/* Auto-Batch dropdown */}
            <div className="relative flex shrink-0">
              <button
                disabled={!autoBatchEnabled}
                title={viewMode === "QuantityPlanning" ? "Auto-Batch operates on unlocked rows. Switch to Batching or All view." : autoBatchEnabled ? "Select a tier to run Auto-Batch" : "No work to auto-batch"}
                onClick={() => setAutoBatchDropdownOpen((o) => !o)}
                className={["flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                  autoBatchEnabled ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-muted text-muted-foreground cursor-not-allowed"].join(" ")}
              >
                Auto-Batch <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {autoBatchDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 rounded border border-border bg-background shadow-lg min-w-[220px] py-1">
                  <button
                    onClick={() => handleSelectAndRunAutoBatch("candidates-only")}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors text-foreground"
                  >
                    <div className="font-medium">Only Candidates</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Groups candidates by PartID only</div>
                  </button>
                  <button
                    disabled={!autoBatchWipEnabled}
                    onClick={() => autoBatchWipEnabled ? handleSelectAndRunAutoBatch("include-unstarted-wip") : undefined}
                    className={["w-full text-left px-3 py-1.5 text-xs transition-colors",
                      !autoBatchWipEnabled ? "text-muted-foreground/40 cursor-not-allowed" : "text-foreground hover:bg-muted"].join(" ")}
                  >
                    <div className="font-medium">Include Unstarted WIP</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Also assigns candidates to matching Case 1 Open rows</div>
                  </button>
                  <div className="px-3 py-1.5 text-xs text-muted-foreground/50 cursor-not-allowed border-t border-border mt-1 pt-1">
                    <div className="font-medium line-through">Include Started WIP</div>
                    <div className="text-[10px] mt-0.5">Available when execution data exists (Phase 2.5)</div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Draft */}
            <button
              disabled={!resetDraftEnabled}
              title={resetDraftEnabled ? "Returns all chips home, restores default lock states, and clears Planned Qty edits." : "Nothing to reset"}
              onClick={() => setResetModalOpen(true)}
              className={["rounded px-3 py-1.5 text-sm font-medium transition-colors",
                resetDraftEnabled ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "bg-muted text-muted-foreground cursor-not-allowed"].join(" ")}
            >
              Reset Draft
            </button>

            {/* Confirm Draft */}
            <button
              disabled={confirmableCount === 0 || confirmDraftMutation.isPending}
              title={confirmDraftTooltip}
              onClick={handleConfirmDraft}
              className={["rounded px-3 py-1.5 text-sm font-medium transition-colors",
                confirmableCount > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-not-allowed"].join(" ")}
            >
              {confirmDraftMutation.isPending ? "Confirming…" : `Confirm Draft (${confirmableCount})`}
            </button>
          </div>

          {/* ── Count bar ── */}
          <div className="px-4 py-1.5 border-b border-border text-xs text-muted-foreground shrink-0">
            {totalVisibleCandidates > 0 || (state.showHiddenSingletons && visibleSingletonCount > 0) || filteredOpenRows.length > 0 ? (
              <>
                {totalVisibleCandidates > 0 && (
                  <><span className="text-foreground font-medium">{totalVisibleCandidates} candidates</span>{" "}</>
                )}
                {!state.showHiddenSingletons && hiddenSingletonCount > 0 && (
                  <span>{totalVisibleCandidates > 0 ? " · " : ""}<span className="text-muted-foreground">{hiddenSingletonCount} unbatchable part{hiddenSingletonCount !== 1 ? "s" : ""}</span></span>
                )}
                {state.showHiddenSingletons && visibleSingletonCount > 0 && (
                  <span>{totalVisibleCandidates > 0 ? " · " : ""}<span className="text-muted-foreground">{visibleSingletonCount} unbatchable part{visibleSingletonCount !== 1 ? "s" : ""}</span></span>
                )}
                {filteredOpenRows.length > 0 && (
                  <span>{totalVisibleCandidates > 0 || visibleSingletonCount > 0 ? " · " : ""}<span className="text-muted-foreground">{filteredOpenRows.length} open production row{filteredOpenRows.length !== 1 ? "s" : ""}</span></span>
                )}
              </>
            ) : (
              <span className="italic">{emptyMessage || "No candidates."}</span>
            )}
            {selectedChipWoId !== null && (
              <span className="ml-3 text-[#0EA5E9] font-medium">Chip selected — click a highlighted cell to place it.</span>
            )}
          </div>

          {/* ── Close dropdown overlay ── */}
          {autoBatchDropdownOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setAutoBatchDropdownOpen(false)} />
          )}

          {/* ── Candidate table ── */}
          <div className="flex-1 overflow-auto">
            {showEmpty ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm text-center px-8">
                {emptyMessage}
              </div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <colgroup>
                  <col style={{ width: 32 }} />
                  <col style={{ width: 48 }} />
                  <col style={{ width: 170 }} />
                  <col style={{ width: 128 }} />
                  <col style={{ width: 192 }} />
                  <col style={{ width: 64 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 260 }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-center w-9">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => { if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected; }}
                        onChange={handleSelectAllVisible}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Lock</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Composition</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Part #</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Part Name</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Demand</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Planned</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Priority</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Due Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Routing</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Non-singleton groups */}
                  {filteredNonSingletonGroups.map((group) => (
                    <React.Fragment key={group.partId}>
                      {group.candidates.map((c, idx) => {
                        const isGreyedOut = isDragActive && activeChipWoId !== null &&
                          !isEligibleTarget(activeChipWoId, c.workOrderId, candidates, state.chipHome, state.lockedWoIds) &&
                          c.workOrderId !== activeChipWoId;
                        return (
                          <CandidateTableRow
                            key={c.workOrderId}
                            candidate={c}
                            state={state}
                            candidates={candidates}
                            openRows={openRows}
                            openHostIds={openHostIds}
                            isDragActive={isDragActive}
                            activeChipWoId={activeChipWoId}
                            isGreyedOut={isGreyedOut}
                            onChipClick={handleChipClick}
                            onCellClick={handleCellClick}
                            selectedChipWoId={selectedChipWoId}
                            onToggleLock={handleToggleLock}
                            onUpdatePlannedQty={handleUpdatePlannedQty}
                            isFirstInGroup={idx === 0}
                            isSelected={selectedRowIds.has(c.workOrderId)}
                            onToggleSelect={handleToggleSelectRow}
                            partIdsWithOpenWork={partIdsWithOpenWork}
                          />
                        );
                      })}
                      {/* Open rows for this partId */}
                      {(filteredOpenRowsByPartId.get(group.partId) ?? []).map((row) => {
                        const dragC = activeChipWoId ? candidates.find((c) => c.workOrderId === activeChipWoId) : null;
                        const isOpenGreyedOut = isDragActive && activeChipWoId !== null
                          ? !(dragC?.partId === row.partId && isEligibleOpenTarget(row.openHostId, row, dragC?.demand ?? 0, state.openRowChips[row.openHostId] ?? [], candidates))
                          : false;
                        return (
                          <OpenProductionTableRow
                            key={row.openHostId}
                            row={row}
                            state={state}
                            candidates={candidates}
                            isDragActive={isDragActive}
                            activeChipWoId={activeChipWoId}
                            isFirstInGroup={false}
                            isGreyedOut={isOpenGreyedOut}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}

                  {/* Unbatchable Parts (singletons) */}
                  {state.showHiddenSingletons && filteredSingletonGroups.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={10} className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t-4 border-border bg-muted/20 uppercase tracking-wide">
                          Unbatchable Parts ({visibleSingletonCount})
                        </td>
                      </tr>
                      {filteredSingletonGroups.map((group) =>
                        group.candidates.map((c, idx) => {
                          const isGreyedOut = isDragActive && activeChipWoId !== null &&
                            !isEligibleTarget(activeChipWoId, c.workOrderId, candidates, state.chipHome, state.lockedWoIds) &&
                            c.workOrderId !== activeChipWoId;
                          return (
                            <CandidateTableRow
                              key={c.workOrderId}
                              candidate={c}
                              state={state}
                              candidates={candidates}
                              openRows={openRows}
                              openHostIds={openHostIds}
                              isDragActive={isDragActive}
                              activeChipWoId={activeChipWoId}
                              isGreyedOut={isGreyedOut}
                              onChipClick={handleChipClick}
                              onCellClick={handleCellClick}
                              selectedChipWoId={selectedChipWoId}
                              onToggleLock={handleToggleLock}
                              onUpdatePlannedQty={handleUpdatePlannedQty}
                              isFirstInGroup={idx === 0}
                              isSelected={selectedRowIds.has(c.workOrderId)}
                              onToggleSelect={handleToggleSelectRow}
                              partIdsWithOpenWork={partIdsWithOpenWork}
                            />
                          );
                        })
                      )}
                    </>
                  )}

                  {/* Orphan Open Production rows */}
                  {orphanOpenRows.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={10} className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t-4 border-border bg-muted/10 uppercase tracking-wide">
                          Open Production Only ({orphanOpenRows.length})
                        </td>
                      </tr>
                      {orphanOpenRows.map((row) => (
                        <OpenProductionTableRow
                          key={row.openHostId}
                          row={row}
                          state={state}
                          candidates={candidates}
                          isDragActive={isDragActive}
                          activeChipWoId={activeChipWoId}
                          isFirstInGroup={true}
                        />
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeChipCand && (
            <ProjectChipOverlay
              projectNumber={activeChipCand.projectNumber}
              topLevelRef={activeChipCand.topLevelRef}
              demandQty={activeChipCand.demand}
              color={activeChipCand.projectColor}
            />
          )}
        </DragOverlay>
      </DndContext>

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

      <ResetDraftModal
        open={resetModalOpen}
        onConfirm={handleResetDraft}
        onCancel={() => setResetModalOpen(false)}
      />
    </>
  );
}
