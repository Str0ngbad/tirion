'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';

export default function ProcessTypeSubStatusesPage() {
  const [showInactive, setShowInactive] = useState(false);

  return (
    <ConfigurationPageChrome
      title="Process Type Sub-Statuses"
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Sub-Status"
      onAdd={() => {}}
    >
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Process Type Sub-Status management UI coming soon.
      </div>
    </ConfigurationPageChrome>
  );
}
