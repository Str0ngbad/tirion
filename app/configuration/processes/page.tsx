'use client';

import { useState } from 'react';
import { ConfigurationPageChrome } from '@/components/configuration/configuration-page-chrome';
import { useProcessTypes } from '@/lib/api/process-types';
import { useProcessTypeSubStatuses } from '@/lib/api/process-type-sub-statuses';
import { ProcessTypeSection } from './_components/process-type-section';
import { ProcessTypeSubStatusSheet } from './_components/process-type-sub-status-sheet';
import { ProcessTypeSheet } from './_components/process-type-sheet';

type SheetState =
  | { type: 'closed' }
  | { type: 'sub-status'; subStatusId: number }
  | { type: 'process-type'; processTypeId: number };

export default function ProcessesPage() {
  const [showInactive, setShowInactive] = useState(false);
  const [sheetState, setSheetState] = useState<SheetState>({ type: 'closed' });

  const { data: processTypes = [] } = useProcessTypes();
  const { data: allSubStatuses = [] } = useProcessTypeSubStatuses({
    active: showInactive ? 'all' : 'true',
  });

  const selectedSubStatusId =
    sheetState.type === 'sub-status' ? sheetState.subStatusId : null;

  return (
    <ConfigurationPageChrome
      title="Processes"
      count={allSubStatuses.length}
      showInactive={showInactive}
      onShowInactiveChange={setShowInactive}
    >
      {/* Always render both columns so the scrollbar position never shifts.
          The panel slot holds a placeholder when no item is selected. */}
      <div className="flex h-full min-h-0">
        <div className="w-[calc(100%-400px)] shrink-0 overflow-auto">
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
                  selectedSubStatusId={selectedSubStatusId}
                  onSelectSubStatus={(id) =>
                    setSheetState({ type: 'sub-status', subStatusId: id })
                  }
                  onSelectProcessType={(id) =>
                    setSheetState({ type: 'process-type', processTypeId: id })
                  }
                />
              ))
            )}
          </div>
        </div>

        <div className="w-[400px] shrink-0 border-l border-border h-full flex flex-col overflow-hidden">
          {sheetState.type === 'closed' && (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Select an item to view details</p>
            </div>
          )}
          {sheetState.type === 'sub-status' && (
            <ProcessTypeSubStatusSheet
              subStatusId={sheetState.subStatusId}
              onClose={() => setSheetState({ type: 'closed' })}
            />
          )}
          {sheetState.type === 'process-type' && (
            <ProcessTypeSheet
              processTypeId={sheetState.processTypeId}
              onClose={() => setSheetState({ type: 'closed' })}
            />
          )}
        </div>
      </div>
    </ConfigurationPageChrome>
  );
}
