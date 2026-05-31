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
  viewName: string;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ViewSaveConfirmation({ viewName, open, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Overwrite "{viewName}"?</DialogTitle>
          <DialogDescription>
            This will replace the saved columns, sort, and filters with your current view state.
            Other users will see this change next time they load this view.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Overwrite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
