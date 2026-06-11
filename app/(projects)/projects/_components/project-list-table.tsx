"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, ChevronsUpDown, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

// ─── Two-click delete state ───────────────────────────────────────────────────

type DeleteState = { projectId: number; timer: ReturnType<typeof setTimeout> } | null;

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  projects: ProjectRow[];
  canManage: boolean; // Manager or Admin
  onDelete: (projectId: number) => void;
  isDeleting: boolean;
};

export function ProjectListTable({ projects, canManage, onDelete, isDeleting }: Props) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>("lastEditedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteState, setDeleteState] = useState<DeleteState>(null);

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

  function handleDeleteClick(e: React.MouseEvent, projectId: number) {
    e.stopPropagation();

    if (deleteState?.projectId === projectId) {
      // Second click — confirm
      clearTimeout(deleteState.timer);
      setDeleteState(null);
      onDelete(projectId);
      return;
    }

    // First click — arm with 3-second timeout
    if (deleteState) clearTimeout(deleteState.timer);
    const timer = setTimeout(() => setDeleteState(null), 3_000);
    setDeleteState({ projectId, timer });
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
            {canManage && (
              <th className="sticky top-0 z-10 border-b border-border bg-background w-10" />
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((project) => {
            const isArmed = deleteState?.projectId === project.projectId;
            return (
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
                {canManage && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {project.status === "Draft" && (
                      <button
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteClick(e, project.projectId)}
                        className={`rounded p-1 transition-colors ${
                          isArmed
                            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            : "text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
                        }`}
                        title={isArmed ? "Click again to confirm deletion" : "Delete Draft"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
