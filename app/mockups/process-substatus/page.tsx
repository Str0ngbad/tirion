"use client";

import { useState } from "react";
import { MOCK_SUB_STATUSES, MockSubStatus, MockAuditEntry } from "./_data";
import SubStatusSection from "./_components/sub-status-section";
import SubStatusCreateEditModal from "./_components/sub-status-create-edit-modal";
import SubStatusDetailModal from "./_components/sub-status-detail-modal";
import { ALL_PROCESS_TYPES, ProcessTypeKey } from "@/app/mockups/users/_data";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ACTOR_NAME = "Rita Alvarez";

type ModalState =
  | { mode: "create"; processType: ProcessTypeKey }
  | { mode: "edit"; subStatus: MockSubStatus }
  | null;

export default function ProcessSubStatusPage() {
  const [subStatuses, setSubStatuses] = useState<MockSubStatus[]>(MOCK_SUB_STATUSES);
  const [showInactive, setShowInactive] = useState(false);
  const [detailSubStatus, setDetailSubStatus] = useState<MockSubStatus | null>(null);
  const [modalState, setModalState] = useState<ModalState>(null);

  const activeCount = subStatuses.filter((s) => s.isActive).length;
  const maxSubStatusId = Math.max(...subStatuses.map((s) => s.subStatusId));

  function handleRetire(subStatus: MockSubStatus) {
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: ACTOR_NAME,
      action: "SubStatusRetired",
    };
    const updated: MockSubStatus = {
      ...subStatus,
      isActive: false,
      auditLog: [entry, ...subStatus.auditLog],
    };
    setSubStatuses((prev) => prev.map((s) => (s.subStatusId === updated.subStatusId ? updated : s)));
    if (detailSubStatus?.subStatusId === updated.subStatusId) {
      setDetailSubStatus(null);
    }
  }

  function handleReactivate(subStatus: MockSubStatus) {
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: ACTOR_NAME,
      action: "SubStatusReactivated",
    };
    const updated: MockSubStatus = {
      ...subStatus,
      isActive: true,
      auditLog: [entry, ...subStatus.auditLog],
    };
    setSubStatuses((prev) => prev.map((s) => (s.subStatusId === updated.subStatusId ? updated : s)));
  }

  function handleUpdateOrder(subStatusId: number, newOrder: number) {
    const existing = subStatuses.find((s) => s.subStatusId === subStatusId);
    if (!existing || existing.displayOrder === newOrder) return;
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: ACTOR_NAME,
      action: "SubStatusUpdated",
      changedFields: [
        { field: "displayOrder", before: String(existing.displayOrder), after: String(newOrder) },
      ],
    };
    const updated: MockSubStatus = {
      ...existing,
      displayOrder: newOrder,
      auditLog: [entry, ...existing.auditLog],
    };
    setSubStatuses((prev) => prev.map((s) => (s.subStatusId === updated.subStatusId ? updated : s)));
    if (detailSubStatus?.subStatusId === updated.subStatusId) {
      setDetailSubStatus(updated);
    }
  }

  function handleCreate(newSubStatus: MockSubStatus) {
    setSubStatuses((prev) => [...prev, newSubStatus]);
    setModalState(null);
  }

  function handleUpdate(updated: MockSubStatus) {
    setSubStatuses((prev) => prev.map((s) => (s.subStatusId === updated.subStatusId ? updated : s)));
    if (detailSubStatus?.subStatusId === updated.subStatusId) {
      setDetailSubStatus(updated);
    }
    setModalState(null);
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — Process Sub-Status Configuration</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Sub-Statuses</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{activeCount} active</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              size="sm"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label
              htmlFor="show-inactive"
              className="cursor-pointer text-sm font-normal text-muted-foreground"
            >
              Show Inactive
            </Label>
          </div>
        </div>
      </div>

      {/* Stacked sections */}
      <div className="mx-auto max-w-4xl space-y-4 px-8 py-6">
        {ALL_PROCESS_TYPES.map((pt) => {
          const forPt = subStatuses.filter(
            (s) => s.processType === pt && (showInactive || s.isActive)
          );
          return (
            <SubStatusSection
              key={pt}
              processType={pt}
              subStatuses={forPt}
              onAdd={() => setModalState({ mode: "create", processType: pt })}
              onRowClick={(s) => setDetailSubStatus(s)}
              onRetire={handleRetire}
              onReactivate={handleReactivate}
              onUpdateOrder={handleUpdateOrder}
            />
          );
        })}
      </div>

      {/* Detail modal */}
      {detailSubStatus !== null && (
        <SubStatusDetailModal
          subStatus={detailSubStatus}
          onClose={() => setDetailSubStatus(null)}
          onEdit={(s) => setModalState({ mode: "edit", subStatus: s })}
          onRetire={handleRetire}
        />
      )}

      {/* Create / Edit modal */}
      {modalState !== null && (
        <SubStatusCreateEditModal
          {...modalState}
          allSubStatuses={subStatuses}
          maxSubStatusId={maxSubStatusId}
          actorName={ACTOR_NAME}
          onClose={() => setModalState(null)}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
