"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { AddStepDialog } from "./add-step-dialog";
import { StepRow } from "./step-row";
import {
  useCreateRoutingTemplate,
  useUpdateRoutingTemplate,
  useProcessTypes,
} from "@/lib/api/routing-templates";
import { type ProcessTypeKey } from "@/lib/process-types";
import { type RoutingTemplateDetail } from "@/lib/routing-templates/types";

interface StepDraft {
  stepId: number;
  stepNumber: number;
  processType: ProcessTypeKey;
}

interface TemplateEditorFormProps {
  editingTemplate?: RoutingTemplateDetail;
  allTemplateNames: string[];
}

let nextStepId = 1;

function stepsAreDifferent(drafts: StepDraft[], original: RoutingTemplateDetail["steps"]): boolean {
  if (drafts.length !== original.length) return true;
  return drafts.some((d, i) => d.processType !== original[i]!.processTypeName);
}

export function TemplateEditorForm({ editingTemplate, allTemplateNames }: TemplateEditorFormProps) {
  const router = useRouter();
  const isEdit = editingTemplate !== undefined;

  const [templateName, setTemplateName] = useState(editingTemplate?.templateName ?? "");
  const [description, setDescription] = useState(editingTemplate?.description ?? "");
  const [steps, setSteps] = useState<StepDraft[]>(
    editingTemplate?.steps.map((s) => ({
      stepId: nextStepId++,
      stepNumber: s.stepIndex,
      processType: s.processTypeName as ProcessTypeKey,
    })) ?? []
  );
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const processTypesQuery = useProcessTypes();
  const createMutation = useCreateRoutingTemplate();
  const updateMutation = useUpdateRoutingTemplate();

  const trimmedName = templateName.trim();
  const isDuplicate =
    trimmedName.length > 0 &&
    allTemplateNames.some(
      (n) =>
        n.toLowerCase() === trimmedName.toLowerCase() &&
        n !== editingTemplate?.templateName
    );
  const canSave = trimmedName.length > 0 && !isDuplicate && steps.length > 0;

  const hasUnsavedChanges = isEdit
    ? templateName !== editingTemplate.templateName ||
      (description || null) !== editingTemplate.description ||
      stepsAreDifferent(steps, editingTemplate.steps)
    : trimmedName.length > 0 || description.length > 0 || steps.length > 0;

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function renumber(arr: StepDraft[]): StepDraft[] {
    return arr.map((s, i) => ({ ...s, stepNumber: i + 1 }));
  }

  function handleAddStep(processType: ProcessTypeKey) {
    setSteps((prev) =>
      renumber([...prev, { stepId: nextStepId++, stepNumber: 0, processType }])
    );
  }

  function handleMoveUp(index: number) {
    setSteps((prev) => {
      const next = [...prev];
      [next[index - 1]!, next[index]!] = [next[index]!, next[index - 1]!];
      return renumber(next);
    });
  }

  function handleMoveDown(index: number) {
    setSteps((prev) => {
      const next = [...prev];
      [next[index]!, next[index + 1]!] = [next[index + 1]!, next[index]!];
      return renumber(next);
    });
  }

  function handleRemove(index: number) {
    setSteps((prev) => renumber(prev.filter((_, i) => i !== index)));
  }

  function attemptNavBack() {
    const nav = () => router.push("/routing-templates");
    if (hasUnsavedChanges) {
      setPendingNav(() => nav);
      setUnsavedDialogOpen(true);
    } else {
      nav();
    }
  }

  function handleDiscard() {
    setUnsavedDialogOpen(false);
    if (pendingNav) {
      pendingNav();
      setPendingNav(null);
    }
  }

  function handleSave() {
    if (!canSave || !processTypesQuery.data) return;

    const nameToId = new Map(
      processTypesQuery.data.map((pt) => [pt.processName, pt.processTypeId])
    );

    const stepInputs = steps.map((s, i) => ({
      processTypeId: nameToId.get(s.processType) ?? 0,
      stepIndex: i + 1,
    }));

    const successToast = (flaggedWoCount: number) => {
      const msg =
        flaggedWoCount > 0
          ? `Template saved. ${flaggedWoCount} WOs flagged for review.`
          : "Template saved.";
      toast.success(msg);
    };

    if (isEdit && editingTemplate) {
      updateMutation.mutate(
        {
          id: editingTemplate.routingTemplateDefinitionId,
          input: {
            templateName: trimmedName,
            description: description.trim() || null,
            steps: stepInputs,
          },
        },
        {
          onSuccess: (data) => {
            successToast(data.flaggedWoCount);
            router.push("/routing-templates");
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          templateName: trimmedName,
          description: description.trim() || null,
          steps: stepInputs,
        },
        {
          onSuccess: (data) => {
            successToast(data.flaggedWoCount);
            router.push("/routing-templates");
          },
        }
      );
    }
  }

  if (processTypesQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 py-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const saveError = createMutation.error?.message ?? updateMutation.error?.message ?? null;

  return (
    <>
      {/* Header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={attemptNavBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            {isEdit ? editingTemplate.templateName : "New Routing Template"}
          </h1>
        </div>
      </div>

      {/* Form body */}
      <div className="mx-auto max-w-2xl px-8 py-8">
        <div className="flex flex-col gap-6">
          {/* Template Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Standard Machined Part"
              className={isDuplicate ? "border-destructive" : ""}
            />
            {isDuplicate && (
              <p className="text-xs text-destructive">
                A template with this name already exists.
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when this routing template applies"
              rows={3}
            />
          </div>

          {/* Steps */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>
                Steps{" "}
                <span className="text-muted-foreground font-normal text-xs">
                  ({steps.length} / 10)
                </span>
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddStepOpen(true)}
                disabled={steps.length >= 10}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add Step
              </Button>
            </div>

            {steps.length === 0 && (
              <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No steps yet. Add at least one step.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              {steps.map((step, index) => (
                <StepRow
                  key={step.stepId}
                  step={step}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onRemove={() => handleRemove(index)}
                />
              ))}
            </div>
          </div>

          {/* Save error */}
          {saveError && (
            <p className="text-sm text-destructive">{saveError}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={attemptNavBack} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Saving…" : "Save Template"}
            </Button>
          </div>
        </div>
      </div>

      <AddStepDialog
        open={addStepOpen}
        onOpenChange={setAddStepOpen}
        onAdd={handleAddStep}
      />

      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        onOpenChange={setUnsavedDialogOpen}
        onDiscard={handleDiscard}
      />
    </>
  );
}
