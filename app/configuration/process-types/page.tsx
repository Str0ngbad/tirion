'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';

export default function ProcessTypesPage() {
  const [showInactive, setShowInactive] = useState(false);

  return (
    <ConfigurationPageChrome
      title="Process Types"
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Process Type"
      onAdd={() => {}}
    >
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Process Type management UI coming soon.
      </div>
    </ConfigurationPageChrome>
  );
}
