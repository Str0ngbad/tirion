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
import { DEPTH_SOFT, DEPTH_HARD } from "../_lib/validation";

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
            {DEPTH_SOFT} levels is the recommended depth limit for this interface. The change would
            put this BOM at {depth} levels, with a hard limit of {DEPTH_HARD}.
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
