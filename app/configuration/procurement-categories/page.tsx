'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';

export default function ProcurementCategoriesPage() {
  const [showInactive, setShowInactive] = useState(false);

  return (
    <ConfigurationPageChrome
      title="Procurement Categories"
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
      addLabel="Add Category"
      onAdd={() => {}}
    >
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Procurement Category management UI coming soon.
      </div>
    </ConfigurationPageChrome>
  );
}
