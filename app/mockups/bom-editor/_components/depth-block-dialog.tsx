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
import { DEPTH_HARD } from "../_lib/validation";

type Props = {
  open: boolean;
  depth: number;
  onClose: () => void;
};

export default function DepthBlockDialog({ open, depth, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>This would create a {depth}-level deep BOM</DialogTitle>
          <DialogDescription>
            Depth is capped at {DEPTH_HARD} levels. Restructure the BOM or reduce nesting to add
            this child.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
