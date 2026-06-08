'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProcessTypeChip from '@/components/process-type-chip';
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

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-background border-b">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-36">
              <button
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort('userName')}
              >
                Username <SortIcon col="userName" />
              </button>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-40">
              <button
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort('displayName')}
              >
                Display Name <SortIcon col="displayName" />
              </button>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-28">
              <button
                className="flex items-center hover:text-foreground transition-colors"
                onClick={() => handleSort('role')}
              >
                Role <SortIcon col="role" />
              </button>
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Process Types
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-36">
              Default Station
            </th>
            {showInactive && (
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground w-20">
                Status
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((user) => (
            <tr
              key={user.userId}
              className={cn(
                'cursor-pointer hover:bg-muted/40',
                selectedId === user.userId && 'bg-muted/60',
                !user.isActive && 'opacity-50'
              )}
              onClick={() => onSelectUser(user.userId)}
            >
              <td className="px-4 py-2.5 font-mono font-medium text-sm">{user.userName}</td>
              <td className="px-4 py-2.5 text-sm">{user.displayName}</td>
              <td className="px-4 py-2.5 text-sm text-muted-foreground">{user.role}</td>
              <td className="px-4 py-2.5">
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
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {user.defaultStation ?? <span className="text-muted-foreground/40">—</span>}
              </td>
              {showInactive && (
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {user.isActive ? null : 'Inactive'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
