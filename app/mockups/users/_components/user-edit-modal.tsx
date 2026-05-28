"use client";

import { useState, useEffect } from "react";
import { MockUser, MockAuditEntry, UserRole, ProcessTypeKey } from "../_data";
import ProcessTypeMultiSelect from "./process-type-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ROLES: UserRole[] = ["Operator", "Lead", "Manager", "Admin"];

type Props = {
  allUsers: MockUser[];
  maxUserId: number;
  editingUser?: MockUser;
  actorName: string;
  onClose: () => void;
  onCreate: (user: MockUser) => void;
  onUpdate: (updated: MockUser) => void;
};

export default function UserEditModal({
  allUsers,
  maxUserId,
  editingUser,
  actorName,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const isEditMode = editingUser !== undefined;

  const [userName, setUserName] = useState(editingUser?.userName ?? "");
  const [displayName, setDisplayName] = useState(editingUser?.displayName ?? "");
  const [role, setRole] = useState<UserRole>(editingUser?.role ?? "Operator");
  const [assignedProcessTypes, setAssignedProcessTypes] = useState<ProcessTypeKey[]>(
    editingUser?.assignedProcessTypes ?? []
  );
  const [defaultStation, setDefaultStation] = useState(editingUser?.defaultStation ?? "");
  const [userNameError, setUserNameError] = useState<string | null>(null);
  const [processTypesError, setProcessTypesError] = useState<string | null>(null);

  const showProcessTypes = role === "Operator" || role === "Lead";
  const showDefaultStation = role === "Operator";

  // Clear conditional field values when they become hidden
  useEffect(() => {
    if (!showProcessTypes) setAssignedProcessTypes([]);
  }, [showProcessTypes]);

  useEffect(() => {
    if (!showDefaultStation) setDefaultStation("");
  }, [showDefaultStation]);

  // Admin lockout: in edit mode, editingUser is the only active Admin
  const activeAdmins = allUsers.filter((u) => u.isActive && u.role === "Admin");
  const isOnlyActiveAdmin =
    isEditMode &&
    activeAdmins.length === 1 &&
    activeAdmins[0]?.userId === editingUser!.userId;
  const lockoutActive = isOnlyActiveAdmin && role !== "Admin";

  // Detect no changes in edit mode
  const sortedCurrent = [...assignedProcessTypes].sort().join(",");
  const sortedOriginal = [...(editingUser?.assignedProcessTypes ?? [])].sort().join(",");
  const isNoChange =
    isEditMode &&
    userName.trim() === editingUser!.userName &&
    displayName.trim() === editingUser!.displayName &&
    role === editingUser!.role &&
    sortedCurrent === sortedOriginal &&
    (defaultStation.trim() || null) === editingUser!.defaultStation;

  function handleRoleChange(newRole: UserRole) {
    setRole(newRole);
    setUserNameError(null);
    setProcessTypesError(null);
  }

  function handleSubmit() {
    const trimmedUserName = userName.trim();
    const trimmedDisplayName = displayName.trim();

    // Validate user name
    if (!trimmedUserName) {
      setUserNameError("User name is required.");
      return;
    }
    const isDuplicate = allUsers.some(
      (u) =>
        u.userName.toLowerCase() === trimmedUserName.toLowerCase() &&
        (!isEditMode || u.userId !== editingUser!.userId)
    );
    if (isDuplicate) {
      setUserNameError("A user with this user name already exists.");
      return;
    }

    if (!trimmedDisplayName) return;

    // Validate process types when shown
    if (showProcessTypes && assignedProcessTypes.length === 0) {
      setProcessTypesError("At least one process type is required for this role.");
      return;
    }

    const effectiveProcessTypes = showProcessTypes ? assignedProcessTypes : [];
    const effectiveDefaultStation = showDefaultStation ? (defaultStation.trim() || null) : null;

    if (isEditMode) {
      if (lockoutActive || isNoChange) return;

      const changedFields: NonNullable<MockAuditEntry["changedFields"]> = [];

      if (trimmedUserName !== editingUser!.userName) {
        changedFields.push({ field: "userName", before: editingUser!.userName, after: trimmedUserName });
      }
      if (trimmedDisplayName !== editingUser!.displayName) {
        changedFields.push({ field: "displayName", before: editingUser!.displayName, after: trimmedDisplayName });
      }
      if (role !== editingUser!.role) {
        changedFields.push({ field: "role", before: editingUser!.role, after: role });
      }
      if (sortedCurrent !== sortedOriginal) {
        changedFields.push({
          field: "assignedProcessTypes",
          before: editingUser!.assignedProcessTypes.join(", ") || null,
          after: effectiveProcessTypes.join(", ") || null,
        });
      }
      if (effectiveDefaultStation !== editingUser!.defaultStation) {
        changedFields.push({
          field: "defaultStation",
          before: editingUser!.defaultStation,
          after: effectiveDefaultStation,
        });
      }

      const entry: MockAuditEntry = {
        timestamp: new Date().toISOString(),
        userName: actorName,
        action: "UserUpdated",
        changedFields: changedFields.length > 0 ? changedFields : undefined,
      };

      const updated: MockUser = {
        ...editingUser!,
        userName: trimmedUserName,
        displayName: trimmedDisplayName,
        role,
        assignedProcessTypes: effectiveProcessTypes,
        defaultStation: effectiveDefaultStation,
        auditLog: [entry, ...editingUser!.auditLog],
      };

      onUpdate(updated);
      return;
    }

    // Create mode
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: actorName,
      action: "UserCreated",
    };

    const newUser: MockUser = {
      userId: maxUserId + 1,
      userName: trimmedUserName,
      displayName: trimmedDisplayName,
      role,
      isActive: true,
      defaultStation: effectiveDefaultStation,
      assignedProcessTypes: effectiveProcessTypes,
      auditLog: [entry],
    };

    onCreate(newUser);
  }

  const canSave = isEditMode
    ? !lockoutActive && !isNoChange && userName.trim() !== "" && displayName.trim() !== ""
    : userName.trim() !== "" && displayName.trim() !== "";

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit User" : "Add New User"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Admin lockout banner */}
          {lockoutActive && (
            <div className="rounded-md border border-blue-900/50 bg-blue-950/30 px-4 py-3 text-sm text-blue-300">
              <strong className="font-medium">
                Cannot change role: this user is the only active Admin.
              </strong>{" "}
              Create another Admin user or promote an existing user to Admin first.
            </div>
          )}

          {/* User Name */}
          <div>
            <Label
              htmlFor="user-name"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              User Name{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Input
              id="user-name"
              type="text"
              value={userName}
              onChange={(e) => { setUserName(e.target.value); setUserNameError(null); }}
              placeholder="e.g., jsmith"
              aria-invalid={!!userNameError}
            />
            {userNameError && (
              <p className="mt-1 text-xs text-red-400">{userNameError}</p>
            )}
          </div>

          {/* Display Name */}
          <div>
            <Label
              htmlFor="display-name"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Display Name{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Jane Smith"
            />
          </div>

          {/* Role */}
          <div>
            <Label
              htmlFor="role"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Role{" "}
              <span className="font-normal normal-case tracking-normal text-red-500">*</span>
            </Label>
            <Select
              value={role}
              onValueChange={(v) => handleRoleChange(v as UserRole)}
            >
              <SelectTrigger id="role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned Process Types — shown for Operator and Lead */}
          {showProcessTypes && (
            <div>
              <Label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assigned Process Types{" "}
                <span className="font-normal normal-case tracking-normal text-red-500">*</span>
              </Label>
              <ProcessTypeMultiSelect
                selected={assignedProcessTypes}
                onChange={(v) => { setAssignedProcessTypes(v); setProcessTypesError(null); }}
              />
              {processTypesError && (
                <p className="mt-1 text-xs text-red-400">{processTypesError}</p>
              )}
            </div>
          )}

          {/* Default Station — shown for Operator only */}
          {showDefaultStation && (
            <div>
              <Label
                htmlFor="default-station"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Default Station{" "}
                <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
                  optional
                </span>
              </Label>
              <Input
                id="default-station"
                type="text"
                value={defaultStation}
                onChange={(e) => setDefaultStation(e.target.value)}
                placeholder="e.g., Mill #3"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave}>
            {isEditMode ? "Save Changes" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
