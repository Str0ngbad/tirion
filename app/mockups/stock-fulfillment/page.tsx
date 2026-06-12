"use client";

import { useState, useMemo, Fragment } from "react";
import {
  INITIAL_SF_STATE,
  type SfState,
  type SfWorkOrder,
  computeCandidates,
  computeProjectStats,
  PROJECT_COLOR_MAP,
} from "./_data";
import ProjectIdPill from "@/app/mockups/project-creation/_components/project-id-pill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ReconcileStockModal from "@/app/mockups/_shared/reconcile-stock-modal";
import { reconcileStock, fulfillWo, passThrough, getCompetingWos, releaseProject, releaseAll } from "./_data";

export default function StockFulfillmentPage() {
  const [state, setState] = useState<SfState>(() => ({
    ...INITIAL_SF_STATE,
    workOrders: [...INITIAL_SF_STATE.workOrders],
    stockCounts: { ...INITIAL_SF_STATE.stockCounts },
    auditLog: [],
  }));

  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  // expandedWoId: the WO row with the cross-project competition panel open (Commit 6)
  const [expandedWoId, setExpandedWoId] = useState<number | null>(null);
  // reconcileWo: the WO whose part is being reconciled (opens shared modal)
  const [reconcileWo, setReconcileWo] = useState<{ partId: number; partNumber: string; partName: string } | null>(null);

  const candidates = useMemo(() => computeCandidates(state), [state]);
  const projectStats = useMemo(
    () => computeProjectStats(state, candidates),
    [state, candidates]
  );

  const visibleCandidates = filterProjectId
    ? candidates.filter((c) => c.projectId === filterProjectId)
    : candidates;

  const visibleProjects = filterProjectId
    ? state.projects.filter((p) => p.projectId === filterProjectId)
    : state.projects;

  function handleFulfill(woId: number) {
    const result = fulfillWo(state, woId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setState(result.state);

    const wo = state.workOrders.find((w) => w.woId === woId)!;
    const isAssembly = wo.partType === "Assembly";
    const descendantCount = result.state.workOrders.filter(
      (w) => w.status === "Skipped" && !state.workOrders.find((old) => old.woId === w.woId && old.status === "Skipped")
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
    toast.success(`Passed through ${wo.partNumber} — WO queued for Pending Release.`);
  }

  function handleToggleExpand(woId: number) {
    setExpandedWoId((prev) => (prev === woId ? null : woId));
  }
  function handleReleaseProject(projectId: number) {
    const before = state.workOrders.filter(
      (w) => w.projectId === projectId && w.status === "Unreleased"
    ).length;
    if (before === 0) {
      toast.info("No unreleased WOs to release for this project.");
      return;
    }
    setState(releaseProject(state, projectId));
    const proj = state.projects.find((p) => p.projectId === projectId)!;
    toast.success(`Released ${before} WO${before !== 1 ? "s" : ""} for project ${proj.projectNumber} to Open.`);
  }

  function handleReleaseAll() {
    const scope = filterProjectId ? [filterProjectId] : undefined;
    const before = state.workOrders.filter(
      (w) => w.status === "Unreleased" && (scope ? scope.includes(w.projectId) : true)
    ).length;
    if (before === 0) {
      toast.info("No unreleased WOs to release.");
      return;
    }
    setState(releaseAll(state, scope));
    toast.success(
      `Released ${before} WO${before !== 1 ? "s" : ""} to Open${filterProjectId ? " for filtered project" : " across all projects"}.`
    );
  }

  function handleReconcile(wo: { partId: number; partNumber: string; partName: string }) {
    setReconcileWo(wo);
  }

  function handleReconcileConfirm(newCount: number, reason: string) {
    if (!reconcileWo) return;
    const newState = reconcileStock(state, reconcileWo.partId, newCount, reason);
    setState(newState);

    // Report auto-pass-throughs that fired as a result of the reconciliation
    const autoPassed = newState.auditLog
      .filter(
        (e) =>
          e.action === "AutoPassThrough" &&
          e.partId === reconcileWo.partId &&
          !state.auditLog.some((old) => old.id === e.id)
      )
      .length;

    const delta = newCount - (state.stockCounts[reconcileWo.partId] ?? 0);
    const sign = delta >= 0 ? "+" : "";
    toast.success(
      `Stock reconciled: ${reconcileWo.partNumber} → ${newCount} (${sign}${delta})${autoPassed > 0 ? `. ${autoPassed} WO${autoPassed !== 1 ? "s" : ""} auto-passed through.` : ""}`
    );
    setReconcileWo(null);
  }

  return (
    <div className="flex h-screen flex-col bg-background font-sans text-foreground">
      {/* ── Chrome ──────────────────────────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center border-b border-border bg-background px-4">
        <span className="text-sm font-medium text-muted-foreground">Tirion</span>
        <span className="mx-2 text-muted-foreground/40">/</span>
        <span className="text-sm font-semibold text-foreground">Stock Fulfillment</span>
      </div>

      {/* ── Top action bar ──────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-2.5">
        <div className="flex items-center gap-2">
          <Select
            value={filterProjectId ? String(filterProjectId) : "all"}
            onValueChange={(v) =>
              setFilterProjectId(v === "all" ? null : Number(v))
            }
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
        >
          {filterProjectId ? "Release Project" : "Release All"}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* ── Project header strip ─────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-border">
          {visibleProjects.map((project, i) => {
            const stats = projectStats[project.projectId];
            const colorMeta = project.color
              ? PROJECT_COLOR_MAP[project.color]
              : null;
            return (
              <div
                key={project.projectId}
                className="flex items-center justify-between px-6 py-3"
                style={
                  colorMeta
                    ? { backgroundColor: colorMeta.tintRgba }
                    : undefined
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
                    onClick={() => handleReleaseProject(project.projectId)}
                  >
                    Release ({stats?.unreleasedCount ?? 0})
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
                    Part Number
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Part Name
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    BOM Position
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Stock
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Demand
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
                  const colorMeta = project.color
                    ? PROJECT_COLOR_MAP[project.color]
                    : null;
                  const isExpanded = expandedWoId === wo.woId;
                  const competing = getCompetingWos(state, wo.partId);
                  const hasCompetition = competing.length > 1;

                  return (
                    <Fragment key={wo.woId}>
                      <tr
                        className="border-b border-border/50 hover:bg-muted/30"
                        style={
                          colorMeta
                            ? { backgroundColor: colorMeta.tintRgba }
                            : undefined
                        }
                      >
                      {/* Project */}
                      <td className="px-4 py-2">
                        <ProjectIdPill
                          projectNumber={project.projectNumber}
                          color={project.color}
                        />
                      </td>
                      {/* Part Number — with expand toggle if cross-project competition exists */}
                      <td className="px-4 py-2 font-mono text-xs">
                        <div className="flex items-center gap-1">
                          {hasCompetition && (
                            <button
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => handleToggleExpand(wo.woId)}
                              title="Show cross-project competition"
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
                        <span
                          className="block truncate"
                          title={wo.partName}
                        >
                          {wo.partName}
                        </span>
                      </td>
                      {/* Type */}
                      <td className="px-4 py-2">
                        <Badge
                          variant={isAssembly ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {wo.partType}
                        </Badge>
                      </td>
                      {/* BOM Position */}
                      <td className="max-w-[220px] px-4 py-2">
                        <span
                          className="block truncate font-mono text-xs text-muted-foreground"
                          title={wo.bomPath.join(" › ")}
                        >
                          {wo.bomPath.join(" › ")}
                        </span>
                      </td>
                      {/* Stock */}
                      <td className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                        {state.stockCounts[wo.partId] ?? 0}
                      </td>
                      {/* Demand */}
                      <td className="px-4 py-2 text-right font-mono text-sm tabular-nums">
                        {wo.quantity}
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
                      {/* ── Inline cross-project competition panel ────────── */}
                      {isExpanded && (
                        <tr key={`${wo.woId}-expand`} className="bg-muted/20">
                          <td colSpan={9} className="px-6 pb-3 pt-2">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                              All WOs for {wo.partNumber} — cumulative demand vs. stock {state.stockCounts[wo.partId] ?? 0}
                            </div>
                            <table className="w-full text-xs border border-border/40 rounded">
                              <thead>
                                <tr className="border-b border-border/40 bg-muted/30">
                                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Project</th>
                                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">BOM Position</th>
                                  <th className="px-3 py-1.5 text-right font-medium text-muted-foreground">Demand</th>
                                  <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {competing.map((cw) => {
                                  const cp = state.projects.find((p) => p.projectId === cw.projectId)!;
                                  return (
                                    <tr key={cw.woId} className="border-b border-border/30 last:border-0">
                                      <td className="px-3 py-1.5">
                                        <ProjectIdPill projectNumber={cp.projectNumber} color={cp.color} />
                                      </td>
                                      <td className="px-3 py-1.5 font-mono text-muted-foreground">
                                        {cw.bomPath.join(" › ")}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                                        {cw.quantity}
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <span className={
                                          cw.status === "Complete" ? "text-emerald-500" :
                                          cw.status === "Skipped" ? "text-muted-foreground" :
                                          cw.reviewedAt !== null ? "text-amber-500" :
                                          "text-foreground"
                                        }>
                                          {cw.status === "Unreleased" && cw.reviewedAt !== null
                                            ? "Pending Release"
                                            : cw.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
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
  );
}
