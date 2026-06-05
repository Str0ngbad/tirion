"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  columnLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function HideColumnFilterDialog({ open, columnLabel, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hide {columnLabel}?</DialogTitle>
          <DialogDescription>
            This column has an active filter. Hiding will leave the filter active but the only way
            to remove it will be via the Active Filters bar above the grid.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Hide and keep filter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
