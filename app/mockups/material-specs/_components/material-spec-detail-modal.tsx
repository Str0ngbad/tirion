"use client";

import { MockMaterialSpec } from "../_data";
import MaterialSpecAuditLogSection from "./material-spec-audit-log-section";
import MaterialSpecReferenceList from "./material-spec-reference-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  spec: MockMaterialSpec;
  onClose: () => void;
  onEdit: (spec: MockMaterialSpec) => void;
  onDeactivate: (spec: MockMaterialSpec) => void;
};

export default function MaterialSpecDetailModal({
  spec,
  onClose,
  onEdit,
  onDeactivate,
}: Props) {
  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-[580px] sm:!max-w-[580px] gap-0 p-0 flex flex-col overflow-hidden"
      >
        {/* Panel header */}
        <SheetHeader className="border-b border-border px-6 py-4 gap-1.5">
          <SheetTitle className="text-base font-semibold">
            {spec.materialName} · {spec.form}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            {spec.isActive ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                Active
              </>
            ) : (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                Inactive
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Stat tiles */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Used By
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {spec.usedByCount}
              </div>
              <div className="text-xs text-muted-foreground">active parts</div>
            </div>
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Open Supply Orders
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {spec.openSupplyOrderCount}
              </div>
              <div className="text-xs text-muted-foreground">in progress</div>
            </div>
            <div className="rounded-md border border-border bg-card/40 px-3 py-2.5">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active Work
              </div>
              <div className="mt-0.5 text-2xl font-semibold text-foreground">
                {spec.activeWoCount}
              </div>
              <div className="text-xs text-muted-foreground">
                total · {spec.awaitingReceiptWoCount} awaiting receipt ·{" "}
                {spec.awaitingPurchaseWoCount} awaiting purchase
              </div>
              <button
                onClick={() =>
                  console.log(
                    "Navigate to Operations Lens filtered by materialSpecId:",
                    spec.materialSpecId
                  )
                }
                className="mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View in Operations Lens →
              </button>
            </div>
          </div>

          {/* Read-only fields */}
          <div className="mb-2">
            <div className="py-3 border-b border-border">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Material Name
              </div>
              <span className="text-sm text-foreground">{spec.materialName}</span>
            </div>
            <div className="py-3 border-b border-border last:border-0">
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Form
              </div>
              <span className="text-sm text-foreground">{spec.form}</span>
            </div>
          </div>

          {/* Reference list */}
          <div className="mb-2">
            <MaterialSpecReferenceList
              parts={spec.referencingParts}
              usedByCount={spec.usedByCount}
              materialSpecId={spec.materialSpecId}
            />
          </div>

          {/* Audit log */}
          <MaterialSpecAuditLogSection auditLog={spec.auditLog} />
        </div>

        {/* Panel footer */}
        <div className="border-t border-border px-6 py-4 flex items-center gap-3">
          {spec.isActive ? (
            <>
              <Button variant="default" onClick={() => onEdit(spec)}>
                Edit MaterialSpec
              </Button>
              <Button variant="destructive" onClick={() => onDeactivate(spec)}>
                Deactivate MaterialSpec
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              MaterialSpec is inactive. To reactivate, use the API directly (reactivation flow not
              in this mockup).
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
