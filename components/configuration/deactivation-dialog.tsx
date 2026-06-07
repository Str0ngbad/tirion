import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReferenceList, type ReferenceItem } from './reference-list';

type DeactivationDialogProps =
  | {
      variant: 'standard';
      open: boolean;
      entityName: string;
      entityType: string;
      onCancel: () => void;
      onConfirm: () => void;
    }
  | {
      variant: 'blocked-by-references';
      open: boolean;
      entityName: string;
      entityType: string;
      blockingReferences: ReferenceItem[];
      onCancel: () => void;
    }
  | {
      variant: 'admin-lockout';
      open: boolean;
      entityName: string;
      onCancel: () => void;
    };

export function DeactivationDialog(props: DeactivationDialogProps) {
  if (props.variant === 'standard') {
    return (
      <Dialog open={props.open} onOpenChange={(o) => !o && props.onCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {props.entityName}?</DialogTitle>
            <DialogDescription>
              This {props.entityType} will be marked inactive and hidden from
              active lists. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={props.onCancel}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={props.onConfirm}>
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (props.variant === 'blocked-by-references') {
    return (
      <Dialog open={props.open} onOpenChange={(o) => !o && props.onCancel()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Deactivate {props.entityName}</DialogTitle>
            <DialogDescription>
              {props.blockingReferences.length} active{' '}
              {props.blockingReferences.length === 1 ? 'part references' : 'parts reference'}{' '}
              this {props.entityType}. Resolve all references before deactivating.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <ReferenceList items={props.blockingReferences} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={props.onCancel}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // admin-lockout
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cannot Deactivate {props.entityName}</DialogTitle>
          <DialogDescription>
            At least one active Admin user must remain in the system. Assign
            another user the Admin role before deactivating this user.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={props.onCancel}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
