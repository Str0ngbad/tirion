"use client";

// Generic Reconcile Stock modal — used by Stock Fulfillment, Parts Master, and Distribution Lens.
// Stateless: caller owns the data update. See prop contract below.

import { useState } from "react";
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
  partNumber: string;
  partName: string;
  currentStockCount: number;
  onClose: () => void;
  onConfirm: (newStockCount: number, reason: string) => void;
};

export default function ReconcileStockModal({
  partNumber,
  partName,
  currentStockCount,
  onClose,
  onConfirm,
}: Props) {
  const [newCountStr, setNewCountStr] = useState(String(currentStockCount));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ count?: string; reason?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: { count?: string; reason?: string } = {};

    const parsed = parseFloat(newCountStr.trim());
    if (
      newCountStr.trim() === "" ||
      isNaN(parsed) ||
      parsed < 0 ||
      !Number.isFinite(parsed)
    ) {
      errs.count = "Enter a valid non-negative number.";
    }
    if (!reason.trim()) {
      errs.reason = "Reason is required.";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onConfirm(Math.floor(parsed), reason.trim());
  }

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Reconcile Stock</DialogTitle>
          </DialogHeader>

          <div className="space-y-0.5">
            <div className="font-mono text-sm font-medium">{partNumber}</div>
            <div className="text-sm text-muted-foreground">{partName}</div>
          </div>

          <div className="flex items-center gap-3 rounded border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">Current Stock</span>
            <span className="font-mono font-semibold">{currentStockCount}</span>
          </div>

          <div>
            <Label
              htmlFor="reconcile-new-count"
              className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
            >
              New Stock Count{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Input
              id="reconcile-new-count"
              type="number"
              min={0}
              step={1}
              value={newCountStr}
              onChange={(e) => {
                setNewCountStr(e.target.value);
                setErrors((p) => ({ ...p, count: undefined }));
              }}
              className="h-8 w-28 text-sm"
              autoFocus
            />
            {errors.count && (
              <p className="mt-1 text-xs text-red-400">{errors.count}</p>
            )}
          </div>

          <div>
            <Label
              htmlFor="reconcile-reason"
              className="mb-1 text-xs uppercase tracking-wide text-muted-foreground"
            >
              Reason / Note{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Textarea
              id="reconcile-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((p) => ({ ...p, reason: undefined }));
              }}
              rows={2}
              placeholder="e.g., Physical count found 3 units on shelf A-12"
              className="text-sm"
            />
            {errors.reason && (
              <p className="mt-1 text-xs text-red-400">{errors.reason}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Confirm Reconciliation</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
