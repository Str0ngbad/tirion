"use client";

import { useState } from "react";
import { MockVendor, MockAuditEntry } from "../_data";
import AuditLogSection from "./audit-log-section";
import ReferenceList from "./reference-list";

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
      <div className="py-3 border-b border-zinc-800 last:border-0">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
          {label}
          {opts.exploratory && (
            <span className="ml-0.5 font-normal normal-case tracking-normal text-zinc-700"> *</span>
          )}
        </div>
        {isEditing ? (
          <div className="flex items-start gap-2">
            {opts.multiline ? (
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                rows={3}
                className="flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            ) : (
              <input
                autoFocus
                type={field === "leadTimeDays" ? "number" : "text"}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(field);
                  if (e.key === "Escape") cancelEdit();
                }}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                placeholder={`Enter ${label.toLowerCase()}…`}
              />
            )}
            <button
              onClick={() => saveEdit(field)}
              className="rounded-md bg-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
            >
              Save
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-md px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div
            className={`group flex items-center gap-2 ${canEdit ? "cursor-pointer" : ""}`}
            onClick={() => { if (canEdit) startEdit(field); }}
          >
            <span className={`text-sm ${value ? "text-zinc-200" : "italic text-zinc-600"}`}>
              {value ?? "—"}
            </span>
            {canEdit && (
              <span className="hidden text-xs text-zinc-600 group-hover:inline">✎</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-[580px] flex-col overflow-hidden border-l border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Panel header */}
        <div className="flex items-start justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{vendor.vendorName}</h2>
            <div className="mt-1 flex items-center gap-2">
              {vendor.isActive ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-xs text-zinc-500">Active</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  <span className="text-xs text-zinc-500">Inactive — editing disabled</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md p-1.5 text-zinc-600 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Stat tiles */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-zinc-800 bg-zinc-800/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                Default Vendor For
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-zinc-100">
                {vendor.defaultVendorForCount}
              </div>
              <div className="text-xs text-zinc-600">active parts</div>
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-800/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-600">
                Open Supply Orders
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-zinc-100">
                {vendor.openSupplyOrderCount}
              </div>
              <div className="text-xs text-zinc-600">in progress</div>
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

          <p className="mt-4 text-xs text-zinc-700">
            * Exploratory fields — not in Rev 1 spec
          </p>
        </div>

        {/* Panel footer */}
        <div className="border-t border-zinc-800 px-6 py-4">
          {vendor.isActive ? (
            <button
              onClick={() => onDeactivate(vendor)}
              className="rounded-md border border-red-900/50 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:border-red-700/60 hover:bg-red-950/30"
            >
              Deactivate Vendor
            </button>
          ) : (
            <span className="text-xs text-zinc-600">
              Vendor is inactive. To reactivate, use the API directly (reactivation flow not in this mockup).
            </span>
          )}
        </div>
      </div>
    </>
  );
}
