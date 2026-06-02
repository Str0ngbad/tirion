"use client";

import { useRouter } from "next/navigation";
import { MOCK_PARTS } from "@/app/mockups/parts/_data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  chain: number[]; // [parentId, candidateId, …, parentId]
  onClose: () => void;
  buttonLabel?: "OK" | "Cancel";
};

function partLabel(partId: number): { partNumber: string; partName: string } {
  const p = MOCK_PARTS.find((x) => x.partId === partId);
  return { partNumber: p?.partNumber ?? String(partId), partName: p?.partName ?? "Unknown" };
}

export default function CycleErrorDialog({ open, chain, onClose, buttonLabel = "Cancel" }: Props) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cannot add this part — would create a circular relationship</DialogTitle>
          <DialogDescription>
            The following chain already exists in the BOM:
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 space-y-0.5 rounded border border-border bg-muted/40 p-3 font-mono text-xs">
          {chain.map((partId, i) => {
            const { partNumber, partName } = partLabel(partId);
            const isLast = i === chain.length - 1;
            const indent = "  ".repeat(i);
            return (
              <div key={i} className="flex items-start gap-1">
                <span className="whitespace-pre text-muted-foreground">{indent}</span>
                {i > 0 && (
                  <span className="mr-1 text-muted-foreground">{i === 1 ? "└" : " └"}</span>
                )}
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/mockups/bom-editor/${partId}`);
                  }}
                  className="text-primary hover:underline"
                >
                  {partNumber}
                </button>
                <span className="ml-1 text-muted-foreground">{partName}</span>
                {isLast && (
                  <span className="ml-2 text-destructive font-semibold">← would create the cycle</span>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant={buttonLabel === "OK" ? "default" : "outline"} onClick={onClose}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
