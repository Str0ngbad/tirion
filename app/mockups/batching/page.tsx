"use client";

import React, { useState, useMemo } from "react";
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

import {
  ALL_BT_WOS,
  INITIAL_CANDIDATE_GROUPS,
  INITIAL_SESSION_STATE,
  ROUTING_TEMPLATES,
  BT_PROJECTS,
  PROJECT_COLOR_MAP,
  type BtWorkOrder,
  type BtSessionState,
  type BtCandidateGroup,
  getDerivedRowValues,
  isEligibleTarget,
  isToggleActive,
  getChipsInCell,
  moveChip,
  toggleConfirm,
  updatePlannedQty,
  confirmDraft,
} from "./_data";

import ProjectChip, {
  ProjectChipOverlay,
} from "@/app/mockups/_shared/project-chip";

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
  selectedChipWoId,
  state,
  wos,
}: {
  hostWoId: number;
  chips: BtWorkOrder[];
  isEligible: boolean;
  isDragActive: boolean;
  isCurrentDragHome: boolean;
  chipMovedAway: boolean;
  placementNoteTargetRef: string | null; // non-null when home chip is away
  onChipClick: (woId: number) => void;
  selectedChipWoId: number | null;
  state: BtSessionState;
  wos: BtWorkOrder[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${hostWoId}`,
    disabled: !isEligible && isDragActive,
    data: { hostWoId },
  });

  const showDropHighlight = isOver && isEligible;

  return (
    <div
      ref={setNodeRef}
      className={[
        "flex flex-wrap gap-1 p-1 rounded min-h-[2.5rem] min-w-[130px] transition-colors",
        showDropHighlight ? "bg-emerald-500/15 ring-1 ring-emerald-500/50" : "",
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
  partType,
  onUpdate,
}: {
  hostWoId: number;
  demand: number;
  plannedQty: number | null;
  partType: "Part" | "Assembly";
  onUpdate: (hostWoId: number, qty: number | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  if (partType === "Assembly") {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const displayValue = plannedQty !== null ? String(plannedQty) : "";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val === "") {
      setError(null);
      onUpdate(hostWoId, null);
      return;
    }
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) {
      setError("Must be ≥ 0");
      return;
    }
    if (n < demand) {
      setError(`Min ${demand}`);
      onUpdate(hostWoId, n);
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
        value={displayValue}
        onChange={handleChange}
        placeholder={String(demand)}
        className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}

// ─── Candidate Row ─────────────────────────────────────────────────────────────

function CandidateRow({
  wo,
  state,
  wos,
  allGroups,
  isDragActive,
  activeChipWoId,
  isGreyedOut,
  onChipClick,
  selectedChipWoId,
  onToggleConfirm,
  onUpdatePlannedQty,
  isFirstInGroup,
}: {
  wo: BtWorkOrder;
  state: BtSessionState;
  wos: BtWorkOrder[];
  allGroups: BtCandidateGroup[];
  isDragActive: boolean;
  activeChipWoId: number | null;
  isGreyedOut: boolean;
  onChipClick: (woId: number) => void;
  selectedChipWoId: number | null;
  onToggleConfirm: (hostWoId: number) => void;
  onUpdatePlannedQty: (hostWoId: number, qty: number | null) => void;
  isFirstInGroup: boolean;
}) {
  const derived = getDerivedRowValues(wo.woId, wos, state.chipHome);
  const toggleActive = isToggleActive(wo.woId, state.chipHome);
  const toggleOn = toggleActive && state.confirmToggles[wo.woId];
  const chipMovedAway =
    state.chipHome[wo.woId] !== undefined &&
    state.chipHome[wo.woId] !== wo.woId;

  // Find where the home chip is (for placement note)
  const homeChipHost = chipMovedAway ? state.chipHome[wo.woId] : null;
  const hostWo = homeChipHost ? wos.find((w) => w.woId === homeChipHost) : null;

  // Chips currently in this cell
  const chipsInCell = derived.chipsInCell.map(
    (id) => wos.find((w) => w.woId === id)!
  ).filter(Boolean);

  // Eligible drop target for current drag?
  const isEligible =
    isDragActive && activeChipWoId !== null
      ? isEligibleTarget(
          activeChipWoId,
          wo.woId,
          wos,
          state.chipHome,
          state.confirmedWoIds
        )
      : false;

  const isAssembly = wo.partType === "Assembly";
  const rowBg = isAssembly ? "bg-muted/30" : "";

  const blueVal = (changed: boolean) =>
    changed ? "text-[#0EA5E9] font-semibold" : "";

  // Projects shown in project column
  const projectWoIds = derived.chipsInCell;
  const projectNums = [
    ...new Set(
      projectWoIds
        .map((id) => wos.find((w) => w.woId === id)?.projectNumber)
        .filter(Boolean)
    ),
  ] as string[];
  if (projectNums.length === 0) projectNums.push(wo.projectNumber);

  const projectColors: Record<string, string | null> = {};
  for (const num of projectNums) {
    const proj = BT_PROJECTS.find((p) => p.projectNumber === num);
    const meta = proj?.color ? PROJECT_COLOR_MAP[proj.color] : null;
    projectColors[num] = meta ? meta.hex : null;
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—";

  return (
    <tr
      className={[
        rowBg,
        isFirstInGroup ? "border-t-2 border-muted-foreground/20" : "border-t border-border/40",
        isGreyedOut ? "opacity-30 pointer-events-none" : "",
        "transition-opacity",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Composition Column */}
      <td className="px-2 py-1.5 align-top">
        <CompositionCell
          hostWoId={wo.woId}
          chips={chipsInCell}
          isEligible={isEligible}
          isDragActive={isDragActive}
          isCurrentDragHome={activeChipWoId === wo.woId}
          chipMovedAway={chipMovedAway}
          placementNoteTargetRef={
            hostWo ? `${hostWo.topLevelRef}` : null
          }
          onChipClick={onChipClick}
          selectedChipWoId={selectedChipWoId}
          state={state}
          wos={wos}
        />
      </td>

      {/* WO ID */}
      <td className="px-2 py-1.5 align-middle">
        <span className="font-mono text-xs text-muted-foreground">
          WO-{wo.woId}
        </span>
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
      <td className="px-2 py-1.5 align-middle max-w-[200px]">
        <span className="text-xs truncate block" title={wo.partName}>
          {wo.partName}
        </span>
      </td>

      {/* Demand Qty */}
      <td className="px-2 py-1.5 align-middle text-right">
        <span className={["font-mono text-xs", blueVal(derived.demandChanged)].join(" ")}>
          {derived.demand}
        </span>
      </td>

      {/* Planned Qty */}
      <td className="px-2 py-1.5 align-middle">
        <PlannedQtyInput
          hostWoId={wo.woId}
          demand={derived.demand}
          plannedQty={state.plannedQty[wo.woId] ?? null}
          partType={wo.partType}
          onUpdate={onUpdatePlannedQty}
        />
      </td>

      {/* Priority */}
      <td className="px-2 py-1.5 align-middle text-center">
        <span className={["font-mono text-xs", blueVal(derived.priorityChanged)].join(" ")}>
          {derived.priority}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-2 py-1.5 align-middle text-right">
        <span className={["text-xs tabular-nums", blueVal(derived.dueDateChanged)].join(" ")}>
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

      {/* Confirm Toggle */}
      <td className="px-2 py-1.5 align-middle text-center">
        <button
          role="switch"
          aria-checked={toggleOn}
          disabled={!toggleActive}
          onClick={() => onToggleConfirm(wo.woId)}
          title={
            !toggleActive
              ? "Chip moved away — will confirm with destination batch"
              : toggleOn
              ? "Toggle OFF to hold"
              : "Toggle ON to confirm"
          }
          className={[
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
            !toggleActive
              ? "opacity-30 cursor-not-allowed bg-muted"
              : toggleOn
              ? "bg-primary"
              : "bg-muted",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
              toggleOn ? "translate-x-4" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BatchingPage() {
  const [state, setState] = useState<BtSessionState>(INITIAL_SESSION_STATE);
  const [activeChipWoId, setActiveChipWoId] = useState<number | null>(null);
  const [selectedChipWoId, setSelectedChipWoId] = useState<number | null>(null);

  // Filters
  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [filterPartType, setFilterPartType] = useState<"All" | "Part" | "Assembly">("All");
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

  // Recompute candidate groups from visible WOs (may shrink after confirms)
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

  // Apply filters to non-singleton groups
  const filteredNonSingletonGroups = useMemo(() => {
    return nonSingletonGroups
      .map((g) => ({
        ...g,
        woIds: g.woIds.filter((woId) => {
          const wo = visibleWOs.find((w) => w.woId === woId);
          if (!wo) return false;
          if (filterProjectId && wo.projectId !== filterProjectId) return false;
          if (filterPartType !== "All" && wo.partType !== filterPartType) return false;
          if (filterSearch) {
            const q = filterSearch.toLowerCase();
            if (
              !wo.partNumber.toLowerCase().includes(q) &&
              !wo.partName.toLowerCase().includes(q)
            )
              return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.woIds.length > 0);
  }, [nonSingletonGroups, visibleWOs, filterProjectId, filterPartType, filterSearch]);

  // Confirmed-row count for button label
  const confirmableCount = useMemo(() => {
    const hostWoIds = new Set(Object.values(state.chipHome));
    let count = 0;
    for (const hostWoId of hostWoIds) {
      if (state.confirmedWoIds.has(hostWoId)) continue;
      if (!state.confirmToggles[hostWoId]) continue;
      if (getChipsInCell(state.chipHome, hostWoId).length > 0) count++;
    }
    return count;
  }, [state.chipHome, state.confirmToggles, state.confirmedWoIds]);

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

  // Click-to-select fallback
  function handleChipClick(woId: number) {
    if (activeChipWoId !== null) return; // drag in progress
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
        state.confirmedWoIds
      )
    ) {
      setState((prev) =>
        moveChip(selectedChipWoId, hostWoId, prev, ALL_BT_WOS)
      );
    }
    setSelectedChipWoId(null);
  }

  function handleToggleConfirm(hostWoId: number) {
    setState((prev) => toggleConfirm(hostWoId, prev));
  }

  function handleUpdatePlannedQty(hostWoId: number, qty: number | null) {
    setState((prev) => updatePlannedQty(hostWoId, qty, prev));
  }

  function handleConfirmDraft() {
    const { newState, stats } = confirmDraft(state, ALL_BT_WOS);
    setState(newState);
    if (stats.totalWOs === 0) return;
    const parts: string[] = [];
    if (stats.draftBatches > 0)
      parts.push(
        `${stats.draftBatches} draft batch${stats.draftBatches > 1 ? "es" : ""}`
      );
    if (stats.standalone > 0)
      parts.push(
        `${stats.standalone} standalone`
      );
    toast.success(
      `Confirmed ${stats.totalWOs} WO${stats.totalWOs > 1 ? "s" : ""} (${parts.join(", ")}). Open in execution lenses.`
    );
  }

  const isDragActive = activeChipWoId !== null;

  // Render a group of rows
  function renderRows(woIds: number[], groupLabel?: string) {
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
          state.confirmedWoIds
        ) &&
        wo.woId !== activeChipWoId;

      return (
        <CandidateRow
          key={woId}
          wo={wo}
          state={state}
          wos={ALL_BT_WOS}
          allGroups={liveGroups}
          isDragActive={isDragActive}
          activeChipWoId={activeChipWoId}
          isGreyedOut={isGreyedOut}
          onChipClick={handleChipClick}
          selectedChipWoId={selectedChipWoId}
          onToggleConfirm={handleToggleConfirm}
          onUpdatePlannedQty={handleUpdatePlannedQty}
          isFirstInGroup={idx === 0}
        />
      );
    });
  }

  const totalVisibleCandidates = filteredNonSingletonGroups.reduce(
    (sum, g) => sum + g.woIds.length,
    0
  );
  const totalVisiblePartIds = filteredNonSingletonGroups.length;
  const hiddenSingletonCount = singletonGroups.reduce(
    (sum, g) => sum + g.woIds.length,
    0
  );

  const allConfirmed =
    visibleWOs.length === 0 && state.confirmedWoIds.size > 0;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen bg-background text-foreground">
        {/* ── Filter Bar ── */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 shrink-0 flex-wrap">
          {/* Project filter */}
          <select
            value={filterProjectId ?? ""}
            onChange={(e) =>
              setFilterProjectId(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded border border-border bg-background px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Projects</option>
            {BT_PROJECTS.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectNumber} — {p.projectName}
              </option>
            ))}
          </select>

          {/* Part Type filter */}
          <div className="flex rounded border border-border overflow-hidden text-xs">
            {(["All", "Part", "Assembly"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFilterPartType(v)}
                className={[
                  "px-2.5 py-1 transition-colors",
                  filterPartType === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted text-foreground",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="search"
            placeholder="Part # or name…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="rounded border border-border bg-background px-2.5 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Show Hidden Singletons */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <button
              role="switch"
              aria-checked={state.showHiddenSingletons}
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  showHiddenSingletons: !prev.showHiddenSingletons,
                }))
              }
              className={[
                "relative inline-flex h-4 w-8 items-center rounded-full transition-colors",
                state.showHiddenSingletons ? "bg-primary" : "bg-muted",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform",
                  state.showHiddenSingletons ? "translate-x-4" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
            Show Hidden Singletons
          </label>

          <div className="flex-1" />

          {/* Confirm Draft button */}
          <button
            disabled={confirmableCount === 0}
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
          {totalVisibleCandidates > 0 ? (
            <>
              <span className="text-foreground font-medium">
                {totalVisibleCandidates} candidates
              </span>{" "}
              across{" "}
              <span className="text-foreground font-medium">
                {totalVisiblePartIds} PartID{totalVisiblePartIds !== 1 ? "s" : ""}
              </span>
              {hiddenSingletonCount > 0 && (
                <span>
                  {" · "}
                  <span className="text-muted-foreground">
                    {hiddenSingletonCount} hidden singleton
                    {hiddenSingletonCount !== 1 ? "s" : ""}
                  </span>
                </span>
              )}
            </>
          ) : allConfirmed ? (
            <span>
              All candidates confirmed.{" "}
              {hiddenSingletonCount > 0 && !state.showHiddenSingletons && (
                <span>
                  Toggle <em>Show Hidden Singletons</em> to confirm remaining
                  singletons proactively.
                </span>
              )}
            </span>
          ) : (
            <span>No candidates match the current filters.</span>
          )}
          {selectedChipWoId !== null && (
            <span className="ml-3 text-[#0EA5E9] font-medium">
              Chip selected — click a highlighted cell to place it.
            </span>
          )}
        </div>

        {/* ── Candidate Table ── */}
        <div className="flex-1 overflow-auto">
          {filteredNonSingletonGroups.length === 0 &&
          (!state.showHiddenSingletons || singletonGroups.length === 0) ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              {allConfirmed
                ? "All candidates confirmed."
                : "No candidates match the current filters."}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <colgroup>
                <col style={{ width: 150 }} /> {/* Composition */}
                <col style={{ width: 80 }} />  {/* WO ID */}
                <col style={{ width: 120 }} /> {/* Part # */}
                <col style={{ width: 180 }} /> {/* Part Name */}
                <col style={{ width: 70 }} />  {/* Demand */}
                <col style={{ width: 90 }} />  {/* Planned */}
                <col style={{ width: 60 }} />  {/* Priority */}
                <col style={{ width: 100 }} /> {/* Due Date */}
                <col style={{ width: 100 }} /> {/* Project(s) */}
                <col style={{ width: 200 }} /> {/* Routing */}
                <col style={{ width: 70 }} />  {/* Confirm */}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b border-border">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                    Composition
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-muted-foreground">
                    WO ID
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
                    Pri
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
                    Confirm
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
                {state.showHiddenSingletons && singletonGroups.length > 0 && (
                  <>
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-2 text-xs font-semibold text-muted-foreground border-t-4 border-border bg-muted/20 uppercase tracking-wide"
                      >
                        Hidden Singletons ({hiddenSingletonCount})
                      </td>
                    </tr>
                    {singletonGroups.map((group) => (
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
  );
}
