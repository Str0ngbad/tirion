'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';

export default function VendorsPage() {
  const [showInactive, setShowInactive] = useState(false);

  return (
    <ConfigurationPageChrome
      title="Vendors"
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Vendor"
      onAdd={() => {}}
    >
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Vendor management UI coming soon.
      </div>
    </ConfigurationPageChrome>
  );
}
