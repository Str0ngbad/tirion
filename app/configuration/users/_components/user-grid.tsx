'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import ProcessTypeChip from '@/components/process-type-chip';
import { ActiveIndicator } from '@/components/ui/active-indicator';
import type { ProcessTypeKey } from '@/lib/process-types';
import type { UserRow, UserRole } from '@/lib/api/users';

interface UserGridProps {
  users: UserRow[];
  selectedId: number | null;
  showInactive: boolean;
  onSelectUser: (id: number) => void;
}

type SortKey = 'userName' | 'displayName' | 'role';
type SortDir = 'asc' | 'desc';

const ROLE_ORDER: Record<UserRole, number> = {
  Admin: 0,
  Manager: 1,
  Lead: 2,
  Operator: 3,
};

export function UserGrid({ users, selectedId, showInactive, onSelectUser }: UserGridProps) {
  const [sortKey, setSortKey] = useState<SortKey>('userName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'userName') cmp = a.userName.localeCompare(b.userName);
      else if (sortKey === 'displayName') cmp = a.displayName.localeCompare(b.displayName);
      else if (sortKey === 'role') cmp = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [users, sortKey, sortDir]);

  function SortMark({ col }: { col: SortKey }) {
    if (col !== sortKey) return <span className="text-[10px] text-muted-foreground/30">↕</span>;
    return <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const colHead =
    'text-xs font-medium uppercase tracking-wide text-muted-foreground select-none flex items-center gap-1';

  return (
    <div className="h-full flex flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2 shrink-0">
        <div className="w-8 shrink-0 flex justify-center">
          <span className={colHead}>
            <span className="sr-only">Active</span>
            <span aria-hidden>●</span>
          </span>
        </div>
        <div className="w-32 shrink-0">
          <button className={colHead} onClick={() => handleSort('userName')}>
            Username <SortMark col="userName" />
          </button>
        </div>
        <div className="w-40 shrink-0">
          <button className={colHead} onClick={() => handleSort('displayName')}>
            Display Name <SortMark col="displayName" />
          </button>
        </div>
        <div className="w-24 shrink-0">
          <button className={colHead} onClick={() => handleSort('role')}>
            Role <SortMark col="role" />
          </button>
        </div>
        <div className="w-28 shrink-0">
          <span className={colHead}>Station</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className={colHead}>Process Types</span>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground italic">
            No users found.
          </div>
        )}
        {sorted.map((user) => (
          <button
            key={user.userId}
            onClick={() => onSelectUser(user.userId)}
            className={cn(
              'flex w-full items-center gap-3 border-b px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left',
              selectedId === user.userId && 'bg-muted/70',
              !user.isActive && 'opacity-40 hover:opacity-60'
            )}
          >
            <div className="w-8 shrink-0 flex justify-center">
              <ActiveIndicator active={user.isActive} />
            </div>
            <div className="w-32 shrink-0 font-mono font-medium truncate">
              {user.userName}
            </div>
            <div className="w-40 shrink-0 truncate">{user.displayName}</div>
            <div className="w-24 shrink-0 text-muted-foreground truncate">{user.role}</div>
            <div className="w-28 shrink-0 text-xs text-muted-foreground truncate">
              {user.defaultStation ?? <span className="text-muted-foreground/40">—</span>}
            </div>
            <div className="flex-1 min-w-0">
              {user.role === 'Manager' || user.role === 'Admin' ? (
                <span className="text-xs text-muted-foreground">All</span>
              ) : user.assignedProcessTypes.length === 0 ? (
                <span className="text-xs text-muted-foreground/40">—</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {user.assignedProcessTypes.map((pt) => (
                    <ProcessTypeChip
                      key={pt.processTypeId}
                      processType={pt.processName as ProcessTypeKey}
                    />
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
