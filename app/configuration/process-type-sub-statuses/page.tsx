'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useProcessTypes } from '@/lib/api/process-types';
import { useProcessTypeSubStatuses } from '@/lib/api/process-type-sub-statuses';
import { ProcessTypeSection } from './_components/process-type-section';
import { ProcessTypeSubStatusSheet } from './_components/process-type-sub-status-sheet';

export default function ProcessTypeSubStatusesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: processTypes = [] } = useProcessTypes();
  const { data: allSubStatuses = [] } = useProcessTypeSubStatuses({
    active: showInactive ? 'all' : 'true',
  });

  return (
    <ConfigurationPageChrome
      title="Process Type Sub-Statuses"
      count={allSubStatuses.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
    >
      <div className="flex flex-1 min-h-0">
        <div
          className={selectedId !== null ? 'w-[calc(100%-400px)]' : 'w-full'}
          style={{ minWidth: 0, overflowY: 'auto' }}
        >
          <div className="max-w-4xl px-4 py-4 space-y-6">
            {processTypes.length === 0 ? (
              <div className="text-sm text-muted-foreground italic text-center py-12">
                No active process types found.
              </div>
            ) : (
              processTypes.map((pt) => (
                <ProcessTypeSection
                  key={pt.processTypeId}
                  processType={pt}
                  subStatuses={allSubStatuses.filter(
                    (s) => s.processTypeId === pt.processTypeId
                  )}
                  selectedId={selectedId}
                  onSelectSubStatus={setSelectedId}
                />
              ))
            )}
          </div>
        </div>

        {selectedId !== null && (
          <div className="w-[400px] shrink-0 border-l border-border min-h-0 overflow-hidden flex flex-col">
            <ProcessTypeSubStatusSheet
              subStatusId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </ConfigurationPageChrome>
  );
}
