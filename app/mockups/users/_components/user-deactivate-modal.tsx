import { MockUser } from "../_data";
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
  user: MockUser;
  allUsers: MockUser[];
  onClose: () => void;
  onConfirm: () => void;
};

export default function UserDeactivateModal({ user, allUsers, onClose, onConfirm }: Props) {
  const activeAdmins = allUsers.filter((u) => u.isActive && u.role === "Admin");
  const isOnlyActiveAdmin = activeAdmins.length === 1 && activeAdmins[0]?.userId === user.userId;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Deactivate User</DialogTitle>
          <DialogDescription>{user.displayName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isOnlyActiveAdmin ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive dark:border-destructive/40 dark:text-red-400">
              <strong className="font-medium">
                Cannot deactivate: this user is the only active Admin.
              </strong>{" "}
              Create another Admin user or promote an existing user to Admin first.
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Deactivated users cannot be selected as active users. Open Work Orders with this user
              assigned retain the assignment with a visual indicator. Audit history is preserved.
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isOnlyActiveAdmin} onClick={onConfirm}>
              Deactivate
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
