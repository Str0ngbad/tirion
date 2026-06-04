"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ProcessTypeChip from "@/components/process-type-chip";
import { ALL_PROCESS_TYPES, type ProcessTypeKey } from "@/lib/process-types";

interface AddStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (processType: ProcessTypeKey) => void;
}

export function AddStepDialog({ open, onOpenChange, onAdd }: AddStepDialogProps) {
  const [selected, setSelected] = useState<ProcessTypeKey | null>(null);

  function handleAdd() {
    if (!selected) return;
    onAdd(selected);
    setSelected(null);
    onOpenChange(false);
  }

  function handleOpenChange(value: boolean) {
    if (!value) setSelected(null);
    onOpenChange(value);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Add Step</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {ALL_PROCESS_TYPES.map((pt) => (
            <button
              key={pt}
              onClick={() => setSelected(pt)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent ${
                selected === pt ? "bg-accent" : ""
              }`}
            >
              <ProcessTypeChip processType={pt} compact={false} />
            </button>
          ))}
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selected}>
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
