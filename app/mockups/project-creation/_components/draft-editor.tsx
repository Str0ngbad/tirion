"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { MockProject, MockProjectTopLevelItem, MockWorkOrder, MockWorkOrderStep, StepStatus, getSessionProjects, ProjectColor, PROJECT_COLOR_MAP } from "../_data";
import { MOCK_PARTS } from "@/app/mockups/parts/_data";
import ColorPicker from "./color-picker";
import { validateProject, failCount, allPass, NodeValidation } from "../_lib/validation";
import BomTreePreview from "./bom-tree-preview";
import CompileFailureScreen from "./compile-failure-screen";
import PartSearchCombobox from "./part-search-combobox";
import {
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

// ─── WO generation (mirrors compile logic) ────────────────────────────────────

let _woIdCounter = 30001;

function generateWOs(
  partId: number,
  qty: number,
  parentWoId: number | null,
  topLevelIndex: number | null,
  projectId: number,
  visited: Set<number>
): MockWorkOrder[] {
  if (visited.has(partId)) return [];
  const part = MOCK_PARTS.find((p) => p.partId === partId);
  if (!part) return [];
  const visited2 = new Set(visited);
  visited2.add(partId);

  const woId = _woIdCounter++;
  const steps = (part.routingTemplate?.steps ?? ["Purchase", "Receive"]).map((processType, i) => ({
    stepId: woId * 100 + i + 1,
    stepNumber: i + 1,
    processType,
    status: "Waiting" as StepStatus,
  }));

  const wo: MockWorkOrder = {
    woId,
    projectId,
    partId,
    partNumber: part.partNumber,
    partName: part.partName,
    quantity: qty,
    parentWoId,
    topLevelIndex,
    status: "Unreleased",
    steps,
  };

  const children: MockWorkOrder[] = [];
  if (part.childParts) {
    for (const child of part.childParts) {
      children.push(
        ...generateWOs(child.childPartId, qty * child.quantity, woId, null, projectId, visited2)
      );
    }
  }
  return [wo, ...children];
}

// ─── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  project: MockProject;
  onChange: (updated: MockProject) => void;
  onCompileSuccess: (compiled: MockProject) => void;
  onDeleteDraft: () => void;
};

// ─── Validation indicator for a single top-level item row ────────────────────

function TlValidationCell({ partId, quantity, topLevelIndex, partNumber }: {
  partId: number; quantity: number; topLevelIndex: number; partNumber: string;
}) {
  const nodes = useMemo(() =>
    validateProject([{ partId, quantity, topLevelIndex, partNumber }]),
    [partId, quantity, topLevelIndex, partNumber]
  );
  const fails = failCount(nodes);
  if (fails === 0)
    return (
      <span title="All checks pass">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="text-xs">{fails}</span>
    </span>
  );
}

// ─── Draft Editor ─────────────────────────────────────────────────────────────

export default function DraftEditor({ project, onChange, onCompileSuccess, onDeleteDraft }: Props) {
  const [showCompileFailure, setShowCompileFailure] = useState(false);
  const [compileFailures, setCompileFailures] = useState<NodeValidation[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [projectNumberError, setProjectNumberError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectNumberContainerRef = useRef<HTMLDivElement>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Auto-focus Project Number on mount for new (empty) Drafts.
  // Gate on projectName being empty — new projects have no name yet; projectNumber
  // is pre-populated by createNewProject() so it can't be used as the "new" signal.
  useEffect(() => {
    if (!project.projectName && projectNumberContainerRef.current) {
      const input = projectNumberContainerRef.current.querySelector("input");
      if (input) input.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only on mount

  // Live validation
  const validationNodes = useMemo(
    () =>
      validateProject(
        project.topLevelItems.map((tl) => ({
          partId: tl.partId,
          quantity: tl.quantity,
          topLevelIndex: tl.topLevelIndex,
          partNumber: tl.partNumber,
        }))
      ),
    [project.topLevelItems]
  );
  const fails = failCount(validationNodes);
  const isValid = allPass(validationNodes);
  const hasTopLevels = project.topLevelItems.length > 0;
  const requiredFieldsMissing = !project.projectNumber.trim() || !project.projectName.trim() || !hasTopLevels;

  function update(fields: Partial<MockProject>) {
    onChange({
      ...project,
      ...fields,
      lastEditedAt: new Date().toISOString(),
      lastEditedUserId: 3,
      lastEditedByName: "Marcus Hill",
    });
  }

  function handleProjectNumberBlur() {
    const pn = project.projectNumber.trim();
    if (!pn) {
      setProjectNumberError("Project Number is required");
      return;
    }
    // Check uniqueness against all other projects in the session store
    const others = getSessionProjects().filter((p) => p.projectId !== project.projectId);
    if (others.some((p) => p.projectNumber === pn)) {
      setProjectNumberError("Project Number already in use");
      return;
    }
    setProjectNumberError(null);
  }

  function handleAddTopLevel(part: { partId: number; partNumber: string; partName: string; partType: string }, qty: number) {
    const tl: MockProjectTopLevelItem = {
      partId: part.partId,
      partNumber: part.partNumber,
      partName: part.partName,
      partType: part.partType as "Part" | "Assembly",
      quantity: qty,
      topLevelIndex: project.nextTopLevelIndex,
    };
    update({
      topLevelItems: [...project.topLevelItems, tl],
      nextTopLevelIndex: project.nextTopLevelIndex + 1,
    });
  }

  function handleRemoveTl(topLevelIndex: number) {
    update({
      topLevelItems: project.topLevelItems.filter((tl) => tl.topLevelIndex !== topLevelIndex),
    });
  }

  function handleQtyChange(topLevelIndex: number, newQty: number) {
    update({
      topLevelItems: project.topLevelItems.map((tl) =>
        tl.topLevelIndex === topLevelIndex ? { ...tl, quantity: newQty } : tl
      ),
    });
  }

  function handleCompile() {
    // Final validation (defends against race conditions per PC-9)
    const finalNodes = validateProject(
      project.topLevelItems.map((tl) => ({
        partId: tl.partId,
        quantity: tl.quantity,
        topLevelIndex: tl.topLevelIndex,
        partNumber: tl.partNumber,
      }))
    );

    const failures = finalNodes.filter((n) => n.result.status === "fail");
    if (failures.length > 0) {
      setCompileFailures(failures);
      setShowCompileFailure(true);
      return;
    }

    // Simulate compile
    setCompiling(true);
    setTimeout(() => {
      // Generate WO tree
      const allWOs: MockWorkOrder[] = [];
      for (const tl of project.topLevelItems) {
        allWOs.push(
          ...generateWOs(tl.partId, tl.quantity, null, tl.topLevelIndex, project.projectId, new Set())
        );
      }

      const compiled: MockProject = {
        ...project,
        status: "Active",
        workOrders: allWOs,
        compiledAt: new Date().toISOString(),
        lastEditedAt: new Date().toISOString(),
      };
      setCompiling(false);
      onCompileSuccess(compiled);
    }, 800);
  }

  function getCompileButtonState(): { disabled: boolean; variant: "default" | "outline"; label: string; title: string } {
    if (requiredFieldsMissing) {
      const missing = [];
      if (!project.projectNumber.trim()) missing.push("Project Number");
      if (!project.projectName.trim()) missing.push("Project Name");
      if (!hasTopLevels) missing.push("at least one top-level item");
      return {
        disabled: true,
        variant: "outline",
        label: "Compile",
        title: `Required: ${missing.join(", ")}`,
      };
    }
    if (!isValid) {
      return {
        disabled: false,
        variant: "outline",
        label: `Compile (${fails} ${fails === 1 ? "issue" : "issues"})`,
        title: "Compile will fail — validation issues exist. Click to see details.",
      };
    }
    return { disabled: false, variant: "default", label: "Compile →", title: "" };
  }

  const btnState = getCompileButtonState();

  if (showCompileFailure) {
    return (
      <CompileFailureScreen
        failures={compileFailures}
        onReturnToEditor={() => setShowCompileFailure(false)}
      />
    );
  }

  function formatRef(projectNumber: string, topLevelIndex: number): string {
    return `${projectNumber}.${String(topLevelIndex).padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Validation banner — always visible */}
      <div
        className={`shrink-0 border-b px-6 py-2 text-sm ${
          project.topLevelItems.length === 0
            ? "border-border bg-muted/20 text-muted-foreground/70"
            : isValid
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-destructive/20 bg-destructive/5 text-destructive"
        }`}
      >
        {project.topLevelItems.length === 0
          ? "Add at least one top-level item, then validate and compile"
          : isValid
          ? "All checks passed — ready to compile"
          : `${fails} validation ${fails === 1 ? "issue" : "issues"} — see details in tree below`}
      </div>

      <div className="flex-1 space-y-6 px-6 py-5">
        {/* ── Header section ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Project Header
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {/* Project Number */}
            <div className="space-y-1">
              <Label className="text-xs">Project Number <span className="text-destructive">*</span></Label>
              <div ref={projectNumberContainerRef}>
                <Input
                  value={project.projectNumber}
                  onChange={(e) => update({ projectNumber: e.target.value })}
                  onBlur={handleProjectNumberBlur}
                  className="h-8 text-sm font-mono"
                  placeholder="e.g. 17559"
                />
              </div>
              {projectNumberError && (
                <p className="text-xs text-destructive">{projectNumberError}</p>
              )}
            </div>

            {/* Project Name */}
            <div className="space-y-1 col-span-1 lg:col-span-2">
              <Label className="text-xs">Project Name <span className="text-destructive">*</span></Label>
              <Input
                value={project.projectName}
                onChange={(e) => update({ projectName: e.target.value })}
                className="h-8 text-sm"
                placeholder="e.g. PB-M Cell 2024-Q4"
              />
            </div>

            {/* Customer Name */}
            <div className="space-y-1">
              <Label className="text-xs">Customer Name</Label>
              <Input
                value={project.customerName ?? ""}
                onChange={(e) => update({ customerName: e.target.value || null })}
                className="h-8 text-sm"
                placeholder="Optional"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1">
              <Label className="text-xs">Due Date</Label>
              <Input
                type="date"
                value={project.dueDate ?? ""}
                onChange={(e) => update({ dueDate: e.target.value || null })}
                className="h-8 text-sm"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                min={1}
                value={project.priority ?? ""}
                onChange={(e) => update({ priority: e.target.value ? parseInt(e.target.value) : null })}
                className="h-8 text-sm"
                placeholder="Integer, optional"
              />
            </div>

            {/* Color */}
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setColorPickerOpen((o) => !o)}
                  className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-xs transition-colors hover:bg-muted/40"
                >
                  {project.color ? (
                    <>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: PROJECT_COLOR_MAP[project.color].hex }}
                      />
                      <span className="text-foreground">{PROJECT_COLOR_MAP[project.color].label}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/60">None</span>
                  )}
                </button>
                {colorPickerOpen && (
                  <ColorPicker
                    selected={project.color}
                    onSelect={(c: ProjectColor | null) => update({ color: c })}
                    onClose={() => setColorPickerOpen(false)}
                  />
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1 col-span-2 lg:col-span-3">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={project.notes ?? ""}
                onChange={(e) => update({ notes: e.target.value || null })}
                className="min-h-[60px] resize-y text-sm"
                placeholder="Optional notes…"
              />
            </div>
          </div>
        </section>

        {/* ── Top-Level Items ─────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Top-Level Items <span className="text-destructive">*</span>
          </h2>

          {/* Items table */}
          {project.topLevelItems.length > 0 && (
            <div className="mb-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-28">Reference</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-32">Part #</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Part Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-20">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground w-20">Qty</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground w-24">Validation</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {project.topLevelItems.map((tl) => (
                    <tr key={tl.topLevelIndex} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {formatRef(project.projectNumber, tl.topLevelIndex)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{tl.partNumber}</td>
                      <td className="px-3 py-2 text-sm">{tl.partName}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{tl.partType}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={1}
                          value={tl.quantity}
                          onChange={(e) =>
                            handleQtyChange(tl.topLevelIndex, Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-16 rounded border border-border px-1.5 py-0.5 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-3 py-2 flex justify-center">
                        <TlValidationCell
                          partId={tl.partId}
                          quantity={tl.quantity}
                          topLevelIndex={tl.topLevelIndex}
                          partNumber={tl.partNumber}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleRemoveTl(tl.topLevelIndex)}
                          className="rounded p-1 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Remove top-level item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add row control */}
          <PartSearchCombobox
            placeholder="Search by Part Number or Name to add…"
            onSelect={(part, qty) =>
              handleAddTopLevel(
                { partId: part.partId, partNumber: part.partNumber, partName: part.partName, partType: part.partType },
                qty
              )
            }
          />
        </section>

        {/* ── BOM Tree Preview ────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            BOM Tree Preview
          </h2>
          {project.topLevelItems.length > 0 ? (
            <div className="rounded-md border border-border overflow-hidden">
              <BomTreePreview topLevelItems={project.topLevelItems} />
            </div>
          ) : (
            <div className="rounded-md border border-border/40 bg-muted/20 px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No top-level items yet — add an item above to preview the BOM tree
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── Footer / Compile bar ─────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-border bg-background px-6 py-3 flex items-center justify-between gap-4">
        {/* Delete Draft */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="h-8 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Draft
        </Button>

        {/* Compile */}
        <div className="flex items-center gap-3">
          {project.topLevelItems.length === 0 && (
            <span className="text-xs text-muted-foreground">Add at least one top-level item to compile</span>
          )}
          <Button
            size="sm"
            variant={btnState.variant}
            disabled={btnState.disabled || compiling}
            onClick={handleCompile}
            title={btnState.title}
            className={`h-8 min-w-[100px] ${!isValid && !requiredFieldsMissing ? "border-amber-400 text-amber-700 hover:bg-amber-50" : ""}`}
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

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Draft Project {project.projectNumber}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The Draft and all its top-level item definitions will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setDeleteOpen(false); onDeleteDraft(); }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
