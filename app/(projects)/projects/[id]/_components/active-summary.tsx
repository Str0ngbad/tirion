"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUpdateProject, useArchiveProject, type ProjectDetail } from "@/lib/api/projects";
import { useCurrentUser } from "@/lib/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, CheckCircle2, ExternalLink, Clock } from "lucide-react";

type SavingState = "idle" | "saving" | "error";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRef(projectNumber: string, topLevelIndex: number): string {
  return `${projectNumber}.${String(topLevelIndex).padStart(2, "0")}`;
}

type Props = {
  initialProject: ProjectDetail;
};

export function ActiveSummary({ initialProject }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canEdit =
    (user?.role === "Manager" || user?.role === "Admin") &&
    initialProject.status !== "Archived";
  const canArchive =
    (user?.role === "Manager" || user?.role === "Admin") &&
    (initialProject.status === "Complete" || initialProject.status === "Active");

  const [project, setProject] = useState<ProjectDetail>(initialProject);
  const [saving, setSaving] = useState<SavingState>("idle");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const updateProject = useUpdateProject();
  const archiveProject = useArchiveProject();

  // Local field state for controlled inputs
  const [localFields, setLocalFields] = useState({
    projectName: project.projectName,
    customerName: project.customerName ?? "",
    notes: project.notes ?? "",
  });

  function handleFieldChange(field: keyof typeof localFields, value: string) {
    setLocalFields((f) => ({ ...f, [field]: value }));
  }

  function saveField(data: Parameters<typeof updateProject.mutate>[0]["data"]) {
    setSaving("saving");
    updateProject.mutate(
      { projectId: project.projectId, data },
      {
        onSuccess: (updated) => {
          setProject((p) => ({ ...p, ...updated }));
          setSaving("idle");
        },
        onError: () => setSaving("error"),
      }
    );
  }

  function handleNameBlur() {
    const v = localFields.projectName.trim();
    if (v && v !== project.projectName) saveField({ projectName: v });
  }

  function handleCustomerBlur() {
    const v = localFields.customerName.trim();
    const current = project.customerName ?? "";
    if (v !== current) saveField({ customerName: v || null });
  }

  function handleNotesBlur() {
    const v = localFields.notes.trim() || null;
    if (v !== project.notes) saveField({ notes: v });
  }

  function handleArchiveConfirm() {
    setArchiving(true);
    archiveProject.mutate(project.projectId, {
      onSuccess: (updated) => {
        setProject((p) => ({ ...p, ...updated, status: "Archived" }));
        setArchiving(false);
        setArchiveOpen(false);
        toast.success(`Project ${project.projectNumber} archived.`);
        router.refresh();
      },
      onError: () => {
        setArchiving(false);
        toast.error("Failed to archive project. Please try again.");
      },
    });
  }

  // No WO endpoint exists yet — show top-level items as placeholder
  const topLevelItems = project.topLevelItems ?? [];
  const isArchived = project.status === "Archived";

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-5 max-w-3xl">

            {/* ── Header section ──────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Project Details
              </h2>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">

                {/* Project Number — always read-only */}
                <div className="space-y-1">
                  <Label className="text-xs">Project Number</Label>
                  <p className="font-mono text-sm py-1.5 px-2.5 rounded-md border border-border bg-muted/40 text-foreground">
                    {project.projectNumber}
                  </p>
                </div>

                {/* Project Name */}
                <div className="col-span-1 space-y-1 lg:col-span-2">
                  <Label className="text-xs">Project Name</Label>
                  {canEdit ? (
                    <Input
                      value={localFields.projectName}
                      onChange={(e) => handleFieldChange("projectName", e.target.value)}
                      onBlur={handleNameBlur}
                      className="h-8 text-sm"
                    />
                  ) : (
                    <ReadOnlyField value={project.projectName} />
                  )}
                </div>

                {/* Customer Name */}
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name</Label>
                  {canEdit ? (
                    <Input
                      value={localFields.customerName}
                      onChange={(e) => handleFieldChange("customerName", e.target.value)}
                      onBlur={handleCustomerBlur}
                      className="h-8 text-sm"
                      placeholder="Optional"
                    />
                  ) : (
                    <ReadOnlyField value={project.customerName ?? ""} placeholder="—" />
                  )}
                </div>

                {/* Due Date — read-only on this surface (cascade is Phase 8) */}
                <div className="space-y-1">
                  <Label className="text-xs">Due Date</Label>
                  <ReadOnlyField value={formatDate(project.dueDate)} />
                </div>

                {/* Created */}
                <div className="space-y-1">
                  <Label className="text-xs">Created</Label>
                  <ReadOnlyField
                    value={`${formatDate(project.createdAt)}${project.creator ? ` · ${project.creator.displayName}` : ""}`}
                  />
                </div>

                {/* Compiled — uses createdAt as proxy (compiledAt is Phase 8) */}
                <div className="space-y-1">
                  <Label className="text-xs">Compiled</Label>
                  <ReadOnlyField value={formatDate(project.createdAt)} />
                </div>

                {/* Notes */}
                <div className="col-span-2 space-y-1 lg:col-span-3">
                  <Label className="text-xs">Notes</Label>
                  {canEdit ? (
                    <Textarea
                      value={localFields.notes}
                      onChange={(e) => handleFieldChange("notes", e.target.value)}
                      onBlur={handleNotesBlur}
                      className="min-h-[60px] resize-y text-sm"
                      placeholder="Optional notes…"
                    />
                  ) : (
                    <ReadOnlyField value={project.notes ?? ""} placeholder="—" multiline />
                  )}
                </div>
              </div>

              {/* Saving indicator */}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground h-4">
                {saving === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving…</span>
                  </>
                )}
                {saving === "error" && (
                  <span className="text-destructive">Save failed — check your connection</span>
                )}
                {saving === "idle" && updateProject.isSuccess && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>Saved</span>
                  </>
                )}
              </div>
            </section>

            {/* ── Progress section ─────────────────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Progress
              </h2>

              {topLevelItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No top-level items.</p>
              ) : (
                <div className="space-y-4">
                  {/* Summary bar — placeholder since no WO endpoint exists */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Top-Level Items</span>
                      <span className="tabular-nums font-medium">{topLevelItems.length}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary/40 transition-all"
                        style={{ width: isArchived ? "100%" : "0%" }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Work order completion data will be available once the WO endpoints are built.
                    </p>
                  </div>

                  {/* Per-item rows */}
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-28">
                            Reference
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-28">
                            Part #
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                            Part Name
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">
                            Type
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-16">
                            Qty
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {topLevelItems.map((tl) => (
                          <tr
                            key={tl.topLevelItemId}
                            className="border-b border-border/50 last:border-0"
                          >
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {formatRef(project.projectNumber, tl.topLevelIndex)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {tl.part.partNumber}
                            </td>
                            <td className="px-3 py-2 text-sm">{tl.part.partName}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {tl.part.partType}
                            </td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums">
                              {parseFloat(tl.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 border-l border-border bg-muted/10 overflow-y-auto">
          <div className="space-y-4 p-4">

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Navigation
              </h3>
              <div className="space-y-1.5">
                <ComingSoonButton label="Open in Project View" icon={<ExternalLink className="h-3.5 w-3.5" />} />
                <ComingSoonButton label="View Audit History" icon={<Clock className="h-3.5 w-3.5" />} />
              </div>
            </div>

            {canArchive && (
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => setArchiveOpen(true)}
                >
                  Archive Project
                </Button>
              </div>
            )}

            {isArchived && (
              <div className="border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  This project is archived and read-only.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Archive confirmation dialog ───────────────────────────────────── */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Archive {project.projectNumber}?</DialogTitle>
            <DialogDescription>
              Archived projects are read-only and removed from default operational views. A
              read-only historical view remains accessible via the Archived filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleArchiveConfirm} disabled={archiving}>
              {archiving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Archiving…
                </span>
              ) : (
                "Archive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function ReadOnlyField({
  value,
  placeholder = "",
  multiline = false,
}: {
  value: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const display = value || placeholder;
  const cls = `rounded-md border border-border bg-muted/40 px-2.5 text-sm text-foreground ${
    multiline ? "min-h-[60px] py-2 whitespace-pre-wrap" : "py-1.5"
  } ${!value ? "text-muted-foreground" : ""}`;
  return <div className={cls}>{display}</div>;
}

function ComingSoonButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5 text-xs opacity-50 cursor-not-allowed"
          disabled
        >
          {icon}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Coming soon</TooltipContent>
    </Tooltip>
  );
}
