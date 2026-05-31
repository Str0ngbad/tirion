"use client";

import { useState, useEffect, useRef } from "react";
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
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";

// ─── Section IDs ──────────────────────────────────────────────────────────────

export const SECTION_IDS = {
  header: "part-form-header",
  coreDetails: "part-form-core-details",
  materialVendor: "part-form-material-vendor",
  routing: "part-form-routing",
  parents: "part-form-parents",
  inventory: "part-form-inventory",
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  part: MockPart;
  actorName: string;
  scrollToSectionId: SectionId | null;
  onClose: () => void;
  onUpdate: (updated: MockPart) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function ReadDisplay({ value }: { value: React.ReactNode }) {
  return <div className="text-sm text-foreground">{value}</div>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PartFormSheet({
  part,
  actorName,
  scrollToSectionId,
  onClose,
  onUpdate,
}: Props) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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

  // When part changes, reset editable fields
  useEffect(() => {
    setPartName(part.partName);
    setIsActive(part.isActive);
    setDescription(part.description ?? "");
    setProcurementType(part.procurementType);
    setBlankLength(part.blankLength !== null ? part.blankLength.toString() : "");
    setNotes(part.notes ?? "");
  }, [part.partId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to section when scrollToSectionId changes
  useEffect(() => {
    if (!scrollToSectionId) return;
    const timeout = setTimeout(() => {
      const el = scrollAreaRef.current?.querySelector(`#${scrollToSectionId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(timeout);
  }, [scrollToSectionId, part.partId]);

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
    <div className="flex h-full flex-col bg-background">
      {/* Panel header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-foreground leading-tight">
            {part.partNumber}
          </div>
          <div className="mt-0.5 truncate text-sm text-muted-foreground leading-tight">
            {partName}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* ── Section 1: Header ─────────────────────────────────────── */}
        <section id={SECTION_IDS.header}>
          <SectionHeader title="Header" />
          <FormField label="Part Number">
            <ReadDisplay value={<span className="font-mono">{part.partNumber}</span>} />
          </FormField>
          <FormField label="Part Name">
            <Input
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              className="h-8 text-sm"
            />
          </FormField>
          <FormField label="Part Type">
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
          </FormField>
          <FormField label="Active">
            <div className="flex items-center gap-2">
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
          </FormField>
          <FormField label="Created">
            <ReadDisplay value={
              <span className="text-xs text-muted-foreground">
                {formatCreatedDate(part.createdAt)}
              </span>
            } />
          </FormField>
        </section>

        {/* ── Section 2: Core Details ───────────────────────────────── */}
        <section id={SECTION_IDS.coreDetails}>
          <SectionHeader title="Core Details" />
          <FormField label="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional description…"
              className="resize-none text-sm"
            />
          </FormField>
          <FormField label="Procurement Type">
            <Select
              value={procurementType}
              onValueChange={(v) => setProcurementType(v as ProcurementType)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Make">Make</SelectItem>
                <SelectItem value="Buy">Buy</SelectItem>
                <SelectItem value="MakeBuy">MakeBuy</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Blank Length">
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
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className="resize-none text-sm"
            />
          </FormField>
        </section>

        {/* ── Section 3: Material & Vendor (placeholder) ────────────── */}
        <section id={SECTION_IDS.materialVendor}>
          <SectionHeader title="Material & Vendor" />
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
            <p className="text-xs text-muted-foreground">Coming in a later commit.</p>
            {(part.materialSpec || part.defaultVendor || part.stockSize) && (
              <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                {part.materialSpec && (
                  <div className="flex gap-2 text-xs">
                    <span className="font-medium text-muted-foreground w-20">Material:</span>
                    <span className="text-foreground">{part.materialSpec.materialName} — {part.materialSpec.form}</span>
                  </div>
                )}
                {part.stockSize && (
                  <div className="flex gap-2 text-xs">
                    <span className="font-medium text-muted-foreground w-20">Stock Size:</span>
                    <span className="text-foreground">{part.stockSize}</span>
                  </div>
                )}
                {part.defaultVendor && (
                  <div className="flex gap-2 text-xs">
                    <span className="font-medium text-muted-foreground w-20">Vendor:</span>
                    <span className="text-foreground">{part.defaultVendor.vendorName}</span>
                  </div>
                )}
                {part.cost !== null && (
                  <div className="flex gap-2 text-xs">
                    <span className="font-medium text-muted-foreground w-20">Cost:</span>
                    <span className="text-foreground">${part.cost.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Section 4: Routing Template (placeholder) ─────────────── */}
        <section id={SECTION_IDS.routing}>
          <SectionHeader title="Routing Template" />
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
            <p className="text-xs text-muted-foreground">Coming in a later commit.</p>
            {part.routingTemplate && (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex gap-2 text-xs">
                  <span className="font-medium text-muted-foreground w-20">Template:</span>
                  <span className="text-foreground">{part.routingTemplate.templateName}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 5: Parent Assemblies (placeholder) ────────────── */}
        <section id={SECTION_IDS.parents}>
          <SectionHeader title="Parent Assemblies" />
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
            <p className="text-xs text-muted-foreground">Coming in a later commit.</p>
          </div>
        </section>

        {/* ── Section 6: Inventory (placeholder) ───────────────────── */}
        <section id={SECTION_IDS.inventory}>
          <SectionHeader title="Inventory" />
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-4">
            <p className="text-xs text-muted-foreground">Coming in a later commit.</p>
            <div className="mt-3 space-y-1.5 border-t border-border pt-3">
              <div className="flex gap-2 text-xs">
                <span className="font-medium text-muted-foreground w-20">Location:</span>
                <span className="text-foreground">{part.inventoryLocation ?? "—"}</span>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="font-medium text-muted-foreground w-20">Stock:</span>
                <span className="text-foreground">{part.stockCount}</span>
              </div>
              {part.binMin !== null && (
                <div className="flex gap-2 text-xs">
                  <span className="font-medium text-muted-foreground w-20">Bin Min/Max:</span>
                  <span className="text-foreground">{part.binMin} / {part.binMax ?? "—"}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Audit log */}
        <PartAuditLogSection auditLog={part.auditLog} />
      </div>

      {/* Panel footer */}
      <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-3">
        <Button size="sm" onClick={handleSave} disabled={!isDirty}>
          Save Changes
        </Button>
        {!isDirty && (
          <span className="text-xs text-muted-foreground">No unsaved changes</span>
        )}
        {isDirty && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}
