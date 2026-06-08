'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useUsers } from '@/lib/api/users';
import { UserGrid } from './_components/user-grid';
import { UserSheet } from './_components/user-sheet';
import { CreateUserModal } from './_components/create-user-modal';

export default function UsersPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: users = [] } = useUsers({
    active: showInactive ? 'all' : 'true',
  });

  return (
    <ConfigurationPageChrome
      title="Users"
      count={users.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add User"
      onAdd={() => setCreateModalOpen(true)}
    >
      <div className="flex h-full min-h-0">
        <div
          className={selectedId !== null ? 'w-[calc(100%-400px)] shrink-0 overflow-auto' : 'w-full overflow-auto'}
        >
          <UserGrid
            users={users}
            selectedId={selectedId}
            showInactive={showInactive}
            onSelectUser={setSelectedId}
          />
        </div>

        {selectedId !== null && (
          <div className="w-[400px] shrink-0 border-l border-border min-h-0 overflow-hidden flex flex-col">
            <UserSheet
              userId={selectedId}
              allUsers={users}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      <CreateUserModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(newId) => {
          setCreateModalOpen(false);
          setSelectedId(newId);
        }}
      />
    </ConfigurationPageChrome>
  );
}
