"use client";

import { useState } from "react";
import { MockVendor, MockAuditEntry } from "../_data";
import AuditLogSection from "./audit-log-section";
import ReferenceList from "./reference-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type EditableField = "contactInfo" | "leadTimeDays" | "notes" | "website" | "location";

type Props = {
  vendor: MockVendor;
  onClose: () => void;
  onUpdate: (updated: MockVendor) => void;
  onDeactivate: (vendor: MockVendor) => void;
};

function currentValueFor(vendor: MockVendor, field: EditableField): string | null {
  switch (field) {
    case "contactInfo":  return vendor.contactInfo;
    case "leadTimeDays": return vendor.leadTimeDays?.toString() ?? null;
    case "notes":        return vendor.notes;
    case "website":      return vendor.website;
    case "location":     return vendor.location;
  }
}

export default function VendorDetailModal({ vendor, onClose, onUpdate, onDeactivate }: Props) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [editValue, setEditValue] = useState("");

  function startEdit(field: EditableField) {
    setEditValue(currentValueFor(vendor, field) ?? "");
    setEditingField(field);
  }

  function cancelEdit() {
    setEditingField(null);
  }

  function saveEdit(field: EditableField) {
    const trimmed = editValue.trim();
    const changedFields: NonNullable<MockAuditEntry["changedFields"]> = [];
    let updated = { ...vendor };

    switch (field) {
      case "contactInfo": {
        const after = trimmed || null;
        if (vendor.contactInfo !== after) {
          changedFields.push({ field: "contactInfo", before: vendor.contactInfo, after });
          updated = { ...updated, contactInfo: after };
        }
        break;
      }
      case "leadTimeDays": {
        const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
        const after = parsed !== null && !isNaN(parsed) ? parsed : null;
        if (vendor.leadTimeDays !== after) {
          changedFields.push({
            field: "leadTimeDays",
            before: vendor.leadTimeDays?.toString() ?? null,
            after: after?.toString() ?? null,
          });
          updated = { ...updated, leadTimeDays: after };
        }
        break;
      }
      case "notes": {
        const after = trimmed || null;
        if (vendor.notes !== after) {
          changedFields.push({ field: "notes", before: vendor.notes, after });
          updated = { ...updated, notes: after };
        }
        break;
      }
      case "website": {
        const after = trimmed || null;
        if (vendor.website !== after) {
          changedFields.push({ field: "website", before: vendor.website, after });
          updated = { ...updated, website: after };
        }
        break;
      }
      case "location": {
        const after = trimmed || null;
        if (vendor.location !== after) {
          changedFields.push({ field: "location", before: vendor.location, after });
          updated = { ...updated, location: after };
        }
        break;
      }
      default: {
        const _never: never = field;
        void _never;
      }
    }

    if (changedFields.length > 0) {
      const entry: MockAuditEntry = {
        timestamp: new Date().toISOString(),
        userName: "Jane Chen",
        action: "VendorUpdated",
        changedFields,
      };
      updated = { ...updated, auditLog: [entry, ...vendor.auditLog] };
    }

    onUpdate(updated);
    setEditingField(null);
  }

  function renderField(
    label: string,
    field: EditableField,
    opts: { multiline?: boolean; exploratory?: boolean } = {}
  ) {
    const isEditing = editingField === field;
    const value = currentValueFor(vendor, field);
    const canEdit = vendor.isActive;

    return (
      <div className="py-3 border-b border-border last:border-0">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          {opts.exploratory && (
            <span className="ml-0.5 font-normal normal-case tracking-normal text-muted-foreground/40"> *</span>
          )}
        </div>
        {isEditing ? (
          <div className="flex items-start gap-2">
            {opts.multiline ? (
              <Textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                rows={3}
                className="flex-1"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            ) : (
              <Input
                autoFocus
                type={field === "leadTimeDays" ? "number" : "text"}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(field);
                  if (e.key === "Escape") cancelEdit();
                }}
                className="flex-1"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            )}
            <Button size="sm" variant="outline" onClick={() => saveEdit(field)}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        ) : (
          <div
            className={`group flex items-center gap-2 ${canEdit ? "cursor-pointer" : ""}`}
            onClick={() => { if (canEdit) startEdit(field); }}
          >
            <span className={`text-sm ${value ? "text-foreground" : "italic text-muted-foreground"}`}>
              {value ?? "—"}
            </span>
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
          <SheetTitle className="text-base font-semibold">{vendor.vendorName}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {vendor.isActive ? (
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
                Default Vendor For
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {vendor.defaultVendorForCount}
              </div>
              <div className="text-xs text-muted-foreground">active parts</div>
            </div>
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open Supply Orders
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {vendor.openSupplyOrderCount}
              </div>
              <div className="text-xs text-muted-foreground">in progress</div>
            </div>
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active Work
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {vendor.activeWoCount}
              </div>
              <div className="text-xs text-muted-foreground">
                total · {vendor.awaitingReceiptWoCount} awaiting receipt · {vendor.awaitingPurchaseWoCount} awaiting purchase
              </div>
              <button
                onClick={() => console.log('Navigate to Operations Lens filtered by vendorId:', vendor.vendorId)}
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View in Operations Lens →
              </button>
            </div>
          </div>

          {/* Editable fields */}
          <div className="mb-2">
            {renderField("Contact Info", "contactInfo")}
            {renderField("Lead Time (Days)", "leadTimeDays")}
            {renderField("Notes", "notes", { multiline: true })}
            {renderField("Website", "website", { exploratory: true })}
            {renderField("Location", "location", { exploratory: true })}
          </div>

          {/* Reference list */}
          <div className="mb-2">
            <ReferenceList parts={vendor.referencingParts} />
          </div>

          {/* Audit log */}
          <AuditLogSection auditLog={vendor.auditLog} />

          <p className="mt-4 text-xs text-muted-foreground/50">
            * Exploratory fields — not in Rev 1 spec
          </p>
        </div>

        {/* Panel footer */}
        <div className="border-t border-border px-6 py-4">
          {vendor.isActive ? (
            <Button variant="destructive" onClick={() => onDeactivate(vendor)}>
              Deactivate Vendor
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Vendor is inactive. To reactivate, use the API directly (reactivation flow not in this mockup).
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
