"use client";

import { useState, useEffect, useRef } from "react";
import {
  MockPart,
  MockPartAuditEntry,
  MockMinimalMaterialSpec,
  MockMinimalVendor,
  MockMinimalRoutingTemplate,
  ProcurementType,
} from "../_data";
import PartAuditLogSection from "./part-audit-log-section";
import PartFormMaterialVendorSection from "./part-form-material-vendor-section";
import PartFormRoutingSection from "./part-form-routing-section";
import PartFormParentAssembliesSection from "./part-form-parent-assemblies-section";
import PartFormChildPartsSection from "./part-form-child-parts-section";
import PartFormInventorySection from "./part-form-inventory-section";
import DefinitionChangeFlagDialog from "./definition-change-flag-dialog";
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
  children: "part-form-children",
  inventory: "part-form-inventory",
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  part: MockPart;
  actorName: string;
  scrollToSectionId: SectionId | null;
  materialSpecs: MockMinimalMaterialSpec[];
  vendors: MockMinimalVendor[];
  onClose: () => void;
  onUpdate: (updated: MockPart) => void;
  onAddMaterialSpec: (spec: MockMinimalMaterialSpec) => void;
  onAddVendor: (vendor: MockMinimalVendor) => void;
  onNavigateToPart: (partId: number) => void;
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
  materialSpecs,
  vendors,
  onClose,
  onUpdate,
  onAddMaterialSpec,
  onAddVendor,
  onNavigateToPart,
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

  // Editable material & vendor fields
  const [formMaterialSpec, setFormMaterialSpec] = useState<MockMinimalMaterialSpec | null>(part.materialSpec);
  const [formStockSize, setFormStockSize] = useState(part.stockSize ?? "");
  const [formVendor, setFormVendor] = useState<MockMinimalVendor | null>(part.defaultVendor);

  // Editable routing template
  const [formRoutingTemplate, setFormRoutingTemplate] = useState<MockMinimalRoutingTemplate | null>(
    part.routingTemplate
  );

  // Definition Change Flag dialog
  const [definitionDialogOpen, setDefinitionDialogOpen] = useState(false);

  // Editable inventory fields
  const [formStockCount, setFormStockCount] = useState(part.stockCount);
  const [formInventoryLocation, setFormInventoryLocation] = useState(part.inventoryLocation ?? "");
  const [formBinMin, setFormBinMin] = useState(part.binMin !== null ? part.binMin.toString() : "");
  const [formBinMax, setFormBinMax] = useState(part.binMax !== null ? part.binMax.toString() : "");

  // Reset all state when switching to a different part
  useEffect(() => {
    setPartName(part.partName);
    setIsActive(part.isActive);
    setDescription(part.description ?? "");
    setProcurementType(part.procurementType);
    setBlankLength(part.blankLength !== null ? part.blankLength.toString() : "");
    setNotes(part.notes ?? "");
    setFormMaterialSpec(part.materialSpec);
    setFormStockSize(part.stockSize ?? "");
    setFormVendor(part.defaultVendor);
    setFormRoutingTemplate(part.routingTemplate);
    setFormStockCount(part.stockCount);
    setFormInventoryLocation(part.inventoryLocation ?? "");
    setFormBinMin(part.binMin !== null ? part.binMin.toString() : "");
    setFormBinMax(part.binMax !== null ? part.binMax.toString() : "");
  }, [part.partId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync inventory fields when grid inline-edit updates the part prop
  useEffect(() => {
    setFormStockCount(part.stockCount);
  }, [part.stockCount]);

  useEffect(() => {
    setFormInventoryLocation(part.inventoryLocation ?? "");
  }, [part.inventoryLocation]);

  // Scroll to section when scrollToSectionId changes
  useEffect(() => {
    if (!scrollToSectionId) return;
    const timeout = setTimeout(() => {
      const el = scrollAreaRef.current?.querySelector(`#${scrollToSectionId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(timeout);
  }, [scrollToSectionId, part.partId]);

  function definitionFieldChanged(): boolean {
    const parsedLen = blankLength !== "" ? parseFloat(blankLength) : null;
    return (
      formMaterialSpec?.materialSpecId !== part.materialSpec?.materialSpecId ||
      formStockSize !== (part.stockSize ?? "") ||
      formVendor?.vendorId !== part.defaultVendor?.vendorId ||
      formRoutingTemplate?.templateId !== part.routingTemplate?.templateId ||
      parsedLen !== part.blankLength
    );
  }

  function hasDownstreamImpact(): boolean {
    return (
      part.parentAssemblies.length > 0 ||
      part.openWos.length > 0 ||
      part.stockCount > 0
    );
  }

  function handleSave() {
    if (definitionFieldChanged() && hasDownstreamImpact()) {
      setDefinitionDialogOpen(true);
      return;
    }
    commitSave();
  }

  function commitSave() {
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

    const prevSpecLabel = part.materialSpec
      ? `${part.materialSpec.materialName} — ${part.materialSpec.form}`
      : null;
    const nextSpecLabel = formMaterialSpec
      ? `${formMaterialSpec.materialName} — ${formMaterialSpec.form}`
      : null;
    if (prevSpecLabel !== nextSpecLabel) {
      changedFields.push({ field: "materialSpec", before: prevSpecLabel, after: nextSpecLabel });
    }

    const prevStockSize = part.stockSize ?? "";
    if (formStockSize !== prevStockSize) {
      changedFields.push({
        field: "stockSize",
        before: part.stockSize,
        after: formStockSize || null,
      });
    }

    const prevVendorName = part.defaultVendor?.vendorName ?? null;
    const nextVendorName = formVendor?.vendorName ?? null;
    if (prevVendorName !== nextVendorName) {
      changedFields.push({ field: "defaultVendor", before: prevVendorName, after: nextVendorName });
    }

    if (formRoutingTemplate?.templateId !== part.routingTemplate?.templateId) {
      changedFields.push({
        field: "routingTemplate",
        before: part.routingTemplate?.templateName ?? "none",
        after: formRoutingTemplate?.templateName ?? "none",
      });
    }

    if (formStockCount !== part.stockCount) {
      changedFields.push({
        field: "stockCount",
        before: part.stockCount.toString(),
        after: formStockCount.toString(),
      });
    }

    const prevLocation = part.inventoryLocation ?? "";
    const nextLocation = formInventoryLocation.trim();
    if (nextLocation !== prevLocation) {
      changedFields.push({
        field: "inventoryLocation",
        before: part.inventoryLocation,
        after: nextLocation || null,
      });
    }

    const parsedBinMin = formBinMin !== "" ? parseFloat(formBinMin) : null;
    if (parsedBinMin !== part.binMin) {
      changedFields.push({
        field: "binMin",
        before: part.binMin !== null ? part.binMin.toString() : null,
        after: parsedBinMin !== null ? parsedBinMin.toString() : null,
      });
    }

    const parsedBinMax = formBinMax !== "" ? parseFloat(formBinMax) : null;
    if (parsedBinMax !== part.binMax) {
      changedFields.push({
        field: "binMax",
        before: part.binMax !== null ? part.binMax.toString() : null,
        after: parsedBinMax !== null ? parsedBinMax.toString() : null,
      });
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
      materialSpec: formMaterialSpec,
      stockSize: formStockSize || null,
      defaultVendor: formVendor,
      routingTemplate: formRoutingTemplate,
      stockCount: formStockCount,
      inventoryLocation: formInventoryLocation.trim() || null,
      binMin: parsedBinMin,
      binMax: parsedBinMax,
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
    notes !== (part.notes ?? "") ||
    formMaterialSpec?.materialSpecId !== part.materialSpec?.materialSpecId ||
    formStockSize !== (part.stockSize ?? "") ||
    formVendor?.vendorId !== part.defaultVendor?.vendorId ||
    formRoutingTemplate?.templateId !== part.routingTemplate?.templateId ||
    formStockCount !== part.stockCount ||
    formInventoryLocation.trim() !== (part.inventoryLocation ?? "") ||
    formBinMin !== (part.binMin !== null ? part.binMin.toString() : "") ||
    formBinMax !== (part.binMax !== null ? part.binMax.toString() : "");

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

        {/* ── Section 3: Material & Vendor ──────────────────────────── */}
        <section id={SECTION_IDS.materialVendor}>
          <SectionHeader title="Material & Vendor" />
          <PartFormMaterialVendorSection
            partType={part.partType}
            materialSpec={formMaterialSpec}
            stockSize={formStockSize}
            defaultVendor={formVendor}
            materialSpecs={materialSpecs}
            vendors={vendors}
            onMaterialSpecChange={setFormMaterialSpec}
            onStockSizeChange={setFormStockSize}
            onVendorChange={setFormVendor}
            onAddMaterialSpec={onAddMaterialSpec}
            onAddVendor={onAddVendor}
          />
        </section>

        {/* ── Section 4: Routing Template ───────────────────────────── */}
        <section id={SECTION_IDS.routing}>
          <SectionHeader title="Routing Template" />
          <PartFormRoutingSection
            partType={part.partType}
            routingTemplate={formRoutingTemplate}
            onChange={setFormRoutingTemplate}
          />
        </section>

        {/* ── Section 5: Parent Assemblies ──────────────────────────── */}
        <section id={SECTION_IDS.parents}>
          <SectionHeader title="Parent Assemblies" />
          <PartFormParentAssembliesSection
            parentAssemblies={part.parentAssemblies}
            onNavigate={onNavigateToPart}
          />
        </section>

        {/* ── Section 5b: Child Parts (Assemblies only) ─────────────── */}
        {part.partType === "Assembly" && (
          <section id={SECTION_IDS.children}>
            <SectionHeader title="Child Parts" />
            <PartFormChildPartsSection
              childParts={part.childParts}
              onNavigate={onNavigateToPart}
            />
          </section>
        )}

        {/* ── Section 6: Inventory ──────────────────────────────────── */}
        <section id={SECTION_IDS.inventory}>
          <SectionHeader title="Inventory" />
          <PartFormInventorySection
            partType={part.partType}
            stockCount={formStockCount}
            inventoryLocation={formInventoryLocation}
            binMin={formBinMin}
            binMax={formBinMax}
            onStockCountChange={setFormStockCount}
            onInventoryLocationChange={setFormInventoryLocation}
            onBinMinChange={setFormBinMin}
            onBinMaxChange={setFormBinMax}
          />
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

      <DefinitionChangeFlagDialog
        part={part}
        open={definitionDialogOpen}
        onOpenChange={setDefinitionDialogOpen}
        onConfirm={() => {
          setDefinitionDialogOpen(false);
          commitSave();
        }}
      />
    </div>
  );
}
