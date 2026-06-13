"use client";

import { useState, useMemo, Fragment } from "react";
import {
  INITIAL_SF_STATE,
  type SfState,
  type SfWorkOrder,
  computeCandidates,
  computeProjectStats,
  PROJECT_COLOR_MAP,
  getCompetingCandidates,
  getAncestryChain,
} from "./_data";
import ProjectIdPill from "@/app/mockups/project-creation/_components/project-id-pill";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Filter, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ReconcileStockModal from "@/app/mockups/_shared/reconcile-stock-modal";
import {
  reconcileStock,
  fulfillWo,
  passThrough,
  releaseProject,
  releaseAll,
} from "./_data";

export default function StockFulfillmentPage() {
  const [state, setState] = useState<SfState>(() => ({
    ...INITIAL_SF_STATE,
    workOrders: [...INITIAL_SF_STATE.workOrders],
    stockCounts: { ...INITIAL_SF_STATE.stockCounts },
    auditLog: [],
  }));

  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [expandedWoId, setExpandedWoId] = useState<number | null>(null);
  const [reconcileWo, setReconcileWo] = useState<{
    partId: number;
    partNumber: string;
    partName: string;
  } | null>(null);

  const candidates = useMemo(() => computeCandidates(state), [state]);
  const candidateSet = useMemo(
    () => new Set(candidates.map((c) => c.woId)),
    [candidates]
  );
  const projectStats = useMemo(
    () => computeProjectStats(state, candidates),
    [state, candidates]
  );

  const visibleCandidates = filterProjectId
    ? candidates.filter((c) => c.projectId === filterProjectId)
    : candidates;

  // Only show project headers for projects that still have unreleased WOs.
  // Filter to the active project filter if set.
  const visibleProjects = (
    filterProjectId
      ? state.projects.filter((p) => p.projectId === filterProjectId)
      : state.projects
  ).filter((p) => (projectStats[p.projectId]?.unreleasedCount ?? 0) > 0);

  // Total pending release across visible projects (for the global Release button label).
  const totalPendingRelease = visibleProjects.reduce(
    (sum, p) => sum + (projectStats[p.projectId]?.pendingReleaseCount ?? 0),
    0
  );

  function handleFulfill(woId: number) {
    const result = fulfillWo(state, woId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Collapse expansion if the fulfilled WO was the expanded row
    if (expandedWoId === woId) setExpandedWoId(null);
    setState(result.state);

    const wo = state.workOrders.find((w) => w.woId === woId)!;
    const isAssembly = wo.partType === "Assembly";
    const descendantCount = result.state.workOrders.filter(
      (w) =>
        w.status === "Skipped" &&
        !state.workOrders.find(
          (old) => old.woId === w.woId && old.status === "Skipped"
        )
    ).length;

    let msg = `Fulfilled ${wo.partNumber} ×${wo.quantity} from stock.`;
    if (isAssembly && descendantCount > 0) {
      msg += ` ${descendantCount} sub-WO${descendantCount !== 1 ? "s" : ""} skipped (cascade).`;
    }
    toast.success(msg);

    if (result.autoPassedThrough.length > 0) {
      toast.info(
        `Auto-passed ${result.autoPassedThrough.length} WO${result.autoPassedThrough.length !== 1 ? "s" : ""} (stock depleted): ${result.autoPassedThrough.join(", ")}`
      );
    }
  }

  function handlePassThrough(woId: number) {
    const wo = state.workOrders.find((w) => w.woId === woId)!;
    setState(passThrough(state, woId));
    toast.success(
      `Passed through ${wo.partNumber} — WO queued for Pending Release.`
    );
  }

  function handleToggleExpand(woId: number) {
    setExpandedWoId((prev) => (prev === woId ? null : woId));
  }

  function handleHeaderClick(projectId: number) {
    setFilterProjectId((prev) => (prev === projectId ? null : projectId));
    setExpandedWoId(null);
  }

  function handleReleaseProject(projectId: number) {
    const pendingCount =
      projectStats[projectId]?.pendingReleaseCount ?? 0;
    if (pendingCount === 0) {
      toast.info("No pending WOs to release for this project.");
      return;
    }
    setState(releaseProject(state, projectId, candidateSet));
    const proj = state.projects.find((p) => p.projectId === projectId)!;
    toast.success(
      `Released ${pendingCount} WO${pendingCount !== 1 ? "s" : ""} for project ${proj.projectNumber} to Open.`
    );
  }

  function handleReleaseAll() {
    if (totalPendingRelease === 0) {
      toast.info("No pending WOs to release.");
      return;
    }
    const scope = filterProjectId ? [filterProjectId] : undefined;
    setState(releaseAll(state, candidateSet, scope));
    toast.success(
      `Released ${totalPendingRelease} WO${totalPendingRelease !== 1 ? "s" : ""} to Open${filterProjectId ? " for filtered project" : " across all projects"}.`
    );
  }

  function handleReconcile(wo: {
    partId: number;
    partNumber: string;
    partName: string;
  }) {
    setReconcileWo(wo);
  }

  function handleReconcileConfirm(newCount: number, reason: string) {
    if (!reconcileWo) return;
    const newState = reconcileStock(
      state,
      reconcileWo.partId,
      newCount,
      reason
    );
    setState(newState);

    const autoPassed = newState.auditLog.filter(
      (e) =>
        e.action === "AutoPassThrough" &&
        e.partId === reconcileWo.partId &&
        !state.auditLog.some((old) => old.id === e.id)
    ).length;

    const delta = newCount - (state.stockCounts[reconcileWo.partId] ?? 0);
    const sign = delta >= 0 ? "+" : "";
    toast.success(
      `Stock reconciled: ${reconcileWo.partNumber} → ${newCount} (${sign}${delta})${autoPassed > 0 ? `. ${autoPassed} WO${autoPassed !== 1 ? "s" : ""} auto-passed through.` : ""}`
    );
    setReconcileWo(null);
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col bg-background font-sans text-foreground">
        {/* ── Chrome ──────────────────────────────────────────────────────────── */}
        <div className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
          <span className="text-sm font-medium text-muted-foreground">
            Tirion
          </span>
          <span className="mx-2 text-muted-foreground/40">/</span>
          <span className="text-sm font-semibold text-foreground">
            Stock Fulfillment
          </span>
        </div>

        {/* ── Top action bar ──────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-2.5">
          <div className="flex items-center gap-2">
            <Select
              value={filterProjectId ? String(filterProjectId) : "all"}
              onValueChange={(v) => {
                setFilterProjectId(v === "all" ? null : Number(v));
                setExpandedWoId(null);
              }}
            >
              <SelectTrigger className="h-7 w-48 gap-1 text-xs">
                <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {state.projects.map((p) => (
                  <SelectItem key={p.projectId} value={String(p.projectId)}>
                    {p.projectNumber} — {p.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {visibleCandidates.length} candidate
              {visibleCandidates.length !== 1 ? "s" : ""}
              {filterProjectId ? "" : ` across ${state.projects.length} projects`}
            </span>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleReleaseAll}
            disabled={totalPendingRelease === 0}
          >
            Release All Pending ({totalPendingRelease})
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* ── Project header strip ─────────────────────────────────────────── */}
          <div className="shrink-0 border-b border-border">
            {visibleProjects.map((project) => {
              const stats = projectStats[project.projectId];
              const colorMeta = project.color
                ? PROJECT_COLOR_MAP[project.color]
                : null;
              const isActiveFilter = filterProjectId === project.projectId;
              return (
                <div
                  key={project.projectId}
                  className={[
                    "flex cursor-pointer items-center justify-between px-6 py-3 transition-colors",
                    isActiveFilter
                      ? "ring-2 ring-inset ring-ring/50 bg-accent/30"
                      : "hover:bg-muted/20",
                  ].join(" ")}
                  style={
                    colorMeta ? { backgroundColor: colorMeta.tintRgba } : undefined
                  }
                  onClick={() => handleHeaderClick(project.projectId)}
                  title={
                    isActiveFilter
                      ? "Click to clear filter"
                      : `Click to filter by project ${project.projectNumber}`
                  }
                >
                  <div className="flex items-center gap-3">
                    <ProjectIdPill
                      projectNumber={project.projectNumber}
                      color={project.color}
                    />
                    <div>
                      <div className="text-sm font-semibold leading-tight">
                        {project.projectName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {project.customerName ?? "—"}
                        {project.dueDate
                          ? ` · Due ${project.dueDate}`
                          : " · No due date"}
                      </div>
                    </div>
                    {isActiveFilter && (
                      <span className="text-[10px] font-medium text-ring/70 ml-1">
                        Filtered
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Candidates
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums">
                        {stats?.candidateCount ?? 0}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Pending Release
                      </div>
                      <div className="font-mono text-sm font-semibold tabular-nums">
                        {stats?.pendingReleaseCount ?? 0}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={(stats?.pendingReleaseCount ?? 0) === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReleaseProject(project.projectId);
                      }}
                    >
                      Release Project {project.projectNumber}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Candidate table ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto">
            {visibleCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
                <Layers className="mb-3 h-8 w-8 opacity-25" />
                <p>No candidates meet fulfillment criteria.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Project
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Parent
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Part Number
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Part Name
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Demand
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Stock
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Cumul. Demand
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Due Date
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCandidates.map((wo) => {
                    const project = state.projects.find(
                      (p) => p.projectId === wo.projectId
                    )!;
                    const isAssembly = wo.partType === "Assembly";
                    const isExpanded = expandedWoId === wo.woId;
                    const competingCandidates = getCompetingCandidates(
                      candidates,
                      wo.partId
                    );
                    const hasCompetition = competingCandidates.length > 1;

                    const stockCount = state.stockCounts[wo.partId] ?? 0;
                    const cumulativeDemand = competingCandidates.reduce(
                      (sum, c) => sum + c.quantity,
                      0
                    );
                    const cumulativeAmber = cumulativeDemand > stockCount;

                    const ancestry = getAncestryChain(state.workOrders, wo);
                    const parentPartNumber =
                      ancestry.length > 0 ? ancestry[0]!.partNumber : null;

                    return (
                      <Fragment key={wo.woId}>
                        <tr
                          className={[
                            "border-b border-border/50 hover:bg-muted/30",
                            isAssembly ? "bg-muted/10" : "",
                          ].join(" ")}
                        >
                          {/* Project */}
                          <td className="px-4 py-2">
                            <ProjectIdPill
                              projectNumber={project.projectNumber}
                              color={project.color}
                            />
                          </td>
                          {/* Parent */}
                          <td className="px-4 py-2 font-mono text-xs">
                            {parentPartNumber === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2">
                                    {parentPartNumber}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  className="font-mono text-xs whitespace-pre"
                                >
                                  {ancestry
                                    .map(
                                      (a) => `${a.partNumber} — ${a.partName}`
                                    )
                                    .join("\n")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                          {/* Part Number — with expand toggle if cross-project candidates exist */}
                          <td className="px-4 py-2 font-mono text-xs">
                            <div className="flex items-center gap-1">
                              {hasCompetition && (
                                <button
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() => handleToggleExpand(wo.woId)}
                                  title="Show competing candidates"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              {wo.partNumber}
                            </div>
                          </td>
                          {/* Part Name */}
                          <td className="max-w-[200px] px-4 py-2">
                            <span className="block truncate" title={wo.partName}>
                              {wo.partName}
                            </span>
                          </td>
                          {/* Demand */}
                          <td className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                            {wo.quantity}
                          </td>
                          {/* Stock */}
                          <td className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                            {stockCount}
                          </td>
                          {/* Cumulative Demand */}
                          <td
                            className={[
                              "px-4 py-2 text-right font-mono text-sm tabular-nums",
                              cumulativeAmber ? "text-amber-500" : "",
                            ].join(" ")}
                          >
                            {cumulativeDemand}
                          </td>
                          {/* Due Date */}
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {project.dueDate ?? "—"}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => handleFulfill(wo.woId)}
                              >
                                Fulfill from Stock
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-xs"
                                onClick={() => handlePassThrough(wo.woId)}
                              >
                                Pass Through
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() =>
                                  handleReconcile({
                                    partId: wo.partId,
                                    partNumber: wo.partNumber,
                                    partName: wo.partName,
                                  })
                                }
                              >
                                Reconcile
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {/* ── Inline competing-candidates expansion ────────── */}
                        {isExpanded && (
                          <tr key={`${wo.woId}-expand`} className="bg-muted/20">
                            <td colSpan={9} className="px-6 pb-3 pt-2">
                              <div className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                All candidate WOs for {wo.partNumber} — stock{" "}
                                {stockCount}
                              </div>
                              {competingCandidates.filter(
                                (cw) => cw.woId !== wo.woId
                              ).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                  No other candidates competing for this Part.
                                </p>
                              ) : (
                                <table className="w-full rounded border border-border/40 text-xs">
                                  <thead>
                                    <tr className="border-b border-border/40 bg-muted/30">
                                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                                        Project
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                                        Parent
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                                        Part Number
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                                        Part Name
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                                        Demand
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                                        Stock
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                                        Cumul. Demand
                                      </th>
                                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                                        Due Date
                                      </th>
                                      <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {competingCandidates
                                      .filter((cw) => cw.woId !== wo.woId)
                                      .map((cw) => {
                                        const cp = state.projects.find(
                                          (p) => p.projectId === cw.projectId
                                        )!;
                                        const cwAncestry = getAncestryChain(
                                          state.workOrders,
                                          cw
                                        );
                                        const cwParent =
                                          cwAncestry.length > 0
                                            ? cwAncestry[0]!.partNumber
                                            : null;
                                        return (
                                          <tr
                                            key={cw.woId}
                                            className="border-b border-border/30 last:border-0"
                                          >
                                            <td className="px-3 py-1.5">
                                              <ProjectIdPill
                                                projectNumber={cp.projectNumber}
                                                color={cp.color}
                                              />
                                            </td>
                                            <td className="px-3 py-1.5 font-mono">
                                              {cwParent === null ? (
                                                <span className="text-muted-foreground">
                                                  —
                                                </span>
                                              ) : (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <span className="cursor-help underline decoration-dotted underline-offset-2">
                                                      {cwParent}
                                                    </span>
                                                  </TooltipTrigger>
                                                  <TooltipContent
                                                    side="right"
                                                    className="font-mono text-xs whitespace-pre"
                                                  >
                                                    {cwAncestry
                                                      .map(
                                                        (a) =>
                                                          `${a.partNumber} — ${a.partName}`
                                                      )
                                                      .join("\n")}
                                                  </TooltipContent>
                                                </Tooltip>
                                              )}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono">
                                              {cw.partNumber}
                                            </td>
                                            <td className="px-3 py-1.5 max-w-[160px]">
                                              <span
                                                className="block truncate"
                                                title={cw.partName}
                                              >
                                                {cw.partName}
                                              </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                                              {cw.quantity}
                                            </td>
                                            <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                                              {stockCount}
                                            </td>
                                            <td
                                              className={[
                                                "px-3 py-1.5 text-right font-mono tabular-nums",
                                                cumulativeAmber
                                                  ? "text-amber-500"
                                                  : "",
                                              ].join(" ")}
                                            >
                                              {cumulativeDemand}
                                            </td>
                                            <td className="px-3 py-1.5 text-muted-foreground">
                                              {cp.dueDate ?? "—"}
                                            </td>
                                            <td className="px-3 py-1.5">
                                              <div className="flex items-center justify-end gap-1">
                                                <Button
                                                  size="sm"
                                                  className="h-5 px-1.5 text-[11px]"
                                                  onClick={() =>
                                                    handleFulfill(cw.woId)
                                                  }
                                                >
                                                  Fulfill from Stock
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-5 px-1.5 text-[11px]"
                                                  onClick={() =>
                                                    handlePassThrough(cw.woId)
                                                  }
                                                >
                                                  Pass Through
                                                </Button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Reconcile Stock modal ────────────────────────────────────────── */}
        {reconcileWo && (
          <ReconcileStockModal
            partNumber={reconcileWo.partNumber}
            partName={reconcileWo.partName}
            currentStockCount={state.stockCounts[reconcileWo.partId] ?? 0}
            onClose={() => setReconcileWo(null)}
            onConfirm={handleReconcileConfirm}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
