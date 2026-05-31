"use client";

import { useState } from "react";
import { MockMinimalVendor } from "../_data";
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

type Props = {
  existingVendors: MockMinimalVendor[];
  onClose: () => void;
  onSelect: (vendor: MockMinimalVendor) => void;
};

export default function AddVendorModal({ existingVendors, onClose, onSelect }: Props) {
  const [name, setName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [leadTime, setLeadTime] = useState("");
  const [notes, setNotes] = useState("");

  const nameTrimmed = name.trim();

  const isDuplicate =
    nameTrimmed !== "" &&
    existingVendors.some(
      (v) => v.vendorName.toLowerCase() === nameTrimmed.toLowerCase()
    );

  const canCreate = nameTrimmed !== "" && !isDuplicate;

  function handleCreate() {
    if (!canCreate) return;
    const newId = Math.max(0, ...existingVendors.map((v) => v.vendorId)) + 1;
    const newVendor: MockMinimalVendor = {
      vendorId: newId,
      vendorName: nameTrimmed,
    };
    // contactInfo, leadTime, notes are mockup-only — MockMinimalVendor doesn't store them
    void contactInfo;
    void leadTime;
    void notes;
    onSelect(newVendor);
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vendor Name */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendor Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Steel"
              className="h-9 text-sm"
            />
            {isDuplicate && (
              <p className="mt-1.5 text-xs text-destructive">
                A vendor with this name already exists.
              </p>
            )}
          </div>

          {/* Contact Info */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact Info
            </Label>
            <Input
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="e.g. John Smith — john@vendor.com"
              className="h-9 text-sm"
            />
          </div>

          {/* Lead Time */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Lead Time
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                placeholder="0"
                min={0}
                className="h-9 w-24 text-sm"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            Create Vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
