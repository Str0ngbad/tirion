"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  MockProject,
  ProjectStatus,
  woCountSummary,
  createNewProject,
  setSessionProjects,
} from "../_data";
import { validateProject, failCount, allPass } from "../_lib/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField =
  | "projectNumber"
  | "projectName"
  | "customerName"
  | "status"
  | "dueDate"
  | "topLevelCount"
  | "createdAt"
  | "lastEditedAt";
type SortDir = "asc" | "desc";

type Props = {
  projects: MockProject[];
  setProjects: (fn: (prev: MockProject[]) => MockProject[]) => void;
};

// ─── Validation status label for Drafts ──────────────────────────────────────

function DraftValidationBadge({ project }: { project: MockProject }) {
  if (project.topLevelItems.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>;

  const nodes = validateProject(
    project.topLevelItems.map((tl) => ({
      partId: tl.partId,
      quantity: tl.quantity,
      topLevelIndex: tl.topLevelIndex,
      partNumber: tl.partNumber,
    }))
  );

  if (allPass(nodes))
    return (
      <Badge variant="outline" className="border-emerald-500 bg-emerald-50 text-emerald-700 text-xs">
        Pass
      </Badge>
    );

  const count = failCount(nodes);
  return (
    <Badge variant="outline" className="border-destructive bg-destructive/10 text-destructive text-xs">
      {count} {count === 1 ? "issue" : "issues"}
    </Badge>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cls: Record<ProjectStatus, string> = {
    Draft:    "border-amber-400 bg-amber-50 text-amber-700",
    Active:   "border-emerald-500 bg-emerald-50 text-emerald-700",
    Complete: "border-sky-500 bg-sky-50 text-sky-700",
    Archived: "border-muted-foreground/40 text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`text-xs ${cls[status]}`}>
      {status}
    </Badge>
  );
}

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({
  field,
  active,
  dir,
}: {
  field: SortField;
  active: SortField;
  dir: SortDir;
}) {
  if (field !== active)
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50 ml-1 shrink-0" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-foreground ml-1 shrink-0" />
  ) : (
    <ChevronDown className="h-3 w-3 text-foreground ml-1 shrink-0" />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: ProjectStatus[] = ["Draft", "Active", "Complete", "Archived"];

export default function ProjectList({ projects, setProjects }: Props) {
  const router = useRouter();

  // Filters
  const [statusFilter, setStatusFilter] = useState<Set<ProjectStatus>>(
    new Set(["Draft", "Active", "Complete"])
  );
  const [customerFilter, setCustomerFilter] = useState<Set<string>>(new Set());

  // Sort
  const [sortField, setSortField] = useState<SortField>("lastEditedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MockProject | null>(null);

  const allCustomers = useMemo(() => {
    const names = new Set<string>();
    projects.forEach((p) => { if (p.customerName) names.add(p.customerName); });
    return Array.from(names).sort();
  }, [projects]);

  // Filtered + sorted rows
  const rows = useMemo(() => {
    let list = projects.filter((p) => statusFilter.has(p.status));
    if (customerFilter.size > 0) {
      list = list.filter((p) => p.customerName && customerFilter.has(p.customerName));
    }
    list = [...list].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      switch (sortField) {
        case "projectNumber":  av = a.projectNumber;  bv = b.projectNumber;  break;
        case "projectName":    av = a.projectName;    bv = b.projectName;    break;
        case "customerName":   av = a.customerName;   bv = b.customerName;   break;
        case "status":         av = a.status;         bv = b.status;         break;
        case "dueDate":        av = a.dueDate;        bv = b.dueDate;        break;
        case "topLevelCount":  av = a.topLevelItems.length; bv = b.topLevelItems.length; break;
        case "createdAt":      av = a.createdAt;      bv = b.createdAt;      break;
        case "lastEditedAt":   av = a.lastEditedAt;   bv = b.lastEditedAt;   break;
      }
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [projects, statusFilter, customerFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function toggleStatus(s: ProjectStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function toggleCustomer(c: string) {
    setCustomerFilter((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  }

  function handleRowClick(project: MockProject) {
    router.push(`/mockups/project-creation/${project.projectId}`);
  }

  function handleAddNewProject() {
    const newProject = createNewProject();
    // Imperatively update the session store before navigating so the detail page
    // can find the new project in getSessionProjects(). The local state update will
    // follow on return (list page re-mounts and reads from session store).
    const updated = [...projects, newProject];
    setSessionProjects(updated);
    setProjects(() => updated);
    router.push(`/mockups/project-creation/${newProject.projectId}`);
  }

  function handleDelete(e: React.MouseEvent, project: MockProject) {
    e.stopPropagation();
    setDeleteTarget(project);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setProjects((prev) => prev.filter((p) => p.projectId !== deleteTarget.projectId));
    setDeleteTarget(null);
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  }

  const Th = ({
    field,
    label,
    className = "",
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => (
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2">
        {/* Status filter chips */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                statusFilter.has(s)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Customer filter */}
        {allCustomers.length > 0 && (
          <div className="flex items-center gap-1 border-l border-border pl-3">
            <span className="text-xs text-muted-foreground">Customer:</span>
            {allCustomers.map((c) => (
              <button
                key={c}
                onClick={() => toggleCustomer(c)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  customerFilter.has(c)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{rows.length} project{rows.length !== 1 ? "s" : ""}</span>

          <Button size="sm" onClick={handleAddNewProject} className="h-7 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <Th field="projectNumber" label="Project #"   className="w-28" />
              <Th field="projectName"   label="Name"        className="min-w-[200px]" />
              <Th field="customerName"  label="Customer"    className="w-40" />
              <Th field="status"        label="Status"      className="w-24" />
              <Th field="dueDate"       label="Due Date"    className="w-32" />
              <Th field="topLevelCount" label="Top Levels"  className="w-24" />
              <th className="sticky top-0 z-10 border-b border-border bg-background px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">
                Progress
              </th>
              <Th field="createdAt"     label="Created"     className="w-36" />
              <Th field="lastEditedAt"  label="Last Edited" className="w-44" />
              <th className="sticky top-0 z-10 border-b border-border bg-background w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  No projects match the current filters.
                </td>
              </tr>
            )}
            {rows.map((project) => {
              const { total, complete } = woCountSummary(project);
              return (
                <tr
                  key={project.projectId}
                  onClick={() => handleRowClick(project)}
                  className="cursor-pointer border-b border-border/60 hover:bg-muted/50 transition-colors"
                >
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{project.projectNumber}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{project.projectName}</span>
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {project.customerName ?? <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={project.status} />
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {formatDate(project.dueDate)}
                  </td>
                  <td className="px-3 py-2 text-sm text-center tabular-nums">
                    {project.topLevelItems.length}
                  </td>
                  <td className="px-3 py-2">
                    {project.status === "Draft" ? (
                      project.topLevelItems.length === 0 ? (
                        <span className="text-xs text-muted-foreground/60">Not yet validated</span>
                      ) : (
                        <DraftValidationBadge project={project} />
                      )
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {complete}/{total} complete
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {project.createdByName}
                    <br />
                    <span className="text-muted-foreground/60">{formatDate(project.createdAt)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {project.lastEditedByName}
                    <br />
                    <span className="text-muted-foreground/60">{formatDateTime(project.lastEditedAt)}</span>
                  </td>
                  <td className="px-3 py-2">
                    {project.status === "Draft" && (
                      <button
                        onClick={(e) => handleDelete(e, project)}
                        className="rounded p-1 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete Draft"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Draft Project {deleteTarget?.projectNumber}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The Draft and all its top-level item definitions will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
