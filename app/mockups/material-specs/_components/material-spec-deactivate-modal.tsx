import { MockMaterialSpec } from "../_data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  spec: MockMaterialSpec;
  onClose: () => void;
  onConfirm: () => void;
};

export default function MaterialSpecDeactivateModal({ spec, onClose, onConfirm }: Props) {
  const hasBlockers = spec.referencingParts.length > 0;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Deactivate MaterialSpec</DialogTitle>
          <DialogDescription>
            {spec.materialName} · {spec.form}
          </DialogDescription>
        </DialogHeader>

        <div>
          {hasBlockers ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                This material spec cannot be deactivated while active parts reference it.
                Reassign or deactivate the following parts first:
              </p>
              <ul className="max-h-52 space-y-1.5 overflow-y-auto">
                {spec.referencingParts.map((part) => (
                  <li
                    key={part.partId}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-card/40 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {part.partNumber}
                    </span>
                    <span className="text-sm text-foreground">{part.partName}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-foreground">
              No blocking references. MaterialSpec can be deactivated.
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {hasBlockers ? (
            <p className="text-xs text-muted-foreground">
              {spec.referencingParts.length} part
              {spec.referencingParts.length !== 1 ? "s" : ""} must be resolved first.
            </p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={hasBlockers}
              onClick={hasBlockers ? undefined : onConfirm}
            >
              Deactivate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
