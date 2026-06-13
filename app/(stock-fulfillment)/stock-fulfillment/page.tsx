"use client";

import { useState, useMemo, Fragment } from "react";
import {
  useSfViewData,
  useFulfillFromStock,
  usePassThrough,
  useReconcileStock,
  useReleaseProject,
  useReleaseAll,
  type CandidateWO,
  type ProjectStats,
} from "@/lib/api/stock-fulfillment";
import { ProjectIdPill, type ProjectColor } from "@/components/project/project-id-pill";
import ReconcileStockModal from "@/components/stock-fulfillment/reconcile-stock-modal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Filter,
  Layers,
  ChevronDown,
  ChevronRight,
  Pencil,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: string): number {
  return parseFloat(v);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// bomPath is leaf-first: [immediateParent, ..., rootPart]. Empty for top-level WOs.
// Returns the immediate parent's identifier (index 0).
function getParentFromBomPath(bomPath: string[]): string | null {
  if (bomPath.length === 0) return null;
  return bomPath[0] ?? null;
}

// Strips the leading part-number token from a bomPath element, leaving only the part name.
// bomPath elements are "{partNumber} {partName}" — the part number is the first whitespace token.
function bomPathEntryToName(entry: string): string {
  const idx = entry.indexOf(" ");
  return idx === -1 ? entry : entry.slice(idx + 1);
}

// Returns ancestors root-first for breadcrumb tooltip display (reverses the leaf-first bomPath).
function getAncestryDisplay(bomPath: string[]): string[] {
  return [...bomPath].reverse();
}

// Shared column classes — keeps parent rows and expansion rows aligned via colgroup.
const CX = {
  project: "px-4 py-2",
  partNumber: "px-4 py-2 font-mono text-xs whitespace-nowrap",
  partName: "w-[200px] max-w-[200px] px-4 py-2",
  demand: "px-4 py-2 text-right font-mono text-sm tabular-nums",
  stock: "px-4 py-2 text-right font-mono text-sm tabular-nums",
  cumDemand: "px-4 py-2 text-right font-mono text-sm tabular-nums",
  dueDate: "px-4 py-2 text-xs text-muted-foreground whitespace-nowrap",
  location: "px-4 py-2 font-mono text-xs whitespace-nowrap",
  parent: "px-4 py-2 font-mono text-xs whitespace-nowrap",
  actions: "px-4 py-2",
  projectExpanded: "pl-8 pr-4 py-2",
} as const;

// ─── Confirm dialogs ──────────────────────────────────────────────────────────

type FulfillConfirm = {
  workOrderId: number;
  partNumber: string;
  quantity: number;
  isAssembly: boolean;
  descendantCount: number;
};

type ReleaseAllConfirm = {
  woCount: number;
  projectCount: number;
  projectIds?: number[];
};

type ReleaseProjectConfirm = {
  projectId: number;
  projectNumber: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockFulfillmentPage() {
  const { user } = useCurrentUser();
  const canAct = user?.role === "Manager" || user?.role === "Admin";

  const [filterProjectId, setFilterProjectId] = useState<number | null>(null);
  const [competingOnly, setCompetingOnly] = useState(false);
  const [expandedWoId, setExpandedWoId] = useState<number | null>(null);

  // Confirmation dialog state
  const [fulfillConfirm, setFulfillConfirm] = useState<FulfillConfirm | null>(null);
  const [releaseAllConfirm, setReleaseAllConfirm] = useState<ReleaseAllConfirm | null>(null);
  const [releaseProjectConfirm, setReleaseProjectConfirm] =
    useState<ReleaseProjectConfirm | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<{
    partId: number;
    partNumber: string;
    partName: string;
    stockCount: number;
  } | null>(null);

  // Fetch (unfiltered — we filter client-side for competing-only / project header visibility)
  const { data, isLoading, isError, refetch } = useSfViewData();

  const fulfillMutation = useFulfillFromStock();
  const passThroughMutation = usePassThrough();
  const reconcileMutation = useReconcileStock();
  const releaseProjectMutation = useReleaseProject();
  const releaseAllMutation = useReleaseAll();

  const isMutating =
    fulfillMutation.isPending ||
    passThroughMutation.isPending ||
    reconcileMutation.isPending ||
    releaseProjectMutation.isPending ||
    releaseAllMutation.isPending;

  // ── Derived state ────────────────────────────────────────────────────────────

  const candidates = data?.candidates ?? [];
  const projectStats = data?.projectStats ?? [];

  // projectId → color for ProjectIdPill in table rows
  const colorByProject = useMemo(() => {
    return new Map(projectStats.map((s) => [s.projectId, s.color as ProjectColor | null]));
  }, [projectStats]);

  // Build a fast lookup: partId → all candidate WOs for that part (for competing check)
  const candidatesByPart = useMemo(() => {
    const map = new Map<number, CandidateWO[]>();
    for (const c of candidates) {
      if (!map.has(c.partId)) map.set(c.partId, []);
      map.get(c.partId)!.push(c);
    }
    return map;
  }, [candidates]);

  // Visible candidates: apply project filter + competing-only toggle
  const visibleCandidates = useMemo(() => {
    let list = filterProjectId
      ? candidates.filter((c) => c.projectId === filterProjectId)
      : candidates;

    if (competingOnly) {
      list = list.filter((c) => {
        const cumDemand = toNum(c.cumulativeDemand);
        const stock = toNum(c.stockCount);
        return cumDemand > stock;
      });
    }
    return list;
  }, [candidates, filterProjectId, competingOnly]);

  // Project header cards: show only projects with unreleasedCount > 0
  const visibleProjectStats = useMemo(() => {
    const scoped = filterProjectId
      ? projectStats.filter((p) => p.projectId === filterProjectId)
      : projectStats;
    return scoped.filter((p) => p.unreleasedCount > 0);
  }, [projectStats, filterProjectId]);

  const totalPendingRelease = visibleProjectStats.reduce(
    (sum, p) => sum + p.pendingReleaseCount,
    0
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleFulfillClick(wo: CandidateWO) {
    const allForPart = candidatesByPart.get(wo.partId) ?? [];
    // Descendant count: candidates from same project that descend from this WO
    // We approximate by counting all candidates in the same project with parentWoId ancestry.
    // For the confirmation dialog we show the cascade message for assemblies.
    const descendantCount =
      wo.partType === "Assembly"
        ? candidates.filter(
            (c) =>
              c.projectId === wo.projectId &&
              c.workOrderId !== wo.workOrderId &&
              c.bomPath.includes(wo.partNumber)
          ).length
        : 0;

    setFulfillConfirm({
      workOrderId: wo.workOrderId,
      partNumber: wo.partNumber,
      quantity: toNum(wo.quantity),
      isAssembly: wo.partType === "Assembly",
      descendantCount,
    });
  }

  function handleFulfillConfirm() {
    if (!fulfillConfirm) return;
    fulfillMutation.mutate(
      { workOrderId: fulfillConfirm.workOrderId },
      {
        onSuccess: (result) => {
          setFulfillConfirm(null);
          if (expandedWoId === fulfillConfirm.workOrderId) setExpandedWoId(null);
          let msg = `Fulfilled ${fulfillConfirm.partNumber} ×${fulfillConfirm.quantity} from stock.`;
          if (result.cascadedWoIds.length > 0) {
            msg += ` ${result.cascadedWoIds.length} sub-WO${result.cascadedWoIds.length !== 1 ? "s" : ""} skipped (cascade).`;
          }
          toast.success(msg);
          if (result.autoPassedWoIds.length > 0) {
            toast.info(
              `Auto-passed ${result.autoPassedWoIds.length} WO${result.autoPassedWoIds.length !== 1 ? "s" : ""} (stock depleted).`
            );
          }
        },
        onError: (err) => {
          setFulfillConfirm(null);
          toast.error(err.message ?? "Failed to fulfill WO.");
        },
      }
    );
  }

  function handlePassThrough(wo: CandidateWO) {
    passThroughMutation.mutate(
      { workOrderId: wo.workOrderId },
      {
        onSuccess: () => {
          toast.success(
            `Passed through ${wo.partNumber} — queued for Pending Release.`
          );
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to pass through WO.");
        },
      }
    );
  }

  function handleReconcileConfirm(newCount: number, reason: string) {
    if (!reconcileTarget) return;
    reconcileMutation.mutate(
      { partId: reconcileTarget.partId, newStockCount: newCount, reason },
      {
        onSuccess: () => {
          const delta = newCount - reconcileTarget.stockCount;
          const sign = delta >= 0 ? "+" : "";
          toast.success(
            `Stock reconciled: ${reconcileTarget.partNumber} → ${newCount} (${sign}${delta})`
          );
          setReconcileTarget(null);
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to reconcile stock.");
          setReconcileTarget(null);
        },
      }
    );
  }

  function handleReleaseProjectClick(stat: ProjectStats) {
    setReleaseProjectConfirm({
      projectId: stat.projectId,
      projectNumber: stat.projectNumber,
    });
  }

  function handleReleaseProjectConfirm() {
    if (!releaseProjectConfirm) return;
    releaseProjectMutation.mutate(
      { projectId: releaseProjectConfirm.projectId },
      {
        onSuccess: (result) => {
          toast.success(
            `Released ${result.woCount} WO${result.woCount !== 1 ? "s" : ""} for Project ${releaseProjectConfirm.projectNumber}.`
          );
          setReleaseProjectConfirm(null);
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to release project WOs.");
          setReleaseProjectConfirm(null);
        },
      }
    );
  }

  function handleReleaseAllClick() {
    if (totalPendingRelease === 0) return;
    const projectIds = filterProjectId ? [filterProjectId] : undefined;
    const projectCount = projectIds
      ? 1
      : visibleProjectStats.filter((p) => p.pendingReleaseCount > 0).length;
    setReleaseAllConfirm({ woCount: totalPendingRelease, projectCount, projectIds });
  }

  function handleReleaseAllConfirm() {
    if (!releaseAllConfirm) return;
    releaseAllMutation.mutate(
      { projectIds: releaseAllConfirm.projectIds },
      {
        onSuccess: (result) => {
          toast.success(
            `Released ${result.woCount} WO${result.woCount !== 1 ? "s" : ""} to Open.`
          );
          setReleaseAllConfirm(null);
        },
        onError: (err) => {
          toast.error(err.message ?? "Failed to release WOs.");
          setReleaseAllConfirm(null);
        },
      }
    );
  }

  function handleHeaderClick(projectId: number) {
    setFilterProjectId((prev) => (prev === projectId ? null : projectId));
    setExpandedWoId(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>Failed to load Stock Fulfillment data.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-background text-foreground">

        {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-2.5">
          <div className="flex items-center gap-3">
            <Select
              value={filterProjectId ? String(filterProjectId) : "all"}
              onValueChange={(v) => {
                setFilterProjectId(v === "all" ? null : Number(v));
                setExpandedWoId(null);
              }}
            >
              <SelectTrigger className="h-7 w-52 gap-1 text-xs">
                <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="all">All Projects</SelectItem>
                {projectStats.map((p) => (
                  <SelectItem key={p.projectId} value={String(p.projectId)}>
                    {p.projectNumber}
                    {p.customerName ? ` — ${p.customerName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Switch
                id="competing-only"
                checked={competingOnly}
                onCheckedChange={setCompetingOnly}
              />
              <Label
                htmlFor="competing-only"
                className="cursor-pointer text-xs text-muted-foreground"
              >
                Competing only
              </Label>
            </div>
          </div>

          {canAct && (
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={totalPendingRelease === 0 || isMutating}
              onClick={handleReleaseAllClick}
            >
              Release All Pending ({totalPendingRelease})
            </Button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* ── Project header strip ─────────────────────────────────────────── */}
          {visibleProjectStats.length > 0 && (
            <div className="flex shrink-0 items-stretch border-b border-border">
              {/* Project cards column */}
              <div className="min-w-0 flex-1">
                {visibleProjectStats.map((stat) => {
                  const isActiveFilter = filterProjectId === stat.projectId;
                  return (
                    <div
                      key={stat.projectId}
                      className={[
                        "flex cursor-pointer items-center justify-between px-6 py-3 transition-colors",
                        isActiveFilter
                          ? "ring-2 ring-inset ring-ring/50 bg-accent/30"
                          : "hover:bg-muted/20",
                      ].join(" ")}
                      onClick={() => handleHeaderClick(stat.projectId)}
                      title={
                        isActiveFilter
                          ? "Click to clear filter"
                          : `Click to filter by project ${stat.projectNumber}`
                      }
                    >
                      <div className="flex items-center gap-3">
                        <ProjectIdPill
                          projectNumber={stat.projectNumber}
                          color={stat.color as ProjectColor | null}
                        />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold leading-tight">
                            Project {stat.projectNumber}
                            {isActiveFilter && (
                              <span className="text-[10px] font-medium text-ring/70">
                                Filtered
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {stat.customerName ?? "—"}
                            {stat.dueDate
                              ? ` · Due ${formatDate(stat.dueDate)}`
                              : " · No due date"}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="grid grid-cols-2 gap-x-3 text-right">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Cands
                            </div>
                            <div className="font-mono text-sm font-semibold tabular-nums">
                              {stat.candidateCount}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Pending
                            </div>
                            <div className="font-mono text-sm font-semibold tabular-nums">
                              {stat.pendingReleaseCount}
                            </div>
                          </div>
                        </div>
                        {canAct && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 shrink-0 text-xs"
                            disabled={stat.pendingReleaseCount === 0 || isMutating}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReleaseProjectClick(stat);
                            }}
                          >
                            Release
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info card — fixed width, outside the clickable project cards */}
              <div className="w-64 shrink-0 border-l border-border bg-muted/30 px-4 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  About This View
                </p>
                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                  <li>• Review WOs where on-hand stock meets demand</li>
                  <li>• Fulfill from stock or pass through to procurement</li>
                  <li>• Release decided WOs to the Batching queue</li>
                  <li>• Reconcile stock counts inline via the pencil icon</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── Candidate table ──────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto">
            {visibleCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-sm text-muted-foreground">
                <Layers className="mb-3 h-8 w-8 opacity-25" />
                {competingOnly ? (
                  <p>No competing candidates. Toggle off to see all rows.</p>
                ) : filterProjectId ? (
                  <p>No candidates for this project.</p>
                ) : (
                  <p>
                    No stock fulfillment candidates. All Work Orders require
                    procurement.
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <colgroup>
                  <col className="w-[80px]" />
                  <col className="w-[140px]" />
                  <col className="w-[200px]" />
                  <col className="w-[70px]" />
                  <col className="w-[90px]" />
                  <col className="w-[100px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[130px]" />
                  <col />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b border-border">
                    {(
                      [
                        ["Project", "text-left"],
                        ["Part Number", "text-left"],
                        ["Part Name", "text-left"],
                        ["Demand", "text-right"],
                        ["Stock", "text-right"],
                        ["Cumul. Demand", "text-right"],
                        ["Due Date", "text-left"],
                        ["Location", "text-left"],
                        ["Parent", "text-left"],
                        ["Actions", "text-right"],
                      ] as const
                    ).map(([label, align]) => (
                      <th
                        key={label}
                        className={`px-4 py-2 ${align} text-[10px] font-medium uppercase tracking-wide text-muted-foreground`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleCandidates.map((wo) => {
                    const isAssembly = wo.partType === "Assembly";
                    const isExpanded = expandedWoId === wo.workOrderId;
                    const allForPart = candidatesByPart.get(wo.partId) ?? [];
                    const competitors = allForPart.filter(
                      (c) => c.workOrderId !== wo.workOrderId
                    );
                    const hasCompetition = competitors.length > 0;

                    const stockNum = toNum(wo.stockCount);
                    const cumDemand = toNum(wo.cumulativeDemand);
                    const cumulativeAmber = cumDemand > stockNum;

                    const parentPartNumber = getParentFromBomPath(wo.bomPath);
                    const ancestryDisplay = getAncestryDisplay(wo.bomPath);

                    return (
                      <Fragment key={wo.workOrderId}>
                        {/* ── Candidate row ──────────────────────────────── */}
                        <tr
                          className={[
                            "border-b border-border/50 hover:bg-muted/30",
                            isAssembly ? "bg-muted/10" : "",
                          ].join(" ")}
                        >
                          {/* Project */}
                          <td className={CX.project}>
                            <ProjectIdPill
                              projectNumber={wo.projectNumber}
                              color={colorByProject.get(wo.projectId) ?? null}
                            />
                          </td>

                          {/* Part Number + expand toggle */}
                          <td className={CX.partNumber}>
                            <div className="flex items-center gap-1">
                              {hasCompetition && (
                                <button
                                  className="text-muted-foreground hover:text-foreground"
                                  onClick={() =>
                                    setExpandedWoId((prev) =>
                                      prev === wo.workOrderId ? null : wo.workOrderId
                                    )
                                  }
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
                          <td className={CX.partName}>
                            <span className="block truncate" title={wo.partName}>
                              {wo.partName}
                            </span>
                          </td>

                          {/* Demand */}
                          <td className={CX.demand}>{toNum(wo.quantity)}</td>

                          {/* Stock + reconcile icon (parent rows only) */}
                          <td className={CX.stock}>
                            <div className="flex items-center justify-end gap-2">
                              <span>{stockNum}</span>
                              {canAct && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() =>
                                        setReconcileTarget({
                                          partId: wo.partId,
                                          partNumber: wo.partNumber,
                                          partName: wo.partName,
                                          stockCount: stockNum,
                                        })
                                      }
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    Reconcile stock
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>

                          {/* Cumulative Demand */}
                          <td
                            className={[
                              CX.cumDemand,
                              cumulativeAmber ? "text-amber-500" : "",
                            ].join(" ")}
                          >
                            {cumDemand}
                          </td>

                          {/* Due Date */}
                          <td className={CX.dueDate}>{formatDate(wo.dueDate)}</td>

                          {/* Location */}
                          <td className={CX.location}>
                            {wo.inventoryLocation ?? "—"}
                          </td>

                          {/* Parent with bomPath tooltip */}
                          <td className={CX.parent}>
                            {parentPartNumber === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="block max-w-[160px] cursor-help overflow-hidden text-ellipsis whitespace-nowrap underline decoration-dotted underline-offset-2"
                                    title={parentPartNumber}
                                  >
                                    {bomPathEntryToName(parentPartNumber)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  className="whitespace-pre font-mono text-xs"
                                >
                                  {ancestryDisplay.join("\n")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>

                          {/* Actions */}
                          <td className={CX.actions}>
                            {canAct && (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  disabled={isMutating}
                                  onClick={() => handleFulfillClick(wo)}
                                >
                                  Fulfill from Stock
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  disabled={isMutating}
                                  onClick={() => handlePassThrough(wo)}
                                >
                                  Pass Through
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* ── Expansion: label row ──────────────────────── */}
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td
                              colSpan={10}
                              className="px-8 pb-1 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground"
                            >
                              All candidate WOs for {wo.partNumber} — stock {stockNum}
                            </td>
                          </tr>
                        )}

                        {/* ── Expansion: competitor rows ────────────────── */}
                        {isExpanded &&
                          (competitors.length === 0 ? (
                            <tr className="bg-muted/20">
                              <td
                                colSpan={10}
                                className="px-8 pb-3 text-xs italic text-muted-foreground"
                              >
                                No other candidates competing for this Part.
                              </td>
                            </tr>
                          ) : (
                            competitors.map((cw) => {
                              const cwParent = getParentFromBomPath(cw.bomPath);
                              const cwAncestry = getAncestryDisplay(cw.bomPath);
                              return (
                                <tr
                                  key={`${wo.workOrderId}-cw-${cw.workOrderId}`}
                                  className="border-b border-border/30 bg-muted/20 hover:bg-muted/40"
                                >
                                  <td className={CX.projectExpanded}>
                                    <ProjectIdPill
                                      projectNumber={cw.projectNumber}
                                      color={colorByProject.get(cw.projectId) ?? null}
                                    />
                                  </td>
                                  <td className={CX.partNumber}>{cw.partNumber}</td>
                                  <td className={CX.partName}>
                                    <span
                                      className="block truncate"
                                      title={cw.partName}
                                    >
                                      {cw.partName}
                                    </span>
                                  </td>
                                  <td className={CX.demand}>{toNum(cw.quantity)}</td>
                                  {/* Stock — value only, no reconcile icon on expansion rows */}
                                  <td className={CX.stock}>{stockNum}</td>
                                  <td
                                    className={[
                                      CX.cumDemand,
                                      cumulativeAmber ? "text-amber-500" : "",
                                    ].join(" ")}
                                  >
                                    {cumDemand}
                                  </td>
                                  <td className={CX.dueDate}>{formatDate(cw.dueDate)}</td>
                                  <td className={CX.location}>
                                    {cw.inventoryLocation ?? "—"}
                                  </td>
                                  <td className={CX.parent}>
                                    {cwParent === null ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="cursor-help underline decoration-dotted underline-offset-2">
                                            {cwParent}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="right"
                                          className="whitespace-pre font-mono text-xs"
                                        >
                                          {cwAncestry.join("\n")}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </td>
                                  <td className={CX.actions}>
                                    {canAct && (
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          size="sm"
                                          className="h-5 px-1.5 text-[11px]"
                                          disabled={isMutating}
                                          onClick={() => handleFulfillClick(cw)}
                                        >
                                          Fulfill from Stock
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-5 px-1.5 text-[11px]"
                                          disabled={isMutating}
                                          onClick={() => handlePassThrough(cw)}
                                        >
                                          Pass Through
                                        </Button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          ))}

                        {/* ── Expansion: closing spacer ─────────────────── */}
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={10} className="pb-2" />
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

        {/* ── Fulfill confirmation dialog ──────────────────────────────────── */}
        <AlertDialog
          open={fulfillConfirm !== null}
          onOpenChange={(open) => { if (!open) setFulfillConfirm(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fulfill from Stock?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-1">
                  <p>
                    Fulfill WO <span className="font-mono font-medium">{fulfillConfirm?.partNumber}</span> from
                    stock? <span className="font-semibold">{fulfillConfirm?.quantity}</span> units will be
                    deducted from stock.
                  </p>
                  {fulfillConfirm?.isAssembly && fulfillConfirm.descendantCount > 0 && (
                    <p className="text-amber-600 dark:text-amber-400">
                      Assembly fulfillment cascades to all {fulfillConfirm.descendantCount} descendant Work{" "}
                      Order{fulfillConfirm.descendantCount !== 1 ? "s" : ""}.
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={fulfillMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFulfillConfirm}
                disabled={fulfillMutation.isPending}
              >
                {fulfillMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Fulfill from Stock
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Release project confirmation ─────────────────────────────────── */}
        <AlertDialog
          open={releaseProjectConfirm !== null}
          onOpenChange={(open) => { if (!open) setReleaseProjectConfirm(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Release Project?</AlertDialogTitle>
              <AlertDialogDescription>
                Release all pending Work Orders for Project{" "}
                <span className="font-mono font-medium">
                  {releaseProjectConfirm?.projectNumber}
                </span>
                ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={releaseProjectMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReleaseProjectConfirm}
                disabled={releaseProjectMutation.isPending}
              >
                {releaseProjectMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Release
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Release all confirmation ─────────────────────────────────────── */}
        <AlertDialog
          open={releaseAllConfirm !== null}
          onOpenChange={(open) => { if (!open) setReleaseAllConfirm(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Release All Pending?</AlertDialogTitle>
              <AlertDialogDescription>
                Release{" "}
                <span className="font-semibold">{releaseAllConfirm?.woCount}</span>{" "}
                pending Work Order{releaseAllConfirm?.woCount !== 1 ? "s" : ""} across{" "}
                {releaseAllConfirm?.projectCount === 1
                  ? "1 project"
                  : `${releaseAllConfirm?.projectCount} projects`}
                ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={releaseAllMutation.isPending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReleaseAllConfirm}
                disabled={releaseAllMutation.isPending}
              >
                {releaseAllMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Release All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Reconcile Stock modal ────────────────────────────────────────── */}
        {reconcileTarget && (
          <ReconcileStockModal
            partNumber={reconcileTarget.partNumber}
            partName={reconcileTarget.partName}
            currentStockCount={reconcileTarget.stockCount}
            onClose={() => setReconcileTarget(null)}
            onConfirm={handleReconcileConfirm}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
