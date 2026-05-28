"use client";

import { useState } from "react";
import { MockMaterialSpec, MockAuditEntry } from "../_data";
import MaterialSpecAuditLogSection from "./material-spec-audit-log-section";
import MaterialSpecReferenceList from "./material-spec-reference-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type EditableField = "materialName" | "form";

type Props = {
  spec: MockMaterialSpec;
  allSpecs: MockMaterialSpec[];
  onClose: () => void;
  onUpdate: (updated: MockMaterialSpec) => void;
  onDeactivate: (spec: MockMaterialSpec) => void;
};

export default function MaterialSpecDetailModal({
  spec,
  allSpecs,
  onClose,
  onUpdate,
  onDeactivate,
}: Props) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit(field: EditableField) {
    setEditValue(field === "materialName" ? spec.materialName : spec.form);
    setEditError(null);
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditError(null);
  }

  function saveEdit(field: EditableField) {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditError(`${field === "materialName" ? "Material Name" : "Form"} cannot be empty.`);
      return;
    }

    const newMaterialName = field === "materialName" ? trimmed : spec.materialName;
    const newForm = field === "form" ? trimmed : spec.form;

    // Check uniqueness against other specs (not self)
    const conflict = allSpecs.find(
      (s) =>
        s.materialSpecId !== spec.materialSpecId &&
        s.materialName.toLowerCase() === newMaterialName.toLowerCase() &&
        s.form.toLowerCase() === newForm.toLowerCase()
    );
    if (conflict) {
      setEditError(
        `The pair "${newMaterialName} · ${newForm}" already exists as MaterialSpec ${conflict.materialSpecId}.`
      );
      return;
    }

    const before = field === "materialName" ? spec.materialName : spec.form;
    if (before === trimmed) {
      cancelEdit();
      return;
    }

    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: "Jane Chen",
      action: "MaterialSpecUpdated",
      changedFields: [{ field, before, after: trimmed }],
    };

    const updated: MockMaterialSpec = {
      ...spec,
      materialName: newMaterialName,
      form: newForm,
      auditLog: [entry, ...spec.auditLog],
    };

    onUpdate(updated);
    setEditingField(null);
    setEditError(null);
  }

  function renderField(label: string, field: EditableField) {
    const isEditing = editingField === field;
    const value = field === "materialName" ? spec.materialName : spec.form;
    const canEdit = spec.isActive;

    return (
      <div className="py-3 border-b border-border last:border-0">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {isEditing ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => { setEditValue(e.target.value); setEditError(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(field);
                  if (e.key === "Escape") cancelEdit();
                }}
                className="flex-1"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
              <Button size="sm" variant="outline" onClick={() => saveEdit(field)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
            {editError && <p className="text-xs text-red-400">{editError}</p>}
          </div>
        ) : (
          <div
            className={`group flex items-center gap-2 ${canEdit ? "cursor-pointer" : ""}`}
            onClick={() => { if (canEdit) startEdit(field); }}
          >
            <span className="text-sm text-foreground">{value}</span>
            {canEdit && (
              <span className="hidden text-xs text-muted-foreground/50 group-hover:inline">✎</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-[580px] sm:!max-w-[580px] gap-0 p-0 flex flex-col overflow-hidden"
      >
        {/* Panel header */}
        <SheetHeader className="border-b border-border px-6 py-4 gap-1.5">
          <SheetTitle className="text-base font-semibold">
            {spec.materialName} · {spec.form}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {spec.isActive ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </>
            ) : (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                Inactive — editing disabled
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Stat tiles */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Used By
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {spec.usedByCount}
              </div>
              <div className="text-xs text-muted-foreground">active parts</div>
            </div>
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open Supply Orders
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {spec.openSupplyOrderCount}
              </div>
              <div className="text-xs text-muted-foreground">in progress</div>
            </div>
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active Work
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {spec.activeWoCount}
              </div>
              <div className="text-xs text-muted-foreground">
                total · {spec.awaitingReceiptWoCount} awaiting receipt ·{" "}
                {spec.awaitingPurchaseWoCount} awaiting purchase
              </div>
              <button
                onClick={() =>
                  console.log(
                    "Navigate to Operations Lens filtered by materialSpecId:",
                    spec.materialSpecId
                  )
                }
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View in Operations Lens →
              </button>
            </div>
          </div>

          {/* Editable fields */}
          <div className="mb-2">
            {renderField("Material Name", "materialName")}
            {renderField("Form", "form")}
          </div>

          {/* Reference list */}
          <div className="mb-2">
            <MaterialSpecReferenceList
              parts={spec.referencingParts}
              usedByCount={spec.usedByCount}
              materialSpecId={spec.materialSpecId}
            />
          </div>

          {/* Audit log */}
          <MaterialSpecAuditLogSection auditLog={spec.auditLog} />
        </div>

        {/* Panel footer */}
        <div className="border-t border-border px-6 py-4">
          {spec.isActive ? (
            <Button variant="destructive" onClick={() => onDeactivate(spec)}>
              Deactivate MaterialSpec
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              MaterialSpec is inactive. To reactivate, use the API directly (reactivation flow not
              in this mockup).
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
