"use client";

import { useState } from "react";
import { MOCK_USERS, MockUser, MockAuditEntry } from "./_data";
import UserGrid, { UserSortKey } from "./_components/user-grid";
import UserDetailModal from "./_components/user-detail-modal";
import UserEditModal from "./_components/user-edit-modal";
import UserDeactivateModal from "./_components/user-deactivate-modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function UsersPage() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<UserSortKey>("displayName");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedUser, setSelectedUser] = useState<MockUser | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<MockUser | null>(null);
  const [editingUser, setEditingUser] = useState<MockUser | undefined>(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Mockup-only: active user selector state
  const [activeUserId, setActiveUserId] = useState<number>(
    MOCK_USERS.find((u) => u.isActive)?.userId ?? MOCK_USERS[0]?.userId ?? 1
  );

  const activeUsers = users.filter((u) => u.isActive);
  const effectiveActiveUserId = activeUsers.some((u) => u.userId === activeUserId)
    ? activeUserId
    : (activeUsers[0]?.userId ?? 0);
  const activeUserDisplayName =
    users.find((u) => u.userId === effectiveActiveUserId)?.displayName ?? "Admin";

  const displayed = users
    .filter((u) => showInactive || u.isActive)
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "userName":     return dir * a.userName.localeCompare(b.userName);
        case "displayName":  return dir * a.displayName.localeCompare(b.displayName);
        case "role":         return dir * a.role.localeCompare(b.role);
        default: {
          const _never: never = sortKey;
          void _never;
          return 0;
        }
      }
    });

  function handleSort(key: UserSortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function syncSelectedUser(updated: MockUser) {
    if (selectedUser?.userId === updated.userId) setSelectedUser(updated);
  }

  function handleUpdate(updated: MockUser) {
    setUsers((prev) => prev.map((u) => (u.userId === updated.userId ? updated : u)));
    syncSelectedUser(updated);
    setEditingUser(undefined);
  }

  function handleCreate(user: MockUser) {
    setUsers((prev) => [...prev, user]);
    setShowCreateModal(false);
  }

  function handleDeactivateConfirm() {
    if (!userToDeactivate) return;
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: activeUserDisplayName,
      action: "UserDeactivated",
    };
    const updated: MockUser = {
      ...userToDeactivate,
      isActive: false,
      auditLog: [entry, ...userToDeactivate.auditLog],
    };
    setUsers((prev) => prev.map((u) => (u.userId === updated.userId ? updated : u)));

    // If the deactivated user was the active session selection, fall back
    if (effectiveActiveUserId === userToDeactivate.userId) {
      const remaining = activeUsers.filter((u) => u.userId !== userToDeactivate.userId);
      setActiveUserId(remaining[0]?.userId ?? 0);
    }

    setUserToDeactivate(null);
    setSelectedUser(null);
  }

  const activeCount = users.filter((u) => u.isActive).length;
  const inactiveCount = users.filter((u) => !u.isActive).length;
  const maxUserId = Math.max(...users.map((u) => u.userId));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — User Management Configuration Grid</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Mockup-only: Active User selector scaffolding */}
      <div className="border-b border-dashed border-amber-900/20 bg-amber-500/5 px-8 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-500">
            Mockup-only validation: Active User selector
          </span>
          <span className="text-xs text-muted-foreground">
            (the real dropdown lives in global chrome — this is here to verify the deactivation →
            removed-from-options behavior)
          </span>
          <Select
            value={effectiveActiveUserId > 0 ? effectiveActiveUserId.toString() : ""}
            onValueChange={(val) => setActiveUserId(Number(val))}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="No active users" />
            </SelectTrigger>
            <SelectContent position="popper">
              {activeUsers.map((u) => (
                <SelectItem key={u.userId} value={u.userId.toString()}>
                  {u.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Users</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCount} active
              {inactiveCount > 0 && `, ${inactiveCount} inactive`}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                size="sm"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label
                htmlFor="show-inactive"
                className="cursor-pointer font-normal text-sm text-muted-foreground"
              >
                Show Inactive
              </Label>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <span className="text-base leading-none">+</span>
              Add New User
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-8 py-6">
        <UserGrid
          users={displayed}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          onRowClick={setSelectedUser}
        />
      </div>

      {/* Detail Sheet */}
      {selectedUser !== null && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => { setSelectedUser(null); setUserToDeactivate(null); }}
          onEdit={(u) => setEditingUser(u)}
          onDeactivate={setUserToDeactivate}
        />
      )}

      {/* Create / Edit modal */}
      {(showCreateModal || editingUser !== undefined) && (
        <UserEditModal
          allUsers={users}
          maxUserId={maxUserId}
          editingUser={editingUser}
          actorName={activeUserDisplayName}
          onClose={() => { setShowCreateModal(false); setEditingUser(undefined); }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}

      {/* Deactivate modal */}
      {userToDeactivate !== null && (
        <UserDeactivateModal
          user={userToDeactivate}
          allUsers={users}
          onClose={() => setUserToDeactivate(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}
    </div>
  );
}
