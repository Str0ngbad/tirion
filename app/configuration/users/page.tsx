'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';

export default function UsersPage() {
  const [showInactive, setShowInactive] = useState(false);

  return (
    <ConfigurationPageChrome
      title="Users"
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add User"
      onAdd={() => {}}
    >
      <div className="flex h-full items-center justify-center text-muted-foreground">
        User management UI coming soon.
      </div>
    </ConfigurationPageChrome>
  );
}
