"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateBomQuantity, useRemoveBomChild } from "@/lib/api/bom";

interface QtyEditCellProps {
  bomId: number;
  parentPartId: number;
  parentPartNumber: string;
  childPartNumber: string;
  currentQty: number;
}

export function QtyEditCell({
  bomId,
  parentPartId,
  parentPartNumber,
  childPartNumber,
  currentQty,
}: QtyEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(currentQty));
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateMutation = useUpdateBomQuantity();
  const deleteMutation = useRemoveBomChild();

  const startEditing = () => {
    setInputValue(String(currentQty));
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const stopEditing = () => {
    setEditing(false);
    setError(null);
  };

  const commit = () => {
    const trimmed = inputValue.trim();

    if (!trimmed) { stopEditing(); return; }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) { stopEditing(); return; }

    const parsed = Math.trunc(numeric);

    if (parsed < 0) {
      setError("Quantity must be a positive integer.");
      return;
    }

    if (parsed === currentQty) { stopEditing(); return; }

    if (parsed === 0) {
      setRemoveDialogOpen(true);
      return;
    }

    updateMutation.mutate(
      { bomId, parentPartId, quantity: parsed },
      {
        onSuccess: () => stopEditing(),
        onError: () => {
          toast.error("Failed to update quantity");
          stopEditing();
        },
      }
    );
  };

  const confirmRemove = () => {
    deleteMutation.mutate(
      { bomId, parentPartId },
      {
        onSuccess: () => {
          setRemoveDialogOpen(false);
          stopEditing();
        },
        onError: () => {
          toast.error("Failed to remove child");
          setRemoveDialogOpen(false);
          stopEditing();
        },
      }
    );
  };

  const cancelRemove = () => {
    setRemoveDialogOpen(false);
    stopEditing();
  };

  if (!editing) {
    return (
      <button
        onClick={startEditing}
        className="w-16 shrink-0 text-right tabular-nums px-2 text-sm hover:bg-muted/50 cursor-pointer rounded-sm"
      >
        {currentQty}
      </button>
    );
  }

  return (
    <>
      <div className="w-16 shrink-0 px-2 relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); stopEditing(); }
          }}
          onBlur={() => {
            if (!removeDialogOpen) commit();
          }}
          className="h-7 w-full text-right tabular-nums text-sm px-1"
        />
        {error && (
          <div className="absolute top-full left-0 mt-1 text-xs text-destructive whitespace-nowrap z-10 bg-background border border-destructive rounded px-2 py-1 shadow-sm">
            {error}
          </div>
        )}
      </div>

      <Dialog open={removeDialogOpen} onOpenChange={(open) => !open && cancelRemove()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {childPartNumber} from {parentPartNumber}?
            </DialogTitle>
            <DialogDescription>
              Setting quantity to 0 removes this child from the BOM. The relationship
              can be re-added later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelRemove}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={deleteMutation.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
