'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';

export default function MaterialSpecsPage() {
  const [showInactive, setShowInactive] = useState(false);

  return (
    <ConfigurationPageChrome
      title="Material Specs"
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Material Spec"
      onAdd={() => {}}
    >
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Material Spec management UI coming soon.
      </div>
    </ConfigurationPageChrome>
  );
}
