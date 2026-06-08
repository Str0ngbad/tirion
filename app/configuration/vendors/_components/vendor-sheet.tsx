'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import { ReferenceList } from '@/components/configuration/reference-list';
import { DeactivationDialog } from '@/components/configuration/deactivation-dialog';
import {
  useVendor,
  useVendorAuditLog,
  useUpdateVendor,
  useDeactivateVendor,
  useReactivateVendor,
} from '@/lib/api/vendors';

interface VendorSheetProps {
  vendorId: number;
  onClose: () => void;
}

export function VendorSheet({ vendorId, onClose }: VendorSheetProps) {
  const { data: vendor, isLoading } = useVendor(vendorId);
  const { data: auditEntries, isLoading: auditLoading } = useVendorAuditLog(vendorId, true);

  const { mutate: update, isPending: isSaving } = useUpdateVendor();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateVendor();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateVendor();

  const [vendorName, setVendorName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [notes, setNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [deactivateDialog, setDeactivateDialog] = useState<
    | { variant: 'standard' }
    | { variant: 'blocked-by-references'; blockingReferences: Array<{ id: number; primary: string; secondary: string; link: string }> }
    | null
  >(null);

  useEffect(() => {
    if (vendor) {
      setVendorName(vendor.vendorName);
      setContactInfo(vendor.contactInfo ?? '');
      setLocation(vendor.location ?? '');
      setWebsite(vendor.website ?? '');
      setLeadTimeDays(vendor.leadTimeDays !== null ? String(vendor.leadTimeDays) : '');
      setNotes(vendor.notes ?? '');
      setIsDirty(false);
    }
  }, [vendor]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleSave() {
    if (!vendor) return;
    const days = leadTimeDays.trim() === '' ? null : parseInt(leadTimeDays, 10);
    update(
      {
        id: vendorId,
        input: {
          vendorName: vendorName.trim(),
          contactInfo: contactInfo.trim() || null,
          location: location.trim() || null,
          website: website.trim() || null,
          leadTimeDays: days !== null && !isNaN(days) ? days : null,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: () => setIsDirty(false),
      }
    );
  }

  function handleDeactivateClick() {
    if (!vendor) return;
    if (vendor.defaultVendorForCount > 0) {
      setDeactivateDialog({
        variant: 'blocked-by-references',
        blockingReferences: vendor.parts.map((p) => ({
          id: p.partId,
          primary: p.partNumber,
          secondary: p.partName,
          link: `/parts?partId=${p.partId}`,
        })),
      });
    } else {
      setDeactivateDialog({ variant: 'standard' });
    }
  }

  function handleDeactivateConfirm() {
    deactivate(vendorId, {
      onSuccess: () => setDeactivateDialog(null),
    });
  }

  function handleReactivate() {
    reactivate(vendorId);
  }

  if (isLoading || !vendor) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <span className="font-medium text-sm truncate">{vendor.vendorName}</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Identity section */}
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <div>
            <Label className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={vendorName}
              onChange={(e) => { setVendorName(e.target.value); markDirty(); }}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`active-${vendorId}`} checked={vendor.isActive} disabled />
            <label htmlFor={`active-${vendorId}`} className="text-xs text-muted-foreground">
              {vendor.isActive ? 'Active' : 'Inactive'}
            </label>
          </div>
        </section>

        {/* Contact Info section */}
        <section className="border-b px-4 py-4 flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Contact Info
          </p>
          <div>
            <Label className="text-xs">Contact</Label>
            <Input
              value={contactInfo}
              onChange={(e) => { setContactInfo(e.target.value); markDirty(); }}
              placeholder="Name, phone, email…"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input
              value={location}
              onChange={(e) => { setLocation(e.target.value); markDirty(); }}
              placeholder="City, State or full address"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input
              value={website}
              onChange={(e) => { setWebsite(e.target.value); markDirty(); }}
              placeholder="https://…"
              className="mt-1"
            />
          </div>
          <div className="w-36">
            <Label className="text-xs">Lead Time (days)</Label>
            <Input
              type="number"
              min={0}
              value={leadTimeDays}
              onChange={(e) => { setLeadTimeDays(e.target.value); markDirty(); }}
              placeholder="—"
              className="mt-1"
            />
          </div>
        </section>

        {/* Notes */}
        <section className="border-b px-4 py-4">
          <Label className="text-xs">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); markDirty(); }}
            rows={3}
            className="mt-1 resize-none"
            placeholder="Optional notes"
          />
        </section>

        {/* Default Vendor For */}
        <section className="border-b px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Default Vendor For ({vendor.defaultVendorForCount} active{' '}
            {vendor.defaultVendorForCount === 1 ? 'part' : 'parts'})
          </p>
          <ReferenceList
            items={vendor.parts.map((p) => ({
              id: p.partId,
              primary: p.partNumber,
              secondary: p.partName,
              link: `/parts?partId=${p.partId}`,
            }))}
            emptyMessage="No active parts use this as their default vendor."
          />
        </section>

        {/* Open Supply Orders */}
        <section className="border-b px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
            Open Supply Orders
          </p>
          <p className="text-sm text-muted-foreground">
            {vendor.openSupplyOrderCount === 0
              ? 'None — no open supply orders for this vendor.'
              : `${vendor.openSupplyOrderCount} open supply ${vendor.openSupplyOrderCount === 1 ? 'order' : 'orders'}`}
          </p>
        </section>

        {/* Audit Log */}
        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3 shrink-0 gap-2">
        {vendor.isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeactivateClick}
            disabled={isSaving || isDeactivating}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReactivate}
            disabled={isReactivating}
          >
            {isReactivating ? 'Activating…' : 'Activate'}
          </Button>
        )}

        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {deactivateDialog?.variant === 'standard' && (
        <DeactivationDialog
          variant="standard"
          open
          entityName={vendor.vendorName}
          entityType="vendor"
          onCancel={() => setDeactivateDialog(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}

      {deactivateDialog?.variant === 'blocked-by-references' && (
        <DeactivationDialog
          variant="blocked-by-references"
          open
          entityName={vendor.vendorName}
          entityType="vendor"
          blockingReferences={deactivateDialog.blockingReferences}
          onCancel={() => setDeactivateDialog(null)}
        />
      )}
    </div>
  );
}
