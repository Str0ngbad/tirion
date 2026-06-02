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
import { DEPTH_SOFT } from "../_lib/validation";

type Props = {
  open: boolean;
  depth: number;
  parentPartNumber: string;
  childPartNumber: string;
  onCancel: () => void;
  onContinue: () => void;
};

export default function DepthWarningDialog({
  open,
  depth,
  parentPartNumber,
  childPartNumber,
  onCancel,
  onContinue,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>This will create a {depth}-level deep BOM</DialogTitle>
          <DialogDescription>
            Adding {childPartNumber} to {parentPartNumber} would create a BOM up to {depth} levels
            deep. This exceeds the {DEPTH_SOFT}-level soft threshold. Confirm this is intentional.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onContinue}>Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
