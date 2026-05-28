"use client";

import { useState } from "react";
import { MockVendor } from "../_data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg" showCloseButton={true}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Vendor Name — required */}
            <div>
              <Label
                htmlFor="vendor-name"
                className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
              >
                Vendor Name{" "}
                <span className="font-normal normal-case tracking-normal text-red-500">*</span>
              </Label>
              <Input
                id="vendor-name"
                type="text"
                value={vendorName}
                onChange={(e) => { setVendorName(e.target.value); setNameError(null); }}
                aria-invalid={!!nameError}
                placeholder="e.g., Acme Supply Co."
              />
              {nameError && (
                <p className="mt-1 text-xs text-red-400">{nameError}</p>
              )}
            </div>

            {/* Contact Info */}
            <div>
              <Label
                htmlFor="contact-info"
                className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
              >
                Contact Info
              </Label>
              <Input
                id="contact-info"
                type="text"
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="Name, phone, email, or URL"
              />
            </div>

            {/* Lead Time */}
            <div>
              <Label
                htmlFor="lead-time"
                className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
              >
                Lead Time (Days)
              </Label>
              <Input
                id="lead-time"
                type="number"
                min={0}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                placeholder="e.g., 14"
              />
            </div>

            {/* Notes */}
            <div>
              <Label
                htmlFor="notes"
                className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
              >
                Notes
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Ordering notes, contacts, caveats…"
              />
            </div>

            {/* Exploratory fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="website"
                  className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Website
                </Label>
                <Input
                  id="website"
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="vendor.com"
                />
              </div>
              <div>
                <Label
                  htmlFor="location"
                  className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
                >
                  Location
                </Label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, ST"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
