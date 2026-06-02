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
          <DialogTitle>Depth limit reached</DialogTitle>
          <DialogDescription>
            The depth limit for this interface is {DEPTH_HARD} layers. This change would create{" "}
            {depth}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
