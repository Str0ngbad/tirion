"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, ChevronsUpDown, Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ProjectIdPill } from "@/components/project/project-id-pill";
import type { ProjectRow, ProjectStatus } from "@/lib/api/projects";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cls: Record<ProjectStatus, string> = {
    Draft:    "border-amber-400 bg-amber-50 text-amber-700",
    Active:   "border-blue-500 bg-blue-50 text-blue-700",
    Complete: "border-emerald-500 bg-emerald-50 text-emerald-700",
    Archived: "border-muted-foreground/40 text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`text-xs ${cls[status]}`}>
      {status}
    </Badge>
  );
}

// ─── Progress cell ────────────────────────────────────────────────────────────

type ValidationState = { status: "loading" | "pass" | "fail"; count: number };
type WoCountState = { status: "loading" | "done"; total: number; complete: number };

function ProgressCell({
  project,
  validation,
  woCounts,
}: {
  project: ProjectRow;
  validation: ValidationState | undefined;
  woCounts: WoCountState | undefined;
}) {
  if (project.status === "Archived") {
    return <span className="text-xs text-muted-foreground/50">Archived</span>;
  }

  if (project.status === "Draft") {
    if (!validation || validation.status === "loading") {
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking…
        </span>
      );
    }
    if (validation.status === "pass") {
      return (
        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ready to compile
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
        <AlertTriangle className="h-3.5 w-3.5" />
        {validation.count} validation {validation.count === 1 ? "issue" : "issues"}
      </span>
    );
  }

  // Active or Complete
  if (!woCounts || woCounts.status === "loading") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading…
      </span>
    );
  }

  const pct = woCounts.total === 0 ? 0 : Math.round((woCounts.complete / woCounts.total) * 100);
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <span className="text-xs text-muted-foreground">
        {woCounts.complete} / {woCounts.total} complete
      </span>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortField = "projectNumber" | "projectName" | "status" | "customerName" | "dueDate" | "createdAt" | "lastEditedAt";
type SortDir = "asc" | "desc";

function SortIcon({ field, active, dir }: { field: SortField; active: SortField; dir: SortDir }) {
  if (field !== active)
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50 ml-1 shrink-0" />;
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 text-foreground ml-1 shrink-0" />
    : <ChevronDown className="h-3 w-3 text-foreground ml-1 shrink-0" />;
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  projects: ProjectRow[];
  canManage: boolean;
  onDelete: (projectId: number) => void;
  isDeleting: boolean;
};

export function ProjectListTable({ projects, canManage, onDelete, isDeleting }: Props) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>("lastEditedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pendingDelete, setPendingDelete] = useState<ProjectRow | null>(null);

  const [validations, setValidations] = useState<Record<number, ValidationState>>({});
  const [woCounts, setWoCounts] = useState<Record<number, WoCountState>>({});

  // Fire parallel fetches after projects load
  useEffect(() => {
    if (projects.length === 0) return;

    const drafts = projects.filter((p) => p.status === "Draft");
    const active = projects.filter((p) => p.status === "Active" || p.status === "Complete");

    if (drafts.length > 0) {
      setValidations(
        Object.fromEntries(drafts.map((p) => [p.projectId, { status: "loading", count: 0 }]))
      );
      Promise.all(
        drafts.map(async (p) => {
          try {
            const res = await fetch(`/api/v1/projects/${p.projectId}/validate`, { method: "POST" });
            const data = await res.json();
            const count: number = data.failures?.length ?? 0;
            setValidations((prev) => ({
              ...prev,
              [p.projectId]: { status: count === 0 ? "pass" : "fail", count },
            }));
          } catch {
            setValidations((prev) => ({
              ...prev,
              [p.projectId]: { status: "fail", count: 0 },
            }));
          }
        })
      );
    }

    if (active.length > 0) {
      setWoCounts(
        Object.fromEntries(active.map((p) => [p.projectId, { status: "loading", total: 0, complete: 0 }]))
      );
      Promise.all(
        active.map(async (p) => {
          try {
            const res = await fetch(`/api/v1/projects/${p.projectId}/wo-counts`);
            const data = await res.json();
            setWoCounts((prev) => ({
              ...prev,
              [p.projectId]: { status: "done", total: data.total ?? 0, complete: data.complete ?? 0 },
            }));
          } catch {
            setWoCounts((prev) => ({
              ...prev,
              [p.projectId]: { status: "done", total: 0, complete: 0 },
            }));
          }
        })
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      const av: string | null = a[sortField] as string | null;
      const bv: string | null = b[sortField] as string | null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [projects, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function handleRowClick(project: ProjectRow) {
    if (project.status === "Draft") {
      router.push(`/projects/${project.projectId}/edit`);
    } else {
      router.push(`/projects/${project.projectId}`);
    }
  }

  function handleDeleteConfirm() {
    if (!pendingDelete) return;
    onDelete(pendingDelete.projectId);
    setPendingDelete(null);
  }

  const Th = ({ field, label, className = "" }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`sticky top-0 z-10 border-b border-border bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground ${className}`}
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center">
        {label}
        <SortIcon field={field} active={sortField} dir={sortDir} />
      </span>
    </th>
  );

  return (
    <>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th field="projectNumber" label="Project #" className="w-36" />
              <Th field="projectName"   label="Name"      className="min-w-[200px]" />
              <Th field="status"        label="Status"    className="w-28" />
              <Th field="customerName"  label="Customer"  className="w-40" />
              <Th field="dueDate"       label="Due Date"  className="w-32" />
              <th className="sticky top-0 z-10 border-b border-border bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground w-36">
                Created By
              </th>
              <Th field="lastEditedAt"  label="Last Edited" className="w-44" />
              <th className="sticky top-0 z-10 border-b border-border bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground w-44">
                Progress
              </th>
              {canManage && (
                <th className="sticky top-0 z-10 border-b border-border bg-background w-10" />
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((project) => (
              <tr
                key={project.projectId}
                onClick={() => handleRowClick(project)}
                className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-2 text-xs">
                  <ProjectIdPill projectNumber={project.projectNumber} color={project.color} />
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium">{project.projectName}</span>
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={project.status} />
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">
                  {project.customerName ?? <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2 text-sm">
                  {formatDate(project.dueDate)}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {project.creator.displayName}
                  <br />
                  <span className="text-muted-foreground/60">{formatDate(project.createdAt)}</span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                  {relativeTime(project.lastEditedAt)}
                  <br />
                  <span className="text-muted-foreground/60">{project.lastEditedBy.displayName}</span>
                </td>
                <td className="px-3 py-2 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
                  <ProgressCell
                    project={project}
                    validation={validations[project.projectId]}
                    woCounts={woCounts[project.projectId]}
                  />
                </td>
                {canManage && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {project.status === "Draft" && (
                      <button
                        disabled={isDeleting}
                        onClick={(e) => { e.stopPropagation(); setPendingDelete(project); }}
                        className="rounded p-1 transition-colors text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                        title="Delete Draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {pendingDelete?.projectNumber} — {pendingDelete?.projectName}? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
