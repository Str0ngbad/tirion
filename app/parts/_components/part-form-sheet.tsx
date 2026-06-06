"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronRight, Plus, Check, ChevronsUpDown, ExternalLink, Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useUpdatePart,
  useSetPartActive,
  useUpdateStockCount,
  useUpdateInventoryLocation,
  usePartAuditLog,
  useBomParents,
  useBomChildren,
  usePartOpenWos,
  useCreatePart,
} from "@/lib/api/parts";
import type { PartRowClient } from "@/lib/api/parts";
import { useQueryClient } from "@tanstack/react-query";
import { useVendors, useCreateVendor } from "@/lib/api/vendors";
import type { VendorRow } from "@/lib/api/vendors";
import { useMaterialSpecs, useCreateMaterialSpec } from "@/lib/api/material-specs";
import type { MaterialSpecRow } from "@/lib/api/material-specs";
import { useRoutingTemplates } from "@/lib/api/routing-templates";
import type { RoutingTemplateRow } from "@/lib/routing-templates/types";
import ProcessTypeChip from "@/components/process-type-chip";
import type { ProcessTypeKey } from "@/lib/process-types";

// ─── Section IDs ──────────────────────────────────────────────────────────────

export const SECTION_IDS = {
  description: "part-form-description",
  notes: "part-form-notes",
  inventory: "part-form-inventory",
  materialVendor: "part-form-material-vendor",
  routing: "part-form-routing",
  parents: "part-form-parents",
  children: "part-form-children",
  activeWos: "part-form-active-wos",
  auditLog: "part-form-audit-log",
} as const;

export type SectionId = (typeof SECTION_IDS)[keyof typeof SECTION_IDS];

// ─── Definition-change field keys ────────────────────────────────────────────

type DefinitionFields = {
  materialSpecId: number | null;
  defaultVendorId: number | null;
  stockSize: string | null;
  blankLength: number | null;
  procurementCategoryId: number | null;
  routingTemplateDefinitionId: number | null;
  partCost: number | null;
};

// ─── Small components ─────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  unit,
  onClick,
}: {
  label: string;
  value: number;
  unit?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-start gap-0.5 rounded-md border bg-card/30 px-3 py-2 hover:bg-muted/40 transition-colors text-left"
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">
      {children}
    </h3>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      {children}
    </div>
  );
}

// ─── Combobox ─────────────────────────────────────────────────────────────────

function ComboboxField<T extends { id: number; label: string; sublabel?: string }>({
  value,
  options,
  placeholder,
  onSelect,
  onCreate,
  createLabel,
  disabled,
}: {
  value: number | null;
  options: T[];
  placeholder: string;
  onSelect: (id: number | null) => void;
  onCreate?: () => void;
  createLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
            "hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
            !selected && "text-muted-foreground"
          )}
        >
          <span className="truncate">
            {selected ? (
              <span>
                {selected.label}
                {selected.sublabel && (
                  <span className="text-muted-foreground ml-1.5">{selected.sublabel}</span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {value !== null && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onSelect(null);
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground italic">Clear selection</span>
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={`${opt.label} ${opt.sublabel ?? ""}`}
                  onSelect={() => {
                    onSelect(opt.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{opt.sublabel}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && createLabel && (
              <CommandGroup>
                <CommandItem
                  value="__create__"
                  onSelect={() => {
                    setOpen(false);
                    onCreate();
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Add Vendor modal ─────────────────────────────────────────────────────────

function AddVendorModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (vendor: VendorRow) => void;
}) {
  const [vendorName, setVendorName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const createVendor = useCreateVendor();

  function handleSubmit() {
    const name = vendorName.trim();
    if (!name) {
      setNameError("Vendor name is required.");
      return;
    }
    createVendor.mutate(
      {
        vendorName: name,
        contactInfo: contactInfo.trim() || null,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays, 10) : null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: (vendor) => {
          onCreated(vendor);
          onClose();
          setVendorName("");
          setContactInfo("");
          setLeadTimeDays("");
          setNotes("");
          setNameError(null);
          toast.success(`Vendor "${vendor.vendorName}" created`);
        },
        onError: (err) => {
          if (err.message?.toLowerCase().includes("already exists") || err.message?.includes("P2002")) {
            setNameError("A vendor with this name already exists.");
          } else {
            toast.error("Failed to create vendor.");
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
          <DialogDescription>Create a new vendor to assign to this part.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <FormField label="Vendor Name *">
            <Input
              value={vendorName}
              onChange={(e) => { setVendorName(e.target.value); setNameError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g., Acme Materials"
              autoFocus
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </FormField>
          <FormField label="Contact Info">
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Email or phone"
            />
          </FormField>
          <FormField label="Lead Time (days)">
            <Input
              type="number"
              min={0}
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              placeholder="e.g., 14"
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createVendor.isPending}>
            {createVendor.isPending ? "Creating…" : "Create Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add MaterialSpec modal ───────────────────────────────────────────────────

function AddMaterialSpecModal({
  open,
  onClose,
  onCreated,
  existingSpecs,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (spec: MaterialSpecRow) => void;
  existingSpecs: MaterialSpecRow[];
}) {
  const [materialName, setMaterialName] = useState("");
  const [form, setForm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createSpec = useCreateMaterialSpec();

  const existingNames = [...new Set(existingSpecs.map((s) => s.materialName))].sort();
  const existingForms = [...new Set(existingSpecs.map((s) => s.form))].sort();
  const alreadyExists = existingSpecs.some(
    (s) =>
      s.materialName.toLowerCase() === materialName.trim().toLowerCase() &&
      s.form.toLowerCase() === form.trim().toLowerCase()
  );

  function handleSubmit() {
    const name = materialName.trim();
    const f = form.trim();
    if (!name || !f) {
      setError("Both material name and form are required.");
      return;
    }
    if (alreadyExists) {
      const existing = existingSpecs.find(
        (s) =>
          s.materialName.toLowerCase() === name.toLowerCase() &&
          s.form.toLowerCase() === f.toLowerCase()
      )!;
      onCreated(existing);
      onClose();
      return;
    }
    createSpec.mutate(
      { materialName: name, form: f },
      {
        onSuccess: (spec) => {
          onCreated(spec);
          onClose();
          setMaterialName("");
          setForm("");
          setError(null);
          toast.success(`Material spec "${spec.materialName} / ${spec.form}" created`);
        },
        onError: () => {
          toast.error("Failed to create material spec.");
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Material Spec</DialogTitle>
          <DialogDescription>
            Specify the material name and form. If this combination already exists, it will be
            selected.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <FormField label="Material Name *">
            <Input
              value={materialName}
              onChange={(e) => { setMaterialName(e.target.value); setError(null); }}
              list="material-names"
              placeholder="e.g., 1018 CRS"
              autoFocus
            />
            <datalist id="material-names">
              {existingNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FormField>
          <FormField label="Form *">
            <Input
              value={form}
              onChange={(e) => { setForm(e.target.value); setError(null); }}
              list="material-forms"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="e.g., Round Bar"
            />
            <datalist id="material-forms">
              {existingForms.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </FormField>
          {alreadyExists && (
            <p className="text-xs text-muted-foreground italic">
              This combination already exists — clicking confirm will select it.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createSpec.isPending}>
            {alreadyExists ? "Use Existing" : createSpec.isPending ? "Creating…" : "Create Spec"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Definition Change Flag dialog ────────────────────────────────────────────

type DcfDetail = "parents" | "wos" | "stock" | null;

function DcfDialog({
  open,
  partNumber,
  parentCount,
  openWoCount,
  stockCount,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  partNumber: string;
  parentCount: number;
  openWoCount: number;
  stockCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [expanded, setExpanded] = useState<DcfDetail>(null);

  function toggle(detail: DcfDetail) {
    setExpanded((v) => (v === detail ? null : detail));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Definition change — downstream impact</DialogTitle>
          <DialogDescription>
            You&apos;re changing a definition field on{" "}
            <span className="font-mono font-semibold">{partNumber}</span>. The following are
            affected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 py-2">
          {parentCount > 0 && (
            <button
              onClick={() => toggle("parents")}
              className={cn(
                "flex-1 flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors",
                expanded === "parents" ? "bg-muted border-border" : "bg-card/30 hover:bg-muted/40"
              )}
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Parent Assemblies
              </span>
              <span className="text-2xl font-semibold tabular-nums">{parentCount}</span>
            </button>
          )}
          {openWoCount > 0 && (
            <button
              onClick={() => toggle("wos")}
              className={cn(
                "flex-1 flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors",
                expanded === "wos" ? "bg-muted border-border" : "bg-card/30 hover:bg-muted/40"
              )}
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Open WOs
              </span>
              <span className="text-2xl font-semibold tabular-nums">{openWoCount}</span>
            </button>
          )}
          {stockCount > 0 && (
            <button
              onClick={() => toggle("stock")}
              className={cn(
                "flex-1 flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors",
                expanded === "stock" ? "bg-muted border-border" : "bg-card/30 hover:bg-muted/40"
              )}
            >
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                Units in Stock
              </span>
              <span className="text-2xl font-semibold tabular-nums">{stockCount}</span>
            </button>
          )}
        </div>

        {expanded === "parents" && (
          <p className="text-sm text-muted-foreground">
            {parentCount} parent {parentCount === 1 ? "assembly references" : "assemblies reference"}{" "}
            this part. Their BOMs may need review if the part definition change affects fit or form.
          </p>
        )}
        {expanded === "wos" && (
          <p className="text-sm text-muted-foreground">
            {openWoCount} open work {openWoCount === 1 ? "order" : "orders"} for this part. These
            WOs may need to be reviewed for conformance to the updated definition.
          </p>
        )}
        {expanded === "stock" && (
          <p className="text-sm text-muted-foreground">
            {stockCount} units currently in stock. This stock was produced to the prior definition
            and may not conform to the updated specification.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>Confirm Change</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Unsaved Changes dialog ───────────────────────────────────────────────────

function UnsavedChangesDialog({
  open,
  partNumber,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  partNumber: string;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>
            Your changes to{" "}
            <span className="font-mono font-semibold">{partNumber}</span> aren&apos;t saved. If you
            navigate away, they&apos;ll be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            Discard and continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Part Form Sheet ──────────────────────────────────────────────────────────

type PartFormSheetProps =
  | {
      mode: "edit";
      part: PartRowClient;
      initialSection?: SectionId;
      onClose: () => void;
      onUpdate: (updated: PartRowClient) => void;
      onNavigateToPart?: (partId: number) => void;
      onCreated?: never;
    }
  | {
      mode: "create";
      part?: never;
      initialSection?: never;
      onClose: () => void;
      onUpdate?: never;
      onNavigateToPart?: never;
      /** Called with the newly-created part so the page can switch to edit mode */
      onCreated: (created: PartRowClient) => void;
    };

export default function PartFormSheet(props: PartFormSheetProps) {
  const { mode, onClose } = props;
  const part = mode === "edit" ? props.part : undefined;
  const onUpdate = mode === "edit" ? props.onUpdate : undefined;
  const onNavigateToPart = mode === "edit" ? props.onNavigateToPart : undefined;
  const onCreated = mode === "create" ? props.onCreated : undefined;
  const initialSection = mode === "edit" ? props.initialSection : undefined;
  // ── Create mode fields ─────────────────────────────────────────────────────
  const [createPartNumber, setCreatePartNumber] = useState("");
  const [createPartType, setCreatePartType] = useState<"Part" | "Assembly">("Part");

  // ── Core form state ────────────────────────────────────────────────────────
  const [partName, setPartName] = useState(part?.partName ?? "");
  const [isActive, setIsActive] = useState(part?.isActive ?? true);
  const [description, setDescription] = useState(part?.description ?? "");
  const [notes, setNotes] = useState<string | null>(part?.notes ?? null);
  const [notesOpen, setNotesOpen] = useState((part?.notes ?? null) !== null && (part?.notes ?? "") !== "");
  const [stockCount, setStockCount] = useState(part?.stockCount ?? 0);
  const [inventoryLocation, setInventoryLocation] = useState<string | null>(part?.inventoryLocation ?? null);

  // ── Definition fields ──────────────────────────────────────────────────────
  const [materialSpecId, setMaterialSpecId] = useState<number | null>(part?.materialSpecId ?? null);
  const [defaultVendorId, setDefaultVendorId] = useState<number | null>(part?.defaultVendorId ?? null);
  const [stockSize, setStockSize] = useState<string | null>(part?.stockSize ?? null);
  const [blankLength, setBlankLength] = useState<number | null>(part?.blankLength ?? null);
  const [procurementCategoryId] = useState<number | null>(part?.procurementCategoryId ?? null);
  const [routingTemplateDefinitionId, setRoutingTemplateDefinitionId] = useState<number | null>(
    part?.routingTemplateDefinitionId ?? null
  );
  const [partCost, setPartCost] = useState<number | null>(part?.partCost ?? null);
  const [vendorPartNumber, setVendorPartNumber] = useState<string | null>(part?.vendorPartNumber ?? null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [auditLogOpen, setAuditLogOpen] = useState(false);
  const [showRoutingPicker, setShowRoutingPicker] = useState(false);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [addMaterialSpecOpen, setAddMaterialSpecOpen] = useState(false);
  const [dcfDialogOpen, setDcfDialogOpen] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [pendingNavPartId, setPendingNavPartId] = useState<number | null>(null);

  // Sync when part prop changes (e.g., cross-sheet navigation or inline grid edit).
  // Guards against undefined in create mode (part is undefined there, so these never fire).
  useEffect(() => { if (part) setPartName(part.partName); }, [part?.partName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setIsActive(part.isActive); }, [part?.isActive]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setDescription(part.description ?? ""); }, [part?.description]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) { setNotes(part.notes); setNotesOpen(part.notes !== null && part.notes !== ""); } }, [part?.notes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setStockCount(part.stockCount ?? 0); }, [part?.stockCount]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setInventoryLocation(part.inventoryLocation); }, [part?.inventoryLocation]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setMaterialSpecId(part.materialSpecId); }, [part?.materialSpecId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setDefaultVendorId(part.defaultVendorId); }, [part?.defaultVendorId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setStockSize(part.stockSize); }, [part?.stockSize]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setBlankLength(part.blankLength); }, [part?.blankLength]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setRoutingTemplateDefinitionId(part.routingTemplateDefinitionId); }, [part?.routingTemplateDefinitionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setPartCost(part.partCost); }, [part?.partCost]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (part) setVendorPartNumber(part.vendorPartNumber); }, [part?.vendorPartNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dirty detection ────────────────────────────────────────────────────────
  const isDirty = part !== undefined && (
    partName !== part.partName ||
    isActive !== part.isActive ||
    description !== (part.description ?? "") ||
    notes !== part.notes ||
    stockCount !== (part.stockCount ?? 0) ||
    inventoryLocation !== part.inventoryLocation ||
    materialSpecId !== part.materialSpecId ||
    defaultVendorId !== part.defaultVendorId ||
    stockSize !== part.stockSize ||
    blankLength !== part.blankLength ||
    routingTemplateDefinitionId !== part.routingTemplateDefinitionId ||
    partCost !== part.partCost ||
    vendorPartNumber !== part.vendorPartNumber
  );

  const definitionDirty: DefinitionFields = {
    materialSpecId,
    defaultVendorId,
    stockSize,
    blankLength,
    procurementCategoryId,
    routingTemplateDefinitionId,
    partCost,
  };
  const isDefinitionDirty = part !== undefined && (
    materialSpecId !== part.materialSpecId ||
    defaultVendorId !== part.defaultVendorId ||
    stockSize !== part.stockSize ||
    blankLength !== part.blankLength ||
    routingTemplateDefinitionId !== part.routingTemplateDefinitionId ||
    partCost !== part.partCost
  );
  void definitionDirty;

  // ── Create mode: Part Number uniqueness check ──────────────────────────────
  const queryClient = useQueryClient();
  const createPartNumberConflict = (() => {
    if (mode !== "create" || !createPartNumber.trim()) return false;
    const cached = queryClient.getQueriesData<PartRowClient[]>({ queryKey: ["parts", "grid"] });
    return cached.some(([, rows]) =>
      rows?.some((r) => r.partNumber.toLowerCase() === createPartNumber.trim().toLowerCase())
    );
  })();

  const createCanSave =
    mode === "create" &&
    createPartNumber.trim().length > 0 &&
    partName.trim().length > 0 &&
    !createPartNumberConflict;

  // ── Lazy fetches (disabled in create mode — no partId yet) ────────────────
  const partId = part?.partId ?? 0;
  const auditLogQuery = usePartAuditLog(partId, auditLogOpen && mode === "edit");
  const bomParentsQuery = useBomParents(partId, mode === "edit");
  const bomChildrenQuery = useBomChildren(partId, mode === "edit" && part?.partType === "Assembly");
  const openWosQuery = usePartOpenWos(partId, mode === "edit");

  // ── External data ──────────────────────────────────────────────────────────
  const vendorsQuery = useVendors({ active: "true" });
  const specsQuery = useMaterialSpecs({ active: "true" });
  const templatesQuery = useRoutingTemplates({ active: "all" });

  const vendorOptions = (vendorsQuery.data ?? []).map((v) => ({
    id: v.vendorId,
    label: v.vendorName,
    sublabel: v.notes ? undefined : undefined,
    notes: v.notes,
  }));

  const specOptions = (specsQuery.data ?? []).map((s) => ({
    id: s.materialSpecId,
    label: s.materialName,
    sublabel: s.form,
  }));

  const currentTemplate = (templatesQuery.data ?? []).find(
    (t) => t.routingTemplateDefinitionId === routingTemplateDefinitionId
  );

  const effectivePartType = mode === "create" ? createPartType : part?.partType;
  const compatibleTemplates = (templatesQuery.data ?? []).filter((t) => {
    if (!t.isActive) return false;
    if (effectivePartType === "Assembly") {
      return !t.steps.some((s) =>
        ["Purchase", "Receive"].includes(s.processTypeName)
      );
    }
    return true;
  });

  const selectedVendor = vendorsQuery.data?.find((v) => v.vendorId === defaultVendorId);

  // ── Scroll coordination ────────────────────────────────────────────────────
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollTo = useCallback((sectionId: SectionId) => {
    const el = scrollAreaRef.current?.querySelector(`#${sectionId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (initialSection) {
      const id = setTimeout(() => scrollTo(initialSection), 80);
      return () => clearTimeout(id);
    }
  }, [initialSection, scrollTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updatePart = useUpdatePart();
  const setPartActive = useSetPartActive();
  const updateStockCount = useUpdateStockCount();
  const updateInventoryLocation = useUpdateInventoryLocation();
  const createPartMutation = useCreatePart();

  const isSaving =
    updatePart.isPending ||
    setPartActive.isPending ||
    updateStockCount.isPending ||
    updateInventoryLocation.isPending ||
    createPartMutation.isPending;

  // ── Create Part ────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createCanSave) return;
    createPartMutation.mutate(
      {
        partNumber: createPartNumber.trim(),
        partName: partName.trim(),
        partType: createPartType,
      },
      {
        onSuccess: (created) => {
          toast.success(`Part ${created.partNumber} created`);
          onCreated?.(created);
        },
        onError: (err) => {
          if (err.message?.includes("409") || err.message?.toLowerCase().includes("already exists")) {
            toast.error(`Part number "${createPartNumber.trim()}" already exists.`);
          } else {
            toast.error("Failed to create part.");
          }
        },
      }
    );
  }

  // ── Save (inner, no DCF check) ────────────────────────────────────────────
  async function commitSave() {
    if (!isDirty || !part) return;
    const promises: Promise<unknown>[] = [];

    type PatchInput = Parameters<typeof updatePart.mutate>[0]["input"];
    const patchFields: PatchInput = {};
    if (partName !== part.partName) patchFields.partName = partName;
    if (description !== (part.description ?? "")) patchFields.description = description || null;
    if (notes !== part.notes) patchFields.notes = notes;
    if (materialSpecId !== part.materialSpecId) patchFields.materialSpecId = materialSpecId;
    if (defaultVendorId !== part.defaultVendorId) patchFields.defaultVendorId = defaultVendorId;
    if (stockSize !== part.stockSize) patchFields.stockSize = stockSize;
    if (blankLength !== part.blankLength) patchFields.blankLength = blankLength;
    if (routingTemplateDefinitionId !== part.routingTemplateDefinitionId)
      patchFields.routingTemplateDefinitionId = routingTemplateDefinitionId;
    if (partCost !== part.partCost) patchFields.partCost = partCost;
    if (vendorPartNumber !== part.vendorPartNumber) patchFields.vendorPartNumber = vendorPartNumber;

    if (Object.keys(patchFields).length > 0) {
      promises.push(
        new Promise<void>((res, rej) =>
          updatePart.mutate(
            { partId: part.partId, input: patchFields },
            { onSuccess: () => res(), onError: rej }
          )
        )
      );
    }

    if (isActive !== part.isActive) {
      promises.push(
        new Promise<void>((res, rej) =>
          setPartActive.mutate({ partId: part.partId, active: isActive }, { onSuccess: () => res(), onError: rej })
        )
      );
    }

    if (stockCount !== (part.stockCount ?? 0)) {
      promises.push(
        new Promise<void>((res, rej) =>
          updateStockCount.mutate({ partId: part.partId, stockCount }, { onSuccess: () => res(), onError: rej })
        )
      );
    }

    if (inventoryLocation !== part.inventoryLocation) {
      promises.push(
        new Promise<void>((res, rej) =>
          updateInventoryLocation.mutate(
            { partId: part.partId, inventoryLocation },
            { onSuccess: () => res(), onError: rej }
          )
        )
      );
    }

    try {
      await Promise.all(promises);
      onUpdate?.({
        ...part,
        partName,
        isActive,
        description: description || null,
        notes,
        stockCount,
        inventoryLocation,
        materialSpecId,
        defaultVendorId,
        stockSize,
        blankLength,
        routingTemplateDefinitionId,
        partCost,
        vendorPartNumber,
        defaultVendorName: selectedVendor?.vendorName ?? part.defaultVendorName,
        materialName:
          specsQuery.data?.find((s) => s.materialSpecId === materialSpecId)?.materialName ??
          part.materialName,
        materialForm:
          specsQuery.data?.find((s) => s.materialSpecId === materialSpecId)?.form ??
          part.materialForm,
        routingTemplateName: currentTemplate?.templateName ?? part.routingTemplateName,
      });
      toast.success("Part saved");
    } catch {
      toast.error("Failed to save part");
    }
  }

  // ── Save (with DCF gate) ───────────────────────────────────────────────────
  async function handleSave() {
    if (!isDirty || !part) return;

    if (isDefinitionDirty) {
      const parentCount = bomParentsQuery.data?.length ?? 0;
      const woCount = openWosQuery.data?.length ?? 0;
      const stock = part.stockCount ?? 0;
      if (parentCount > 0 || woCount > 0 || stock > 0) {
        setDcfDialogOpen(true);
        return;
      }
    }

    await commitSave();
  }

  // ── Cross-sheet navigation (edit mode only) ────────────────────────────────
  function requestNavigate(targetPartId: number) {
    if (isDirty) {
      setPendingNavPartId(targetPartId);
      setUnsavedDialogOpen(true);
    } else {
      onNavigateToPart?.(targetPartId);
    }
  }

  function handleUnsavedDiscard() {
    setUnsavedDialogOpen(false);
    if (pendingNavPartId !== null) {
      onNavigateToPart?.(pendingNavPartId);
      setPendingNavPartId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const activeWoCount = openWosQuery.data?.length ?? 0;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">

        {/* Identity row */}
        <div className="flex items-start gap-3 border-b px-4 py-3 shrink-0">
          <div className="flex flex-col min-w-0 flex-1 gap-1">
            {mode === "create" ? (
              /* Create mode: editable Part Number, Part Type select, Part Name input */
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Create New Part</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      value={createPartNumber}
                      onChange={(e) => setCreatePartNumber(e.target.value)}
                      placeholder="Part Number *"
                      className="font-mono text-sm h-8"
                      autoFocus
                    />
                    {createPartNumberConflict && (
                      <p className="text-xs text-destructive mt-1">
                        Part number already exists in the library.
                      </p>
                    )}
                  </div>
                  <Select
                    value={createPartType}
                    onValueChange={(v) => setCreatePartType(v as "Part" | "Assembly")}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Part">Part</SelectItem>
                      <SelectItem value="Assembly">Assembly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="Part Name *"
                  className="text-sm h-8"
                />
              </div>
            ) : (
              /* Edit mode: part number read-only, badge, active toggle, editable name */
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-muted-foreground">
                    {part?.partNumber}
                  </span>
                  <Badge variant={part?.partType === "Assembly" ? "secondary" : "outline"}>
                    {part?.partType}
                  </Badge>
                  <div className="flex items-center gap-1.5 ml-1">
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                      className="scale-90"
                    />
                    <span className="text-xs text-muted-foreground">
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <Input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="text-sm border-0 px-0 h-7 focus-visible:ring-0 focus-visible:ring-offset-0 font-medium bg-transparent"
                />
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 mt-0.5"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Stat tile row — hidden in create mode */}
        {mode === "edit" && (
          <div className="flex items-stretch gap-2 px-4 py-3 border-b shrink-0">
            {part?.partType === "Assembly" ? (
              <StatTile
                label="Buildable"
                value={part.buildableCount ?? 0}
                unit="buildable"
                onClick={() => scrollTo(SECTION_IDS.children)}
              />
            ) : (
              <StatTile
                label="Stock"
                value={stockCount}
                unit="in stock"
                onClick={() => scrollTo(SECTION_IDS.inventory)}
              />
            )}
            <StatTile
              label="Used In"
              value={bomParentsQuery.data?.length ?? (part?.assembliesUsedInCount ?? 0)}
              unit={(part?.assembliesUsedInCount ?? 0) === 1 ? "assembly" : "assemblies"}
              onClick={() => scrollTo(SECTION_IDS.parents)}
            />
            <StatTile
              label="Active WOs"
              value={activeWoCount}
              unit="work orders"
              onClick={() => scrollTo(SECTION_IDS.activeWos)}
            />
          </div>
        )}

        {/* Jump-to row — hidden in create mode */}
        {mode === "edit" && (
          <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-2 shrink-0 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Jump to
            </span>
            <button
              onClick={() => scrollTo(SECTION_IDS.inventory)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Inventory
            </button>
            {part?.partType !== "Assembly" && (
              <button
                onClick={() => scrollTo(SECTION_IDS.materialVendor)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Material
              </button>
            )}
            <button
              onClick={() => scrollTo(SECTION_IDS.routing)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Routing
            </button>
            <button
              onClick={() => scrollTo(SECTION_IDS.parents)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Parents
            </button>
            {part?.partType === "Assembly" && (
              <button
                onClick={() => scrollTo(SECTION_IDS.children)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Children
              </button>
            )}
            <button
              onClick={() => scrollTo(SECTION_IDS.auditLog)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Audit
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div ref={scrollAreaRef} className="flex-1 overflow-y-auto">

          {/* Description */}
          <section id={SECTION_IDS.description} className="border-b px-4 py-4">
            <SectionHeader>Description</SectionHeader>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this part — what it is, what it does."
              rows={3}
              className="resize-none"
            />
          </section>

          {/* Notes */}
          <section id={SECTION_IDS.notes} className="border-b px-4 py-4">
            <SectionHeader>Notes</SectionHeader>
            {notesOpen ? (
              <Textarea
                value={notes ?? ""}
                onChange={(e) => setNotes(e.target.value || null)}
                rows={3}
                autoFocus={notes === null || notes === ""}
                className="resize-none"
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setNotes(""); setNotesOpen(true); }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add note
              </Button>
            )}
          </section>

          {/* Inventory */}
          <section id={SECTION_IDS.inventory} className="border-b px-4 py-4">
            <SectionHeader>Inventory</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Stock Count">
                <Input
                  type="number"
                  value={stockCount}
                  onChange={(e) => setStockCount(Number(e.target.value))}
                  min={0}
                  className="w-full"
                />
              </FormField>
              <FormField label="Inventory Location">
                <Input
                  type="text"
                  value={inventoryLocation ?? ""}
                  onChange={(e) => setInventoryLocation(e.target.value || null)}
                  placeholder="e.g., A-12"
                />
              </FormField>
            </div>
          </section>

          {/* Material & Vendor (non-Assembly only) */}
          {effectivePartType !== "Assembly" && (
            <section id={SECTION_IDS.materialVendor} className="border-b px-4 py-4">
              <SectionHeader>Material &amp; Vendor</SectionHeader>
              <div className="grid grid-cols-2 gap-4">
                {/* Material tile */}
                <div className="flex flex-col gap-3">
                  <FormField label="Material Spec">
                    <ComboboxField
                      value={materialSpecId}
                      options={specOptions}
                      placeholder="Select material…"
                      onSelect={setMaterialSpecId}
                      onCreate={() => setAddMaterialSpecOpen(true)}
                      createLabel="Add new material spec…"
                    />
                  </FormField>
                  <FormField label="Stock Size">
                    <Input
                      value={stockSize ?? ""}
                      onChange={(e) => setStockSize(e.target.value || null)}
                      placeholder="e.g., 1.250 OD"
                    />
                  </FormField>
                  <FormField label="Length (inches)">
                    <Input
                      type="number"
                      value={blankLength ?? ""}
                      onChange={(e) =>
                        setBlankLength(e.target.value ? Number(e.target.value) : null)
                      }
                      min={0}
                      step={0.001}
                      placeholder="0.000"
                    />
                  </FormField>
                  <FormField label="Procurement Type">
                    <Select
                      value={part?.procurementCategoryName ?? ""}
                      disabled
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={part?.procurementCategoryName ?? ""}>
                          {part?.procurementCategoryName ?? "—"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>

                {/* Vendor tile */}
                <div className="flex flex-col gap-3">
                  <FormField label="Default Vendor">
                    <div title={selectedVendor?.notes ?? undefined}>
                      <ComboboxField
                        value={defaultVendorId}
                        options={vendorOptions}
                        placeholder="Select vendor…"
                        onSelect={setDefaultVendorId}
                        onCreate={() => setAddVendorOpen(true)}
                        createLabel="Add new vendor…"
                      />
                    </div>
                  </FormField>
                  <FormField label="Vendor Part Number">
                    <Input
                      value={vendorPartNumber ?? ""}
                      onChange={(e) => setVendorPartNumber(e.target.value || null)}
                      placeholder="e.g., ABC-12345"
                    />
                  </FormField>
                  <FormField label="Cost">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                      <Input
                        type="number"
                        value={partCost ?? ""}
                        onChange={(e) =>
                          setPartCost(e.target.value ? Number(e.target.value) : null)
                        }
                        min={0}
                        step={0.01}
                        className="pl-6"
                        placeholder="0.00"
                      />
                    </div>
                  </FormField>
                  <FormField label="Cost Updated">
                    <Input
                      value={
                        part?.partCostUpdatedAt
                          ? new Date(part.partCostUpdatedAt).toLocaleDateString()
                          : "—"
                      }
                      readOnly
                      className="bg-muted/40 text-muted-foreground cursor-default"
                    />
                  </FormField>
                </div>
              </div>
            </section>
          )}

          {/* Routing */}
          <section id={SECTION_IDS.routing} className="border-b px-4 py-4">
            <SectionHeader>Routing</SectionHeader>
            {currentTemplate ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-sm font-medium truncate">{currentTemplate.templateName}</span>
                    <div className="flex flex-wrap gap-1">
                      {currentTemplate.steps.map((s) => (
                        <ProcessTypeChip key={s.routingTemplateStepId} processType={s.processTypeName as ProcessTypeKey} />
                      ))}
                    </div>
                  </div>
                  <a
                    href={`/routing-templates/${currentTemplate.routingTemplateDefinitionId}`}
                    onClick={(e) => {
                      if (isDirty) {
                        e.preventDefault();
                        setPendingNavPartId(-1);
                        setUnsavedDialogOpen(true);
                      }
                    }}
                    className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View/Edit
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {!showRoutingPicker && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRoutingPicker(true)}
                  >
                    Change template
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground italic">No routing template assigned.</p>
                {!showRoutingPicker && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRoutingPicker(true)}
                  >
                    Assign template
                  </Button>
                )}
              </div>
            )}
            {showRoutingPicker && (
              <div className="mt-3 flex items-center gap-2">
                <Select
                  value={routingTemplateDefinitionId?.toString() ?? ""}
                  onValueChange={(v) => {
                    setRoutingTemplateDefinitionId(v ? Number(v) : null);
                    setShowRoutingPicker(false);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select template…" />
                  </SelectTrigger>
                  <SelectContent>
                    {compatibleTemplates.map((t) => (
                      <SelectItem
                        key={t.routingTemplateDefinitionId}
                        value={t.routingTemplateDefinitionId.toString()}
                      >
                        {t.templateName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRoutingPicker(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </section>

          {/* Parents — hidden in create mode */}
          {mode === "edit" && <section id={SECTION_IDS.parents} className="border-b px-4 py-4">
            <SectionHeader>Parents</SectionHeader>
            {bomParentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            ) : !bomParentsQuery.data || bomParentsQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Not used in any assemblies.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left pb-1.5 font-medium">Part #</th>
                      <th className="text-left pb-1.5 font-medium">Name</th>
                      <th className="text-right pb-1.5 font-medium">Qty Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomParentsQuery.data.map((row) => (
                      <tr
                        key={row.bomId}
                        onClick={() => requestNavigate(row.parentPartId)}
                        className="cursor-pointer hover:bg-muted/40 rounded"
                      >
                        <td className="font-mono text-xs py-1 pr-2 text-muted-foreground">
                          {row.partNumber}
                        </td>
                        <td className="py-1 pr-2 truncate max-w-[120px]">{row.partName}</td>
                        <td className="py-1 text-right tabular-nums text-muted-foreground">
                          {row.qtyUsed}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>}

          {/* Children (Assembly only) — in create mode shows "Define Assembly" placeholder */}
          {effectivePartType === "Assembly" && (
            <section id={SECTION_IDS.children} className="border-b px-4 py-4">
              <SectionHeader>Children</SectionHeader>
              {mode === "create" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground italic">
                    Save this part first, then define its assembly structure.
                  </p>
                </div>
              ) : bomChildrenQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </div>
              ) : !bomChildrenQuery.data || bomChildrenQuery.data.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground italic">No child parts defined.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={() => toast.info("BOM Editor coming in a future release.")}
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Define Assembly
                  </Button>
                </div>
              ) : (() => {
                const minBuildable = Math.min(
                  ...bomChildrenQuery.data.map((r) => r.buildableFromThis)
                );
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          <th className="text-left pb-1.5 font-medium">Part #</th>
                          <th className="text-left pb-1.5 font-medium">Name</th>
                          <th className="text-right pb-1.5 font-medium">Qty</th>
                          <th className="text-right pb-1.5 font-medium">Stock</th>
                          <th className="text-right pb-1.5 font-medium">Buildable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomChildrenQuery.data.map((row) => {
                          const isBottleneck = row.buildableFromThis === minBuildable;
                          return (
                            <tr
                              key={row.bomId}
                              onClick={() => requestNavigate(row.childPartId)}
                              className={cn(
                                "cursor-pointer hover:bg-muted/40",
                                isBottleneck &&
                                  "border-l-2 border-amber-400/60 pl-1"
                              )}
                            >
                              <td className="font-mono text-xs py-1 pr-2 text-muted-foreground">
                                {row.partNumber}
                              </td>
                              <td className="py-1 pr-2 truncate max-w-[100px]">{row.partName}</td>
                              <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
                                {row.quantity}
                              </td>
                              <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
                                {row.stockCount}
                              </td>
                              <td
                                className={cn(
                                  "py-1 text-right tabular-nums font-medium",
                                  isBottleneck && "text-amber-600 dark:text-amber-400"
                                )}
                              >
                                {row.buildableFromThis}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => toast.info("BOM Editor coming in a future release.")}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        Edit Assembly
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {/* Active WOs — hidden in create mode */}
          {mode === "edit" && <section id={SECTION_IDS.activeWos} className="border-b px-4 py-4">
            <SectionHeader>Active Work Orders</SectionHeader>
            {openWosQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            ) : !openWosQuery.data || openWosQuery.data.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No active work orders for this part.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left pb-1.5 font-medium">WO #</th>
                      <th className="text-left pb-1.5 font-medium">Project</th>
                      <th className="text-right pb-1.5 font-medium">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openWosQuery.data.map((wo) => (
                      <tr
                        key={wo.workOrderId}
                        title="WO detail view coming in a future release"
                        className="cursor-default hover:bg-muted/40"
                      >
                        <td className="font-mono text-xs py-1 pr-2 text-muted-foreground">
                          {wo.workOrderId}
                        </td>
                        <td className="py-1 pr-2 truncate max-w-[140px]">
                          <span className="text-xs">{wo.projectNumber}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {wo.projectName}
                          </span>
                        </td>
                        <td className="py-1 text-right tabular-nums text-muted-foreground">
                          {wo.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>}

          {/* Audit Log — hidden in create mode */}
          {mode === "edit" && <section id={SECTION_IDS.auditLog} className="border-b px-4 py-4">
            <button
              onClick={() => setAuditLogOpen((v) => !v)}
              className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground font-medium w-full text-left mb-0"
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform",
                  auditLogOpen && "rotate-90"
                )}
              />
              Audit Log
            </button>
            {auditLogOpen && (
              <div className="mt-3">
                {auditLogQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading…
                  </div>
                ) : !auditLogQuery.data || auditLogQuery.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No audit entries yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {auditLogQuery.data.map((entry) => (
                      <div
                        key={entry.auditLogId}
                        className="flex flex-col gap-0.5 text-xs border-l-2 border-border pl-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.actionName}</span>
                          <span className="text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <span className="text-muted-foreground">{entry.changedByUserName}</span>
                        {entry.note && (
                          <span className="text-muted-foreground italic">{entry.note}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>}

        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3 flex items-center justify-between shrink-0">
          {mode === "create" ? (
            <>
              <span className="text-xs text-muted-foreground">
                {createPartNumberConflict
                  ? "Part number conflict"
                  : !createPartNumber.trim() || !partName.trim()
                  ? "Fill required fields to save"
                  : "Ready to create"}
              </span>
              <Button size="sm" onClick={handleCreate} disabled={!createCanSave || isSaving}>
                {isSaving ? "Creating…" : "Create Part"}
              </Button>
            </>
          ) : (
            <>
              <span
                className={cn(
                  "text-xs",
                  isDirty ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}
              >
                {isDirty ? "Unsaved changes" : "No unsaved changes"}
              </span>
              <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
                {isSaving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddVendorModal
        open={addVendorOpen}
        onClose={() => setAddVendorOpen(false)}
        onCreated={(vendor) => {
          setDefaultVendorId(vendor.vendorId);
        }}
      />
      <AddMaterialSpecModal
        open={addMaterialSpecOpen}
        onClose={() => setAddMaterialSpecOpen(false)}
        onCreated={(spec) => {
          setMaterialSpecId(spec.materialSpecId);
        }}
        existingSpecs={specsQuery.data ?? []}
      />
      <DcfDialog
        open={dcfDialogOpen}
        partNumber={part?.partNumber ?? ""}
        parentCount={bomParentsQuery.data?.length ?? 0}
        openWoCount={openWosQuery.data?.length ?? 0}
        stockCount={part?.stockCount ?? 0}
        onCancel={() => setDcfDialogOpen(false)}
        onConfirm={async () => {
          setDcfDialogOpen(false);
          await commitSave();
        }}
      />
      <UnsavedChangesDialog
        open={unsavedDialogOpen}
        partNumber={part?.partNumber ?? ""}
        onCancel={() => {
          setUnsavedDialogOpen(false);
          setPendingNavPartId(null);
        }}
        onDiscard={handleUnsavedDiscard}
      />
    </>
  );
}
