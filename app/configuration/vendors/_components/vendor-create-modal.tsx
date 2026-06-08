'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateVendor } from '@/lib/api/vendors';
import { ApiError } from '@/lib/api/client-error';

interface VendorCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (newId: number) => void;
}

export function VendorCreateModal({ open, onClose, onCreated }: VendorCreateModalProps) {
  const [vendorName, setVendorName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { mutate: create, isPending } = useCreateVendor();

  function reset() {
    setVendorName('');
    setContactInfo('');
    setLocation('');
    setWebsite('');
    setLeadTimeDays('');
    setFieldErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    const errors: Record<string, string> = {};
    if (!vendorName.trim()) errors.vendorName = 'Name is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const days = leadTimeDays.trim() === '' ? null : parseInt(leadTimeDays, 10);

    create(
      {
        vendorName: vendorName.trim(),
        contactInfo: contactInfo.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
        leadTimeDays: days !== null && !isNaN(days) ? days : null,
      },
      {
        onSuccess: (created) => {
          reset();
          onCreated(created.vendorId);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.errorCode === 'VENDOR_NAME_COLLISION') {
            setFieldErrors({ vendorName: 'A vendor with this name already exists' });
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div>
            <Label htmlFor="vendorName" className="text-xs">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vendorName"
              value={vendorName}
              onChange={(e) => {
                setVendorName(e.target.value);
                setFieldErrors((p) => ({ ...p, vendorName: '' }));
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Acme Supply Co."
              className="mt-1"
            />
            {fieldErrors.vendorName && (
              <p className="mt-1 text-xs text-destructive">{fieldErrors.vendorName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="contactInfo" className="text-xs">
              Contact
            </Label>
            <Input
              id="contactInfo"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Name, phone, email…"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="location" className="text-xs">
              Location
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="City, State"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="website" className="text-xs">
              Website
            </Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="https://…"
              className="mt-1"
            />
          </div>

          <div className="w-36">
            <Label htmlFor="leadTimeDays" className="text-xs">
              Lead Time (days)
            </Label>
            <Input
              id="leadTimeDays"
              type="number"
              min={0}
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="—"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
