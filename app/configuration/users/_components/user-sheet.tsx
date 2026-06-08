'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AuditLogSection } from '@/components/configuration/audit-log-section';
import { DeactivationDialog } from '@/components/configuration/deactivation-dialog';
import { ProcessTypeMultiSelect } from './process-type-multi-select';
import {
  useUser,
  useUserAuditLog,
  useUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  type UserRow,
  type UserRole,
} from '@/lib/api/users';
import { useProcessTypes } from '@/lib/api/process-types';
import { ApiError } from '@/lib/api/client-error';

interface UserSheetProps {
  userId: number;
  allUsers: UserRow[];
  onClose: () => void;
}

const ROLES: UserRole[] = ['Operator', 'Lead', 'Manager', 'Admin'];

export function UserSheet({ userId, allUsers, onClose }: UserSheetProps) {
  const { data: user, isLoading } = useUser(userId);
  const { data: auditEntries, isLoading: auditLoading } = useUserAuditLog(userId, true);
  const { data: processTypes = [] } = useProcessTypes();

  const { mutate: update, isPending: isSaving } = useUpdateUser();
  const { mutate: deactivate, isPending: isDeactivating } = useDeactivateUser();
  const { mutate: reactivate, isPending: isReactivating } = useReactivateUser();

  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('Operator');
  const [assignedProcessTypeIds, setAssignedProcessTypeIds] = useState<number[]>([]);
  const [defaultStation, setDefaultStation] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [deactivateDialogVariant, setDeactivateDialogVariant] = useState<
    'standard' | 'admin-lockout' | null
  >(null);
  const [roleLockoutDialogOpen, setRoleLockoutDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setUserName(user.userName);
      setDisplayName(user.displayName);
      setRole(user.role);
      setAssignedProcessTypeIds(user.assignedProcessTypes.map((p) => p.processTypeId));
      setDefaultStation(user.defaultStation ?? '');
      setIsDirty(false);
      setFieldErrors({});
    }
  }, [user]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleRoleChange(newRole: UserRole) {
    setRole(newRole);
    if (newRole === 'Manager' || newRole === 'Admin') {
      setAssignedProcessTypeIds([]);
    }
    if (newRole !== 'Operator') {
      setDefaultStation('');
    }
    markDirty();
  }

  function isLastActiveAdmin(): boolean {
    const activeAdmins = allUsers.filter((u) => u.role === 'Admin' && u.isActive);
    return activeAdmins.length === 1 && activeAdmins[0]?.userId === userId;
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!userName.trim()) errors.userName = 'Username is required';
    if (!displayName.trim()) errors.displayName = 'Display name is required';
    if ((role === 'Operator' || role === 'Lead') && assignedProcessTypeIds.length === 0) {
      errors.assignedProcessTypes = 'At least one process type is required for this role';
    }
    if (role === 'Operator' && !defaultStation.trim()) {
      errors.defaultStation = 'Default station is required for Operator role';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSave() {
    if (!user || !validate()) return;

    // Lockout check: changing the last active Admin away from Admin
    if (user.role === 'Admin' && role !== 'Admin' && isLastActiveAdmin()) {
      setRoleLockoutDialogOpen(true);
      return;
    }

    update(
      {
        id: userId,
        input: {
          userName: userName.trim(),
          displayName: displayName.trim(),
          role,
          defaultStation: role === 'Operator' ? (defaultStation.trim() || null) : null,
          assignedProcessTypeIds:
            role === 'Manager' || role === 'Admin' ? [] : assignedProcessTypeIds,
        },
      },
      {
        onSuccess: () => {
          setIsDirty(false);
          setFieldErrors({});
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.errorCode === 'USER_NAME_COLLISION') {
              setFieldErrors({ userName: 'This username is already in use' });
            } else if (err.errorCode === 'USER_LOCKOUT') {
              setRoleLockoutDialogOpen(true);
            }
          }
        },
      }
    );
  }

  function handleDeactivateClick() {
    if (!user) return;
    if (isLastActiveAdmin()) {
      setDeactivateDialogVariant('admin-lockout');
    } else {
      setDeactivateDialogVariant('standard');
    }
  }

  function handleDeactivateConfirm() {
    deactivate(userId, {
      onSuccess: () => setDeactivateDialogVariant(null),
    });
  }

  if (isLoading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const needsProcessTypes = role === 'Operator' || role === 'Lead';
  const needsDefaultStation = role === 'Operator';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Input
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  markDirty();
                  setFieldErrors((p) => ({ ...p, userName: '' }));
                }}
                className="font-mono font-medium border-0 px-0 h-7 focus-visible:ring-0 w-auto min-w-0"
                placeholder="username"
              />
              <Switch checked={user.isActive} disabled />
            </div>
            <Input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                markDirty();
                setFieldErrors((p) => ({ ...p, displayName: '' }));
              }}
              className="text-xs text-muted-foreground border-0 px-0 h-6 focus-visible:ring-0 mt-0.5"
              placeholder="Display name"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {(fieldErrors.userName || fieldErrors.displayName) && (
          <p className="text-xs text-destructive mt-1">
            {fieldErrors.userName || fieldErrors.displayName}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Role */}
        <section className="border-b px-4 py-4">
          <Label className="text-xs">Role</Label>
          <Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        {/* Conditional: Assigned Process Types */}
        {needsProcessTypes && (
          <section className="border-b px-4 py-4">
            <Label className="text-xs">
              Assigned Process Types <span className="text-destructive">*</span>
            </Label>
            <div className="mt-1">
              <ProcessTypeMultiSelect
                value={assignedProcessTypeIds}
                onChange={(ids) => {
                  setAssignedProcessTypeIds(ids);
                  markDirty();
                  setFieldErrors((p) => ({ ...p, assignedProcessTypes: '' }));
                }}
                options={processTypes}
              />
            </div>
            {fieldErrors.assignedProcessTypes && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.assignedProcessTypes}</p>
            )}
          </section>
        )}

        {/* Conditional: Default Station */}
        {needsDefaultStation && (
          <section className="border-b px-4 py-4">
            <Label className="text-xs">
              Default Station <span className="text-destructive">*</span>
            </Label>
            <Input
              value={defaultStation}
              onChange={(e) => {
                setDefaultStation(e.target.value);
                markDirty();
                setFieldErrors((p) => ({ ...p, defaultStation: '' }));
              }}
              placeholder="e.g., Line 1, Assembly Table A"
              className="mt-1"
            />
            {fieldErrors.defaultStation && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.defaultStation}</p>
            )}
          </section>
        )}

        {/* Audit log */}
        <AuditLogSection entries={auditEntries} isLoading={auditLoading} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-4 py-3 shrink-0 gap-2">
        {user.isActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeactivateClick}
            disabled={isSaving || isDeactivating}
          >
            Deactivate
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => reactivate(userId)}
            disabled={isReactivating}
          >
            {isReactivating ? 'Activating…' : 'Activate'}
          </Button>
        )}

        <Button size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {/* Deactivate dialog */}
      {deactivateDialogVariant === 'standard' && (
        <DeactivationDialog
          variant="standard"
          open
          entityName={user.userName}
          entityType="user"
          onCancel={() => setDeactivateDialogVariant(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}
      {deactivateDialogVariant === 'admin-lockout' && (
        <DeactivationDialog
          variant="admin-lockout"
          open
          entityName={user.userName}
          onCancel={() => setDeactivateDialogVariant(null)}
        />
      )}

      {/* Role-change lockout dialog */}
      <Dialog open={roleLockoutDialogOpen} onOpenChange={(o) => !o && setRoleLockoutDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cannot Remove Admin Role</DialogTitle>
            <DialogDescription>
              {user.userName} is the only active Admin. Assign another user the Admin
              role before changing this user's role.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleLockoutDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
