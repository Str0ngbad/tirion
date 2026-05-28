"use client";

import { MockUser } from "../_data";
import ProcessTypeChip from "./process-type-chip";
import UserAuditLogSection from "./user-audit-log-section";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  user: MockUser;
  onClose: () => void;
  onEdit: (user: MockUser) => void;
  onDeactivate: (user: MockUser) => void;
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

export default function UserDetailModal({ user, onClose, onEdit, onDeactivate }: Props) {
  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="!w-[580px] sm:!max-w-[580px] gap-0 p-0 flex flex-col overflow-hidden"
      >
        {/* Panel header */}
        <SheetHeader className="border-b border-border px-6 py-4 gap-1.5">
          <SheetTitle className="text-base font-semibold">{user.displayName}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">@{user.userName}</span>
            <span className="text-muted-foreground/30">·</span>
            {user.isActive ? (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                <span>Active</span>
              </>
            ) : (
              <>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                <span>Inactive</span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Read-only fields */}
          <div className="mb-2">
            <ReadField label="User Name">
              <span className="font-mono">@{user.userName}</span>
            </ReadField>
            <ReadField label="Display Name">{user.displayName}</ReadField>
            <ReadField label="Role">{user.role}</ReadField>
            <ReadField label="Assigned Process Types">
              {user.role === "Manager" || user.role === "Admin" ? (
                <span className="text-muted-foreground text-sm">All (role has implicit access)</span>
              ) : user.assignedProcessTypes.length === 0 ? (
                <span className="text-muted-foreground/40">—</span>
              ) : (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {user.assignedProcessTypes.map((pt) => (
                    <ProcessTypeChip key={pt} processType={pt} />
                  ))}
                </div>
              )}
            </ReadField>
            <ReadField label="Default Station">
              {user.defaultStation ?? (
                <span className="text-muted-foreground/40 italic">
                  {user.role === "Operator" ? "Not set" : "N/A for this role"}
                </span>
              )}
            </ReadField>
            <ReadField label="Active">
              <div className="flex items-center gap-2">
                {user.isActive ? (
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

          {/* Audit log */}
          <UserAuditLogSection auditLog={user.auditLog} />
        </div>

        {/* Panel footer */}
        <div className="border-t border-border px-6 py-4 flex items-center gap-3">
          <Button
            variant="default"
            disabled={!user.isActive}
            onClick={() => onEdit(user)}
          >
            Edit User
          </Button>
          <Button
            variant="destructive"
            disabled={!user.isActive}
            onClick={() => onDeactivate(user)}
          >
            Deactivate User
          </Button>
          {!user.isActive && (
            <span className="text-xs text-muted-foreground ml-2">
              Reactivation not in this mockup.
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
