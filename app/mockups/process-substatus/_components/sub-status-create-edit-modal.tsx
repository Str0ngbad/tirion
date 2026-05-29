"use client";

import { useState } from "react";
import { MockSubStatus, MockAuditEntry } from "../_data";
import { ProcessTypeKey } from "@/app/mockups/users/_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CreateProps = {
  mode: "create";
  processType: ProcessTypeKey;
};

type EditProps = {
  mode: "edit";
  subStatus: MockSubStatus;
};

type Props = (CreateProps | EditProps) & {
  allSubStatuses: MockSubStatus[];
  maxSubStatusId: number;
  actorName: string;
  onClose: () => void;
  onCreate: (subStatus: MockSubStatus) => void;
  onUpdate: (subStatus: MockSubStatus) => void;
};

function defaultOrder(allSubStatuses: MockSubStatus[], processType: ProcessTypeKey): number {
  const forProcess = allSubStatuses.filter((s) => s.processType === processType);
  if (forProcess.length === 0) return 10;
  return Math.max(...forProcess.map((s) => s.displayOrder)) + 10;
}

export default function SubStatusCreateEditModal(props: Props) {
  const isEditMode = props.mode === "edit";
  const processType = isEditMode ? props.subStatus.processType : props.processType;
  const editingSubStatus = isEditMode ? props.subStatus : undefined;

  const [name, setName] = useState(editingSubStatus?.subStatusName ?? "");
  const [description, setDescription] = useState(editingSubStatus?.description ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    editingSubStatus != null
      ? String(editingSubStatus.displayOrder)
      : String(defaultOrder(props.allSubStatuses, processType))
  );
  const [nameError, setNameError] = useState<string | null>(null);

  function checkUnique(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const dupe = props.allSubStatuses.some(
      (s) =>
        s.processType === processType &&
        s.subStatusName.toLowerCase() === trimmed.toLowerCase() &&
        (!isEditMode || s.subStatusId !== editingSubStatus!.subStatusId)
    );
    return dupe ? `"${trimmed}" already exists for this process type.` : null;
  }

  const isNoChange =
    isEditMode &&
    name.trim() === editingSubStatus!.subStatusName &&
    (description.trim() || null) === editingSubStatus!.description &&
    parseInt(displayOrder, 10) === editingSubStatus!.displayOrder;

  const canSave = name.trim() !== "" && !nameError && (!isEditMode || !isNoChange);

  function handleNameChange(value: string) {
    setName(value);
    setNameError(checkUnique(value));
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedDesc = description.trim() || null;
    const order = parseInt(displayOrder, 10);

    if (!trimmedName) {
      setNameError("Name is required.");
      return;
    }
    const dupeErr = checkUnique(trimmedName);
    if (dupeErr) {
      setNameError(dupeErr);
      return;
    }

    if (isEditMode) {
      if (isNoChange) return;

      const changedFields: NonNullable<MockAuditEntry["changedFields"]> = [];
      if (trimmedName !== editingSubStatus!.subStatusName) {
        changedFields.push({ field: "subStatusName", before: editingSubStatus!.subStatusName, after: trimmedName });
      }
      if (trimmedDesc !== editingSubStatus!.description) {
        changedFields.push({ field: "description", before: editingSubStatus!.description, after: trimmedDesc });
      }
      if (!isNaN(order) && order !== editingSubStatus!.displayOrder) {
        changedFields.push({
          field: "displayOrder",
          before: String(editingSubStatus!.displayOrder),
          after: String(order),
        });
      }

      const entry: MockAuditEntry = {
        timestamp: new Date().toISOString(),
        userName: props.actorName,
        action: "SubStatusUpdated",
        changedFields: changedFields.length > 0 ? changedFields : undefined,
      };

      props.onUpdate({
        ...editingSubStatus!,
        subStatusName: trimmedName,
        description: trimmedDesc,
        displayOrder: isNaN(order) ? editingSubStatus!.displayOrder : order,
        auditLog: [entry, ...editingSubStatus!.auditLog],
      });
      return;
    }

    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: props.actorName,
      action: "SubStatusCreated",
    };

    props.onCreate({
      subStatusId: props.maxSubStatusId + 1,
      processType,
      subStatusName: trimmedName,
      description: trimmedDesc,
      displayOrder: isNaN(order) ? defaultOrder(props.allSubStatuses, processType) : order,
      isActive: true,
      auditLog: [entry],
    });
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Sub-Status" : "Add Sub-Status"}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Process type:</span>
          <ProcessTypeChip processType={processType} />
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label
              htmlFor="ss-name"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Sub-Status Name{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Input
              id="ss-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Setup"
              aria-invalid={!!nameError}
            />
            {nameError && <p className="mt-1 text-xs text-red-400">{nameError}</p>}
          </div>

          {/* Description */}
          <div>
            <Label
              htmlFor="ss-desc"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Description{" "}
              <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
                optional
              </span>
            </Label>
            <Textarea
              id="ss-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this sub-status…"
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Display Order */}
          <div>
            <Label
              htmlFor="ss-order"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Display Order{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Input
              id="ss-order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="w-28"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            {isEditMode ? "Save Changes" : "Create Sub-Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
