'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

function roleBadgeClass(role: UserRole): string {
  switch (role) {
    case 'Admin':
      return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    case 'Manager':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
    case 'Lead':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
    case 'Operator':
      return '';
  }
}

function ProcessTypeChips({ pts }: { pts: UserRow['assignedProcessTypes'] }) {
  if (pts.length === 0) return <span className="text-muted-foreground">—</span>;
  const visible = pts.slice(0, 3);
  const overflow = pts.length - 3;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((pt) => (
        <Badge key={pt.processTypeId} variant="outline" className="font-mono text-xs px-1.5 py-0">
          {pt.processCode}
        </Badge>
      ))}
      {overflow > 0 && (
        <Badge variant="outline" className="text-xs px-1.5 py-0">
          +{overflow}
        </Badge>
      )}
    </div>
  );
}

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
            <th className="px-4 py-2 text-left font-medium text-muted-foreground w-36">
              <button
                className="flex items-center hover:text-foreground"
                onClick={() => handleSort('userName')}
              >
                Username <SortIcon col="userName" />
              </button>
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground w-40">
              <button
                className="flex items-center hover:text-foreground"
                onClick={() => handleSort('displayName')}
              >
                Display Name <SortIcon col="displayName" />
              </button>
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground w-28">
              <button
                className="flex items-center hover:text-foreground"
                onClick={() => handleSort('role')}
              >
                Role <SortIcon col="role" />
              </button>
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground">
              Process Types
            </th>
            <th className="px-4 py-2 text-left font-medium text-muted-foreground w-36">
              Default Station
            </th>
            {showInactive && (
              <th className="px-4 py-2 text-left font-medium text-muted-foreground w-20">
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
              <td className="px-4 py-2 font-mono font-medium">{user.userName}</td>
              <td className="px-4 py-2">{user.displayName}</td>
              <td className="px-4 py-2">
                <Badge
                  variant="outline"
                  className={cn('text-xs', roleBadgeClass(user.role))}
                >
                  {user.role}
                </Badge>
              </td>
              <td className="px-4 py-2">
                <ProcessTypeChips pts={user.assignedProcessTypes} />
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {user.defaultStation ?? '—'}
              </td>
              {showInactive && (
                <td className="px-4 py-2">
                  {user.isActive ? null : (
                    <Badge variant="outline" className="text-xs">Inactive</Badge>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
