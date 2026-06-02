"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ChildItem = {
  partId: number;
  partNumber: string;
  partName: string;
  qty: number;
};

type Props = {
  open: boolean;
  parentPartNumber: string;
  items: ChildItem[];
  onCancel: () => void;
  onConfirm: () => void;
};

export default function RemoveChildrenConfirmDialog({
  open,
  parentPartNumber,
  items,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Remove {items.length} item{items.length !== 1 ? "s" : ""} from {parentPartNumber}?
          </DialogTitle>
          <DialogDescription>
            The following components will be removed from the BOM:
          </DialogDescription>
        </DialogHeader>

        <ul className="my-1 space-y-1 rounded border border-border bg-muted/40 p-2 text-xs">
          {items.map((item) => (
            <li key={item.partId} className="font-mono">
              <span className="font-semibold">{item.partNumber}</span>{" "}
              <span className="text-muted-foreground">{item.partName}</span>{" "}
              <span className="text-muted-foreground">(qty: {item.qty})</span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Remove {items.length} item{items.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
