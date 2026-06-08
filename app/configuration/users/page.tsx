'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useUsers } from '@/lib/api/users';
import { UserGrid } from './_components/user-grid';
import { UserSheet } from './_components/user-sheet';

type SheetState =
  | { type: 'closed' }
  | { type: 'create' }
  | { type: 'edit'; userId: number };

export default function UsersPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>({ type: 'closed' });

  const { data: users = [] } = useUsers({
    active: showInactive ? 'all' : 'true',
  });

  const sheetOpen = sheetState.type !== 'closed';
  const selectedId = sheetState.type === 'edit' ? sheetState.userId : null;

  return (
    <ConfigurationPageChrome
      title="Users"
      count={users.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add User"
      onAdd={() => setSheetState({ type: 'create' })}
    >
      <div className="flex h-full min-h-0">
        <div className={sheetOpen ? 'w-[calc(100%-400px)] shrink-0 overflow-auto' : 'w-full overflow-auto'}>
          <UserGrid
            users={users}
            selectedId={selectedId}
            showInactive={showInactive}
            onSelectUser={(id) => setSheetState({ type: 'edit', userId: id })}
          />
        </div>

        {sheetOpen && (
          <div className="w-[400px] shrink-0 border-l border-border overflow-hidden">
            {sheetState.type === 'create' ? (
              <UserSheet
                mode={{
                  type: 'create',
                  onCreated: (newId) => setSheetState({ type: 'edit', userId: newId }),
                }}
                onClose={() => setSheetState({ type: 'closed' })}
              />
            ) : sheetState.type === 'edit' ? (
              <UserSheet
                mode={{ type: 'edit', userId: sheetState.userId, allUsers: users }}
                onClose={() => setSheetState({ type: 'closed' })}
              />
            ) : null}
          </div>
        )}
      </div>
    </ConfigurationPageChrome>
  );
}
