"use client";

import { useState } from "react";
import { MockVendor } from "../_data";

type Props = {
  existingVendorNames: string[];
  maxVendorId: number;
  onClose: () => void;
  onCreate: (vendor: MockVendor) => void;
};

export default function VendorCreateModal({
  existingVendorNames,
  maxVendorId,
  onClose,
  onCreate,
}: Props) {
  const [vendorName, setVendorName]     = useState("");
  const [contactInfo, setContactInfo]   = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [notes, setNotes]               = useState("");
  const [website, setWebsite]           = useState("");
  const [location, setLocation]         = useState("");
  const [nameError, setNameError]       = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = vendorName.trim();
    if (!trimmedName) {
      setNameError("Vendor name is required.");
      return;
    }

    const duplicate = existingVendorNames.some(
      (n) => n.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setNameError("A vendor with this name already exists.");
      return;
    }

    const parsedLead = leadTimeDays.trim() ? parseInt(leadTimeDays.trim(), 10) : null;

    const newVendor: MockVendor = {
      vendorId: maxVendorId + 1,
      vendorName: trimmedName,
      contactInfo: contactInfo.trim() || null,
      leadTimeDays: parsedLead !== null && !isNaN(parsedLead) ? parsedLead : null,
      notes: notes.trim() || null,
      isActive: true,
      defaultVendorForCount: 0,
      openSupplyOrderCount: 0,
      activeWoCount: 0,
      awaitingReceiptWoCount: 0,
      awaitingPurchaseWoCount: 0,
      website: website.trim() || null,
      location: location.trim() || null,
      referencingParts: [],
      auditLog: [
        {
          timestamp: new Date().toISOString(),
          userName: "Jane Chen",
          action: "VendorCreated",
        },
      ],
    };

    onCreate(newVendor);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-lg border border-border bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">Add New Vendor</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-4">
              {/* Vendor Name — required */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vendor Name{" "}
                  <span className="font-normal normal-case tracking-normal text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => { setVendorName(e.target.value); setNameError(null); }}
                  className={`w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 ${
                    nameError
                      ? "border-red-700 focus:border-red-600 focus:ring-red-900"
                      : "border-border focus:border-ring focus:ring-ring/50"
                  }`}
                  placeholder="e.g., Acme Supply Co."
                />
                {nameError && (
                  <p className="mt-1 text-xs text-red-400">{nameError}</p>
                )}
              </div>

              {/* Contact Info */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact Info
                </label>
                <input
                  type="text"
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="Name, phone, email, or URL"
                />
              </div>

              {/* Lead Time */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="e.g., 14"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50"
                  placeholder="Ordering notes, contacts, caveats…"
                />
              </div>

              {/* Exploratory fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Website{" "}
                    <span className="font-normal normal-case tracking-normal text-muted-foreground/40">*</span>
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
                    placeholder="vendor.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Location{" "}
                    <span className="font-normal normal-case tracking-normal text-muted-foreground/40">*</span>
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none"
                    placeholder="City, ST"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground/50">* Exploratory — not in Rev 1 spec</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors"
              >
                Create Vendor
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
