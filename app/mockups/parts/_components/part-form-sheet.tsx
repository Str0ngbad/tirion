"use client";

import { useState } from "react";
import { MockPart, MockPartAuditEntry, ProcurementType } from "../_data";
import PartAuditLogSection from "./part-audit-log-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type Props = {
  part: MockPart;
  actorName: string;
  onClose: () => void;
  onUpdate: (updated: MockPart) => void;
};

function formatCreatedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <Separator className="mt-2" />
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-4 py-2.5 items-start">
      <div className="pt-0.5 text-sm font-medium text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ReadDisplay({ value }: { value: React.ReactNode }) {
  return <div className="text-sm text-foreground">{value}</div>;
}

export default function PartFormSheet({ part, actorName, onClose, onUpdate }: Props) {
  // Editable header fields
  const [partName, setPartName] = useState(part.partName);
  const [isActive, setIsActive] = useState(part.isActive);

  // Editable core details fields
  const [description, setDescription] = useState(part.description ?? "");
  const [procurementType, setProcurementType] = useState<ProcurementType>(part.procurementType);
  const [blankLength, setBlankLength] = useState(
    part.blankLength !== null ? part.blankLength.toString() : ""
  );
  const [notes, setNotes] = useState(part.notes ?? "");

  function handleSave() {
    const changedFields: MockPartAuditEntry["changedFields"] = [];

    if (partName !== part.partName) {
      changedFields.push({ field: "partName", before: part.partName, after: partName });
    }
    if (description !== (part.description ?? "")) {
      changedFields.push({ field: "description", before: part.description, after: description || null });
    }
    if (procurementType !== part.procurementType) {
      changedFields.push({ field: "procurementType", before: part.procurementType, after: procurementType });
    }
    const parsedLength = blankLength !== "" ? parseFloat(blankLength) : null;
    if (parsedLength !== part.blankLength) {
      changedFields.push({
        field: "blankLength",
        before: part.blankLength !== null ? part.blankLength.toString() : null,
        after: parsedLength !== null ? parsedLength.toString() : null,
      });
    }
    if (notes !== (part.notes ?? "")) {
      changedFields.push({ field: "notes", before: part.notes, after: notes || null });
    }

    // Active state changes get their own action type
    const activeChanged = isActive !== part.isActive;
    const definitionChanged = changedFields.length > 0;

    const newLog: MockPartAuditEntry[] = [];

    if (activeChanged) {
      newLog.push({
        timestamp: new Date().toISOString(),
        userName: actorName,
        action: isActive ? "PartReactivated" : "PartDeactivated",
      });
    }

    if (definitionChanged) {
      newLog.push({
        timestamp: new Date().toISOString(),
        userName: actorName,
        action: "PartUpdated",
        changedFields,
      });
    }

    const updated: MockPart = {
      ...part,
      partName,
      isActive,
      description: description || null,
      procurementType,
      blankLength: parsedLength,
      notes: notes || null,
      auditLog: [...newLog, ...part.auditLog],
    };

    onUpdate(updated);
  }

  const isDirty =
    partName !== part.partName ||
    isActive !== part.isActive ||
    description !== (part.description ?? "") ||
    procurementType !== part.procurementType ||
    blankLength !== (part.blankLength !== null ? part.blankLength.toString() : "") ||
    notes !== (part.notes ?? "");

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-full sm:!max-w-[1100px] gap-0 p-0 flex flex-col overflow-hidden"
      >
        {/* Panel header */}
        <SheetHeader className="border-b border-border px-6 py-4 gap-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <SheetTitle className="font-mono text-base font-semibold">
                {part.partNumber}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-sm font-medium text-foreground/80 truncate">
                {partName}
              </SheetDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-0.5">
              <Badge variant={part.partType === "Assembly" ? "secondary" : "outline"} className="text-xs">
                {part.partType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Created {formatCreatedDate(part.createdAt)}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Section 1: Header ─────────────────────────────────────── */}
          <div>
            <SectionHeader title="Header" />
            <FormRow label="Part Number">
              <ReadDisplay value={<span className="font-mono">{part.partNumber}</span>} />
            </FormRow>
            <FormRow label="Part Name">
              <Input
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                className="h-8 text-sm"
              />
            </FormRow>
            <FormRow label="Part Type">
              <ReadDisplay
                value={
                  <Badge
                    variant={part.partType === "Assembly" ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {part.partType}
                  </Badge>
                }
              />
            </FormRow>
            <FormRow label="Active">
              <div className="flex items-center gap-2 pt-0.5">
                <Switch
                  id="part-active"
                  size="sm"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="part-active" className="cursor-pointer text-sm font-normal">
                  {isActive ? "Active" : "Inactive"}
                </Label>
              </div>
            </FormRow>
            <FormRow label="Created">
              <ReadDisplay value={formatCreatedDate(part.createdAt)} />
            </FormRow>
          </div>

          {/* ── Section 2: Core Details ───────────────────────────────── */}
          <div>
            <SectionHeader title="Core Details" />
            <FormRow label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description…"
                className="resize-none text-sm"
              />
            </FormRow>
            <FormRow label="Procurement Type">
              <Select
                value={procurementType}
                onValueChange={(v) => setProcurementType(v as ProcurementType)}
              >
                <SelectTrigger className="h-8 w-48 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Make">Make</SelectItem>
                  <SelectItem value="Buy">Buy</SelectItem>
                  <SelectItem value="MakeBuy">MakeBuy</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>
            <FormRow label="Blank Length">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={blankLength}
                  onChange={(e) => setBlankLength(e.target.value)}
                  placeholder="0.00"
                  className="h-8 w-28 text-sm"
                  min={0}
                  step={0.25}
                />
                <span className="text-sm text-muted-foreground">inches</span>
              </div>
            </FormRow>
            <FormRow label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes…"
                className="resize-none text-sm"
              />
            </FormRow>
          </div>

          {/* ── Section 3: Material & Vendor (placeholder) ────────────── */}
          <div>
            <SectionHeader title="Material & Vendor" />
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Material Spec, Stock Size, and Default Vendor selection — wired up in Commit 2 with in-context creation.
              </p>
              {/* Show current values read-only for context */}
              {(part.materialSpec || part.defaultVendor || part.stockSize) && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {part.materialSpec && (
                    <div className="flex gap-2 text-xs">
                      <span className="font-medium text-muted-foreground w-24">Material:</span>
                      <span className="text-foreground">{part.materialSpec.materialName} — {part.materialSpec.form}</span>
                    </div>
                  )}
                  {part.stockSize && (
                    <div className="flex gap-2 text-xs">
                      <span className="font-medium text-muted-foreground w-24">Stock Size:</span>
                      <span className="text-foreground">{part.stockSize}</span>
                    </div>
                  )}
                  {part.defaultVendor && (
                    <div className="flex gap-2 text-xs">
                      <span className="font-medium text-muted-foreground w-24">Vendor:</span>
                      <span className="text-foreground">{part.defaultVendor.vendorName}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Section 4: Routing Template (placeholder) ─────────────── */}
          <div>
            <SectionHeader title="Routing Template" />
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Assigned template and step pills — wired up in Commit 3.
              </p>
              {part.routingTemplate && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex gap-2 text-xs">
                    <span className="font-medium text-muted-foreground w-24">Template:</span>
                    <span className="text-foreground">{part.routingTemplate.templateName}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Section 5: Parent Assemblies (placeholder) ────────────── */}
          <div>
            <SectionHeader title="Parent Assemblies" />
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Read-only list of assemblies using this part — wired up in Commit 3.
              </p>
            </div>
          </div>

          {/* ── Section 6: Inventory (placeholder) ───────────────────── */}
          <div>
            <SectionHeader title="Inventory" />
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
              <p className="text-xs text-muted-foreground">
                Inventory Location and Stock Count — wired up in Commit 3.
              </p>
              {/* Show current values read-only for context */}
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                <div className="flex gap-2 text-xs">
                  <span className="font-medium text-muted-foreground w-24">Location:</span>
                  <span className="text-foreground">{part.inventoryLocation ?? "—"}</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="font-medium text-muted-foreground w-24">Stock Count:</span>
                  <span className="text-foreground">{part.stockCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit log */}
          <PartAuditLogSection auditLog={part.auditLog} />
        </div>

        {/* Panel footer */}
        <div className="border-t border-border px-6 py-4 flex items-center gap-3">
          <Button onClick={handleSave} disabled={!isDirty}>
            Save Changes
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {!isDirty && (
            <span className="text-xs text-muted-foreground ml-1">No unsaved changes</span>
          )}
          {isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400 ml-1">
              Unsaved changes — definition-impact dialog deferred to Commit 4
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
