"use client";

import { MockSubStatus } from "../_data";
import ProcessTypeChip from "@/app/mockups/users/_components/process-type-chip";
import SubStatusAuditLogSection from "./sub-status-audit-log-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  subStatus: MockSubStatus;
  onClose: () => void;
  onEdit: (subStatus: MockSubStatus) => void;
  onRetire: (subStatus: MockSubStatus) => void;
};

function ReadField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export default function SubStatusDetailModal({ subStatus, onClose, onEdit, onRetire }: Props) {
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 flex-wrap">
            <span>{subStatus.subStatusName}</span>
            {subStatus.isActive ? (
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" title="Active" />
            ) : (
              <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" title="Inactive" />
            )}
            <ProcessTypeChip processType={subStatus.processType} />
          </DialogTitle>
        </DialogHeader>

        <div>
          <ReadField label="Name">{subStatus.subStatusName}</ReadField>
          <ReadField label="Description">
            {subStatus.description ?? (
              <span className="italic text-muted-foreground/40">No description</span>
            )}
          </ReadField>
          <ReadField label="Display Order">{subStatus.displayOrder}</ReadField>
          <ReadField label="Active">
            <div className="flex items-center gap-2">
              {subStatus.isActive ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Yes
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" />
                  No
                </>
              )}
            </div>
          </ReadField>
        </div>

        <SubStatusAuditLogSection auditLog={subStatus.auditLog} />

        <div className="flex items-center justify-between border-t border-border pt-4 mt-1">
          <Button
            variant="default"
            disabled={!subStatus.isActive}
            onClick={() => onEdit(subStatus)}
          >
            Edit Sub-Status
          </Button>
          <Button
            variant="destructive"
            disabled={!subStatus.isActive}
            onClick={() => onRetire(subStatus)}
          >
            Retire Sub-Status
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
