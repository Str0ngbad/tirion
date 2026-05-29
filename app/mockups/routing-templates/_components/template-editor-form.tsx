"use client";

import { useRef, useState } from "react";
import { MockTemplate, MockTemplateStep } from "../_data";
import { ProcessTypeKey } from "@/app/mockups/users/_data";
import StepRow from "./step-row";
import AddStepDialog from "./add-step-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  allTemplates: MockTemplate[];
  editingTemplate?: MockTemplate;
  onSave: (template: MockTemplate) => void;
  onCancel: () => void;
};

function renumber(arr: MockTemplateStep[]): MockTemplateStep[] {
  return arr.map((s, i) => ({ ...s, stepNumber: i + 1 }));
}

function stepsLabel(steps: MockTemplateStep[]): string {
  return steps.map((s) => s.processType).join(", ");
}

export default function TemplateEditorForm({
  allTemplates,
  editingTemplate,
  onSave,
  onCancel,
}: Props) {
  const isEdit = editingTemplate !== undefined;

  const [templateName, setTemplateName] = useState(editingTemplate?.templateName ?? "");
  const [description, setDescription] = useState(editingTemplate?.description ?? "");
  const [steps, setSteps] = useState<MockTemplateStep[]>(editingTemplate?.steps ?? []);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const nextStepId = useRef(9000);

  const maxTemplateId = Math.max(...allTemplates.map((t) => t.templateId), 0);

  const trimmedName = templateName.trim();
  const isDuplicate =
    trimmedName.length > 0 &&
    allTemplates.some(
      (t) =>
        t.templateName.toLowerCase() === trimmedName.toLowerCase() &&
        t.templateId !== editingTemplate?.templateId,
    );
  const canSave = trimmedName.length > 0 && !isDuplicate;

  // No-change detection for edit mode
  const hasChanges = isEdit
    ? trimmedName !== editingTemplate.templateName ||
      (description.trim() || null) !== (editingTemplate.description ?? null) ||
      stepsLabel(steps) !== stepsLabel(editingTemplate.steps)
    : true;

  function handleAddStep(processType: ProcessTypeKey) {
    const newStep: MockTemplateStep = {
      stepId: ++nextStepId.current,
      stepNumber: steps.length + 1,
      processType,
    };
    setSteps((prev) => [...prev, newStep]);
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setSteps((prev) => {
      const next = [...prev];
      const a = next[index - 1]!;
      const b = next[index]!;
      next[index - 1] = b;
      next[index] = a;
      return renumber(next);
    });
  }

  function handleMoveDown(index: number) {
    setSteps((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      const a = next[index]!;
      const b = next[index + 1]!;
      next[index] = b;
      next[index + 1] = a;
      return renumber(next);
    });
  }

  function handleRemove(index: number) {
    setSteps((prev) => renumber(prev.filter((_, i) => i !== index)));
  }

  function handleSave() {
    if (!canSave || !hasChanges) return;

    if (isEdit) {
      const changedFields: MockTemplate["auditLog"][number]["changedFields"] = [];
      if (trimmedName !== editingTemplate.templateName) {
        changedFields.push({ field: "templateName", before: editingTemplate.templateName, after: trimmedName });
      }
      const newDesc = description.trim() || null;
      if (newDesc !== (editingTemplate.description ?? null)) {
        changedFields.push({ field: "description", before: editingTemplate.description ?? null, after: newDesc });
      }
      const beforeSteps = stepsLabel(editingTemplate.steps);
      const afterSteps = stepsLabel(steps);
      if (beforeSteps !== afterSteps) {
        changedFields.push({ field: "steps", before: beforeSteps || null, after: afterSteps || null });
      }

      const updated: MockTemplate = {
        ...editingTemplate,
        templateName: trimmedName,
        description: description.trim() || null,
        steps,
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            userName: "Jane Chen",
            action: "TemplateUpdated",
            changedFields,
          },
          ...editingTemplate.auditLog,
        ],
      };
      onSave(updated);
    } else {
      const newTemplate: MockTemplate = {
        templateId: maxTemplateId + 1,
        templateName: trimmedName,
        description: description.trim() || null,
        isActive: true,
        steps,
        partsReferencingCount: 0,
        openWoCount: 0,
        affectedStockCount: 0,
        referencingParts: [],
        affectedWos: [],
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            userName: "Jane Chen",
            action: "TemplateCreated",
          },
        ],
      };
      onSave(newTemplate);
    }
  }

  return (
    <div className="space-y-6">
      {/* Fields */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="template-name">
            Template Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="e.g. Machined Part"
            className={isDuplicate ? "border-destructive" : ""}
          />
          {isDuplicate && (
            <p className="text-xs text-destructive">
              A template with this name already exists.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="template-description">Description</Label>
          <Textarea
            id="template-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="min-h-[4.5rem] resize-none"
          />
        </div>
      </div>

      {/* Steps */}
      <div>
        <p className="mb-3 text-sm font-medium text-foreground">Steps</p>
        {steps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No steps yet. Add a step to begin building this template.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setAddStepOpen(true)}
            >
              Add Step
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {steps.map((step, i) => (
              <StepRow
                key={step.stepId}
                step={step}
                isFirst={i === 0}
                isLast={i === steps.length - 1}
                onMoveUp={() => handleMoveUp(i)}
                onMoveDown={() => handleMoveDown(i)}
                onRemove={() => handleRemove(i)}
              />
            ))}
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={() => setAddStepOpen(true)}>
                Add Step
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave || !hasChanges}>
          {isEdit ? "Save Changes" : "Save Template"}
        </Button>
      </div>

      <AddStepDialog
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        onAdd={handleAddStep}
      />
    </div>
  );
}
