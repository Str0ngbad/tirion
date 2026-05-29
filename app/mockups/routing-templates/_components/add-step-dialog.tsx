"use client";

import { useState } from "react";
import { ProcessTypeKey, ALL_PROCESS_TYPES } from "@/app/mockups/users/_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (processType: ProcessTypeKey) => void;
};

export default function AddStepDialog({ open, onOpenChange, onAdd }: Props) {
  const [selected, setSelected] = useState<ProcessTypeKey | null>(null);

  function handleConfirm() {
    if (!selected) return;
    onAdd(selected);
    setSelected(null);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) setSelected(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Add Step</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-0.5">
          {ALL_PROCESS_TYPES.map((pt) => (
            <button
              key={pt}
              type="button"
              onClick={() => setSelected(pt)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent ${
                selected === pt ? "bg-accent" : ""
              }`}
            >
              <ProcessTypeChip processType={pt} />
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected}>
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
