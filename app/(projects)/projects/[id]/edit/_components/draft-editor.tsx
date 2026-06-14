"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useUpdateProject,
  useValidateProject,
  useCompileProject,
  useAddTopLevelItem,
  useUpdateTopLevelItem,
  useRemoveTopLevelItem,
  useDeleteProject,
  type ProjectDetail,
  type TopLevelItemDetail,
  type ValidationFailure,
  type ProjectColor,
} from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client-error";
import { BomTreePreview } from "./bom-tree-preview";
import { CompileFailureScreen } from "./compile-failure-screen";
import { PartSearchCombobox } from "./part-search-combobox";
import { ColorPickerPopover, ColorSwatch, COLOR_META } from "./color-picker";
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
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidationState =
  | { status: "pending" }
  | { status: "validating" }
  | { status: "pass"; failures: [] }
  | { status: "fail"; failures: ValidationFailure[] };

type SavingState = "idle" | "saving" | "error";

type PartOption = {
  partId: number;
  partNumber: string;
  partName: string;
  partType: "Part" | "Assembly";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRef(projectNumber: string, topLevelIndex: number): string {
  return `${projectNumber}.${String(topLevelIndex).padStart(2, "0")}`;
}

// ─── Draft Editor ─────────────────────────────────────────────────────────────

type Props = {
  initialProject: ProjectDetail;
};

export function DraftEditor({ initialProject }: Props) {
  const router = useRouter();

  // Local project state (mirrors server; optimistic updates on save)
  const [project, setProject] = useState<ProjectDetail>(initialProject);

  // Field-level save state
  const [saving, setSaving] = useState<SavingState>("idle");

  // Inline project number error
  const [projectNumberError, setProjectNumberError] = useState<string | null>(null);

  // Validation
  const [validation, setValidation] = useState<ValidationState>({ status: "pending" });

  // Compile failure screen
  const [showFailureScreen, setShowFailureScreen] = useState(false);
  const [compileFailures, setCompileFailures] = useState<ValidationFailure[]>([]);

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Mutations
  const updateProject = useUpdateProject();
  const validateProject = useValidateProject();
  const compileProject = useCompileProject();
  const addTopLevelItem = useAddTopLevelItem();
  const updateTopLevelItem = useUpdateTopLevelItem();
  const removeTopLevelItem = useRemoveTopLevelItem();
  const deleteProject = useDeleteProject();

  // ─── Run validation ────────────────────────────────────────────────────────

  // Ref so runValidation always sees the current item count even when called
  // from a stale closure (e.g. setTimeout inside addTopLevelItem.onSuccess).
  const topLevelItemCountRef = useRef(project.topLevelItems.length);
  useEffect(() => {
    topLevelItemCountRef.current = project.topLevelItems.length;
  }, [project.topLevelItems.length]);

  const runValidation = useCallback(() => {
    if (topLevelItemCountRef.current === 0) {
      setValidation({ status: "pending" });
      return;
    }
    setValidation({ status: "validating" });
    validateProject.mutate(project.projectId, {
      onSuccess: (result) => {
        if (result.valid) {
          setValidation({ status: "pass", failures: [] });
        } else {
          setValidation({ status: "fail", failures: result.failures });
        }
      },
      onError: () => {
        // Validation fetch failed — fall back to pending so user can retry
        setValidation({ status: "pending" });
      },
    });
  }, [project.projectId, validateProject]);

  // Validate on mount
  useEffect(() => {
    runValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-save helpers ─────────────────────────────────────────────────────

  function saveField(data: Parameters<typeof updateProject.mutate>[0]["data"]) {
    setSaving("saving");
    updateProject.mutate(
      { projectId: project.projectId, data },
      {
        onSuccess: (updated) => {
          setProject(updated);
          setSaving("idle");
        },
        onError: () => {
          setSaving("error");
        },
      }
    );
  }

  // ─── Header field handlers ─────────────────────────────────────────────────

  const [localFields, setLocalFields] = useState({
    projectNumber: project.projectNumber,
    projectName: project.projectName,
    customerName: project.customerName ?? "",
    dueDate: project.dueDate ?? "",
    priority: project.priority !== null ? String(project.priority) : "",
    notes: project.notes ?? "",
  });

  function handleFieldChange(field: keyof typeof localFields, value: string) {
    setLocalFields((f) => ({ ...f, [field]: value }));
  }

  async function handleProjectNumberBlur() {
    const pn = localFields.projectNumber.trim();
    if (!pn) {
      setProjectNumberError("Project Number is required");
      return;
    }
    if (pn === project.projectNumber) return;
    // Let the server detect conflicts — PATCH returns 409 on collision
    setSaving("saving");
    updateProject.mutate(
      { projectId: project.projectId, data: { projectNumber: pn } },
      {
        onSuccess: (updated) => {
          setProject(updated);
          setSaving("idle");
          setProjectNumberError(null);
        },
        onError: (err) => {
          setSaving("error");
          if (err instanceof ApiError && err.statusCode === 409) {
            setProjectNumberError("Project number already in use.");
          }
        },
      }
    );
  }

  function handleNameBlur() {
    const v = localFields.projectName.trim();
    if (v !== project.projectName) saveField({ projectName: v || project.projectName });
  }

  function handleCustomerBlur() {
    const v = localFields.customerName.trim();
    const current = project.customerName ?? "";
    if (v !== current) saveField({ customerName: v || null });
  }

  function handleDueDateBlur() {
    const v = localFields.dueDate || null;
    if (v !== project.dueDate) saveField({ dueDate: v });
  }

  function handlePriorityBlur() {
    const raw = localFields.priority.trim();
    const parsed = raw ? parseInt(raw, 10) : null;
    const current = project.priority;
    if (parsed !== current) saveField({ priority: isNaN(parsed ?? NaN) ? null : parsed });
  }

  function handleNotesBlur() {
    const v = localFields.notes.trim() || null;
    if (v !== project.notes) saveField({ notes: v });
  }

  // Update localFields when project reloads (e.g., after another save resolves)
  const prevProjectId = useRef(project.projectId);
  useEffect(() => {
    if (project.projectId !== prevProjectId.current) return;
    // Sync only if user isn't actively editing (best-effort; auto-save is last-write-wins)
  }, [project]);

  // ─── Color ────────────────────────────────────────────────────────────────

  function handleColorSelect(color: ProjectColor | null) {
    setProject((p) => ({ ...p, color }));
    saveField({ color });
  }

  // ─── Top-level items ───────────────────────────────────────────────────────

  function handleAddPart(part: PartOption, qty: number) {
    addTopLevelItem.mutate(
      { projectId: project.projectId, partId: part.partId, quantity: qty },
      {
        onSuccess: (item) => {
          const enriched: TopLevelItemDetail = {
            topLevelItemId: item.topLevelItemId,
            partId: part.partId,
            quantity: String(qty),
            topLevelIndex: item.topLevelIndex,
            part: {
              partNumber: part.partNumber,
              partName: part.partName,
              partType: part.partType,
            },
          };
          setProject((p) => ({
            ...p,
            topLevelItems: [...p.topLevelItems, enriched],
            nextTopLevelIndex: p.nextTopLevelIndex + 1,
          }));
          setTimeout(runValidation, 100);
        },
        onError: () => {
          toast.error("Failed to add item. Please try again.");
        },
      }
    );
  }

  function handleQtyChange(itemId: number, newQty: number) {
    const safeQty = Math.max(1, newQty);
    // Optimistic update
    setProject((p) => ({
      ...p,
      topLevelItems: p.topLevelItems.map((tl) =>
        tl.topLevelItemId === itemId ? { ...tl, quantity: String(safeQty) } : tl
      ),
    }));
    updateTopLevelItem.mutate(
      { projectId: project.projectId, itemId, quantity: safeQty },
      {
        onSuccess: () => runValidation(),
        onError: () => {
          toast.error("Failed to update quantity.");
          // Revert optimistic update on error
          setProject(project);
        },
      }
    );
  }

  function handleRemoveTl(itemId: number) {
    // Optimistic update
    setProject((p) => ({
      ...p,
      topLevelItems: p.topLevelItems.filter((tl) => tl.topLevelItemId !== itemId),
    }));
    removeTopLevelItem.mutate(
      { projectId: project.projectId, itemId },
      {
        onSuccess: () => setTimeout(runValidation, 100),
        onError: () => {
          toast.error("Failed to remove item.");
          setProject(project);
        },
      }
    );
  }

  // ─── Compile ──────────────────────────────────────────────────────────────

  const [compiling, setCompiling] = useState(false);

  function handleCompile() {
    setCompiling(true);
    compileProject.mutate(project.projectId, {
      onSuccess: (result) => {
        setCompiling(false);
        toast.success(
          `Project ${project.projectNumber} compiled successfully. ${result.workOrderCount} Work Orders generated.`
        );
        router.push("/projects");
      },
      onError: (err) => {
        setCompiling(false);
        if (err instanceof ApiError && err.statusCode === 422) {
          const body = err.rawBody as { failures?: ValidationFailure[] } | undefined;
          const failures = body?.failures;
          if (failures && failures.length > 0) {
            setCompileFailures(failures);
            setShowFailureScreen(true);
            return;
          }
        }
        toast.error(err instanceof ApiError && err.message
          ? `Compilation failed: ${err.message}`
          : "Compilation failed. Please try again.");
      },
    });
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  const [deleting, setDeleting] = useState(false);

  function handleDeleteConfirm() {
    setDeleting(true);
    deleteProject.mutate(project.projectId, {
      onSuccess: () => {
        setDeleteOpen(false);
        router.push("/projects");
      },
      onError: () => {
        setDeleting(false);
        toast.error("Failed to delete draft.");
      },
    });
  }

  // ─── Compile button state ──────────────────────────────────────────────────

  const requiredMissing =
    !localFields.projectNumber.trim() ||
    !localFields.projectName.trim() ||
    project.topLevelItems.length === 0;

  const validationFailing =
    validation.status === "fail" ||
    validation.status === "pending" ||
    validation.status === "validating";

  function getCompileButton() {
    if (requiredMissing) {
      const missing: string[] = [];
      if (!localFields.projectNumber.trim()) missing.push("Project Number");
      if (!localFields.projectName.trim()) missing.push("Project Name");
      if (project.topLevelItems.length === 0) missing.push("at least one top-level item");
      return { disabled: true, warn: false, label: "Compile Project", tooltip: `Required: ${missing.join(", ")}` };
    }
    return {
      disabled: false,
      warn: validationFailing,
      label: "Compile Project",
      tooltip: validationFailing ? "Validation issues exist. Compile will re-validate server-side." : "",
    };
  }

  const btnState = getCompileButton();

  const failures =
    validation.status === "fail" ? validation.failures : [];

  // ─── Compile failure screen replaces editor body ───────────────────────────

  if (showFailureScreen) {
    return (
      <CompileFailureScreen
        failures={compileFailures}
        onReturnToEditor={() => setShowFailureScreen(false)}
      />
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Validation banner */}
      <div
        className={`shrink-0 border-b px-6 py-2 text-sm ${
          project.topLevelItems.length === 0
            ? "border-border bg-muted/20 text-muted-foreground/70"
            : validation.status === "pass"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
            : validation.status === "fail"
            ? "border-destructive/20 bg-destructive/5 text-destructive"
            : "border-border bg-muted/20 text-muted-foreground"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <span>
            {project.topLevelItems.length === 0
              ? "Add top-level items to begin validation"
              : validation.status === "pass"
              ? "All checks passed — ready to compile"
              : validation.status === "fail"
              ? `${failures.length} validation ${failures.length === 1 ? "issue" : "issues"} — see details below`
              : validation.status === "validating"
              ? "Validating…"
              : "Add top-level items to begin validation"}
          </span>
          {project.topLevelItems.length > 0 && validation.status !== "validating" && (
            <button
              type="button"
              onClick={runValidation}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Re-validate
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-6 py-5">

          {/* ── Header section ──────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project Header
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">

              {/* Project Number */}
              <div className="space-y-1">
                <Label className="text-xs">
                  Project Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={localFields.projectNumber}
                  onChange={(e) => handleFieldChange("projectNumber", e.target.value)}
                  onBlur={handleProjectNumberBlur}
                  className="h-8 font-mono text-sm"
                  placeholder="e.g. 17559"
                />
                {projectNumberError && (
                  <p className="text-xs text-destructive">{projectNumberError}</p>
                )}
              </div>

              {/* Project Name */}
              <div className="col-span-1 space-y-1 lg:col-span-2">
                <Label className="text-xs">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={localFields.projectName}
                  onChange={(e) => handleFieldChange("projectName", e.target.value)}
                  onBlur={handleNameBlur}
                  className="h-8 text-sm"
                  placeholder="e.g. PB-M Cell 2024-Q4"
                />
              </div>

              {/* Customer Name */}
              <div className="space-y-1">
                <Label className="text-xs">Customer Name</Label>
                <Input
                  value={localFields.customerName}
                  onChange={(e) => handleFieldChange("customerName", e.target.value)}
                  onBlur={handleCustomerBlur}
                  className="h-8 text-sm"
                  placeholder="Optional"
                />
              </div>

              {/* Due Date */}
              <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={localFields.dueDate}
                  onChange={(e) => handleFieldChange("dueDate", e.target.value)}
                  onBlur={handleDueDateBlur}
                  className="h-8 text-sm"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <Label className="text-xs">Project Priority</Label>
                <Input
                  type="number"
                  min={1}
                  value={localFields.priority}
                  onChange={(e) => handleFieldChange("priority", e.target.value)}
                  onBlur={handlePriorityBlur}
                  className="h-8 text-sm"
                  placeholder="Integer, optional"
                />
              </div>

              {/* Color */}
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <ColorPickerPopover
                  selected={project.color}
                  onSelect={handleColorSelect}
                >
                  <button
                    type="button"
                    className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-xs transition-colors hover:bg-muted/40"
                  >
                    <ColorSwatch color={project.color} />
                    <span className={project.color ? "text-foreground" : "text-muted-foreground/60"}>
                      {project.color ? COLOR_META[project.color].label : "None"}
                    </span>
                  </button>
                </ColorPickerPopover>
              </div>

              {/* Notes */}
              <div className="col-span-2 space-y-1 lg:col-span-3">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={localFields.notes}
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  onBlur={handleNotesBlur}
                  className="min-h-[60px] resize-y text-sm"
                  placeholder="Optional notes…"
                />
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

          {/* ── Top-Level Items ──────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Top-Level Items <span className="text-destructive">*</span>
            </h2>

            {project.topLevelItems.length > 0 && (
              <div className="mb-3 overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Reference
                      </th>
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Part #
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Part Name
                      </th>
                      <th className="w-20 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="w-20 px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                        Qty
                      </th>
                      <th className="w-24 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
                        Validation
                      </th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {project.topLevelItems.map((tl) => {
                      const tlRef = formatRef(project.projectNumber, tl.topLevelIndex);
                      const tlFailure = failures.find((f) =>
                        f.bomPath[0] === tlRef
                      );
                      return (
                        <tr
                          key={tl.topLevelItemId}
                          className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                            {tlRef}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {tl.part.partNumber}
                          </td>
                          <td className="px-3 py-2 text-sm">{tl.part.partName}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {tl.part.partType}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              value={parseFloat(tl.quantity)}
                              onChange={(e) =>
                                handleQtyChange(
                                  tl.topLevelItemId,
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-16 rounded border border-border px-1.5 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center">
                              {validation.status === "validating" ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              ) : validation.status === "pass" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : tlFailure ? (
                                <span className="flex items-center gap-1 text-destructive">
                                  <AlertCircle className="h-4 w-4 shrink-0" />
                                  <span className="text-xs">Fail</span>
                                </span>
                              ) : validation.status === "fail" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveTl(tl.topLevelItemId)}
                              className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                              title="Remove"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <PartSearchCombobox
              onAdd={handleAddPart}
              disabled={addTopLevelItem.isPending}
            />
          </section>

          {/* ── BOM Tree Preview ─────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              BOM Tree Preview
            </h2>
            <BomTreePreview
              topLevelItems={project.topLevelItems}
              failures={failures}
            />
          </section>
        </div>
      </div>

      {/* ── Footer / action bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-4 border-t border-border bg-background px-6 py-3">
        {/* Delete Draft */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="h-8 gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Draft
        </Button>

        {/* Compile */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={btnState.disabled || compiling}
            onClick={handleCompile}
            title={btnState.tooltip}
            className={`h-8 min-w-[130px] ${
              btnState.warn && !btnState.disabled
                ? "border-amber-400 text-amber-700 hover:bg-amber-50"
                : ""
            }`}
            variant={btnState.warn && !btnState.disabled ? "outline" : "default"}
          >
            {compiling ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Compiling…
              </span>
            ) : (
              btnState.label
            )}
          </Button>
        </div>
      </div>

      {/* ── Delete confirmation dialog ───────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Draft Project {project.projectNumber}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The draft and all its top-level item definitions will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting…
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
