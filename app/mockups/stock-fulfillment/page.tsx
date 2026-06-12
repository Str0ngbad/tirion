"use client";

import { useState, useMemo } from "react";
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
import { Filter, Layers } from "lucide-react";

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

  // Placeholder handlers — wired in subsequent commits
  function handleFulfill(_woId: number) { /* Commit 5 */ }
  function handlePassThrough(_woId: number) { /* Commit 6 */ }
  function handleReconcile(_woId: number) { /* Commit 4 */ }
  function handleReleaseProject(_projectId: number) { /* Commit 7 */ }
  function handleReleaseAll() { /* Commit 7 */ }

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
          disabled
        >
          Release All
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
                    disabled
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

                  return (
                    <tr
                      key={wo.woId}
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
                      {/* Part Number */}
                      <td className="px-4 py-2 font-mono text-xs">
                        {wo.partNumber}
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
                            disabled
                          >
                            Fulfill from Stock
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-xs"
                            onClick={() => handlePassThrough(wo.woId)}
                            disabled
                          >
                            Pass Through
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleReconcile(wo.woId)}
                            disabled
                          >
                            Reconcile
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
