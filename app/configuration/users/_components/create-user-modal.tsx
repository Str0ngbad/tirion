'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProcessTypeMultiSelect } from './process-type-multi-select';
import { useCreateUser, type UserRole } from '@/lib/api/users';
import { useProcessTypes } from '@/lib/api/process-types';
import { ApiError } from '@/lib/api/client-error';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (newId: number) => void;
}

const ROLES: UserRole[] = ['Operator', 'Lead', 'Manager', 'Admin'];

export function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const { data: processTypes = [] } = useProcessTypes();

  const [userName, setUserName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('Operator');
  const [assignedProcessTypeIds, setAssignedProcessTypeIds] = useState<number[]>([]);
  const [defaultStation, setDefaultStation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { mutate: create, isPending } = useCreateUser();

  function reset() {
    setUserName('');
    setDisplayName('');
    setRole('Operator');
    setAssignedProcessTypeIds([]);
    setDefaultStation('');
    setFieldErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleRoleChange(newRole: UserRole) {
    setRole(newRole);
    if (newRole === 'Manager' || newRole === 'Admin') {
      setAssignedProcessTypeIds([]);
    }
    if (newRole !== 'Operator') {
      setDefaultStation('');
    }
    setFieldErrors({});
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

  function handleSubmit() {
    if (!validate()) return;

    create(
      {
        userName: userName.trim(),
        displayName: displayName.trim(),
        role,
        defaultStation: role === 'Operator' ? (defaultStation.trim() || null) : null,
        assignedProcessTypeIds:
          role === 'Manager' || role === 'Admin' ? [] : assignedProcessTypeIds,
      },
      {
        onSuccess: (created) => {
          reset();
          onCreated(created.userId);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            if (err.errorCode === 'USER_NAME_COLLISION') {
              setFieldErrors({ userName: 'This username is already in use' });
            }
          }
        },
      }
    );
  }

  const needsProcessTypes = role === 'Operator' || role === 'Lead';
  const needsDefaultStation = role === 'Operator';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="userName" className="text-xs">
                Username <span className="text-destructive">*</span>
              </Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setFieldErrors((p) => ({ ...p, userName: '' }));
                }}
                placeholder="jsmith"
                className="mt-1 font-mono"
              />
              {fieldErrors.userName && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.userName}</p>
              )}
            </div>

            <div className="flex-1">
              <Label htmlFor="displayName" className="text-xs">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setFieldErrors((p) => ({ ...p, displayName: '' }));
                }}
                placeholder="Jane Smith"
                className="mt-1"
              />
              {fieldErrors.displayName && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.displayName}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-xs">
              Role <span className="text-destructive">*</span>
            </Label>
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
          </div>

          {needsProcessTypes && (
            <div>
              <Label className="text-xs">
                Assigned Process Types <span className="text-destructive">*</span>
              </Label>
              <div className="mt-1">
                <ProcessTypeMultiSelect
                  value={assignedProcessTypeIds}
                  onChange={(ids) => {
                    setAssignedProcessTypeIds(ids);
                    setFieldErrors((p) => ({ ...p, assignedProcessTypes: '' }));
                  }}
                  options={processTypes}
                />
              </div>
              {fieldErrors.assignedProcessTypes && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.assignedProcessTypes}</p>
              )}
            </div>
          )}

          {needsDefaultStation && (
            <div>
              <Label htmlFor="defaultStation" className="text-xs">
                Default Station <span className="text-destructive">*</span>
              </Label>
              <Input
                id="defaultStation"
                value={defaultStation}
                onChange={(e) => {
                  setDefaultStation(e.target.value);
                  setFieldErrors((p) => ({ ...p, defaultStation: '' }));
                }}
                placeholder="e.g., Line 1, Assembly Table A"
                className="mt-1"
              />
              {fieldErrors.defaultStation && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.defaultStation}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
