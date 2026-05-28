"use client";

import { useState } from "react";
import { MOCK_MATERIAL_SPECS, MockMaterialSpec, MockAuditEntry } from "./_data";
import MaterialSpecGrid, { SortKey } from "./_components/material-spec-grid";
import MaterialSpecDetailModal from "./_components/material-spec-detail-modal";
import MaterialSpecDeactivateModal from "./_components/material-spec-deactivate-modal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function MaterialSpecsPage() {
  const [specs, setSpecs] = useState<MockMaterialSpec[]>(MOCK_MATERIAL_SPECS);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("materialName");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState<MockMaterialSpec | null>(null);
  const [specToDeactivate, setSpecToDeactivate] = useState<MockMaterialSpec | null>(null);

  const displayed = specs
    .filter((s) => showInactive || s.isActive)
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "materialName":
          return dir * a.materialName.localeCompare(b.materialName);
        case "form":
          return dir * a.form.localeCompare(b.form);
        case "usedByCount":
          return dir * (a.usedByCount - b.usedByCount);
        default: {
          const _never: never = sortKey;
          void _never;
          return 0;
        }
      }
    });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function handleUpdate(updated: MockMaterialSpec) {
    setSpecs((prev) =>
      prev.map((s) => (s.materialSpecId === updated.materialSpecId ? updated : s))
    );
    setSelectedSpec(updated);
  }

  function handleDeactivateConfirm() {
    if (!specToDeactivate) return;
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: "Jane Chen",
      action: "MaterialSpecDeactivated",
    };
    const updated: MockMaterialSpec = {
      ...specToDeactivate,
      isActive: false,
      auditLog: [entry, ...specToDeactivate.auditLog],
    };
    setSpecs((prev) =>
      prev.map((s) => (s.materialSpecId === updated.materialSpecId ? updated : s))
    );
    setSpecToDeactivate(null);
    setSelectedSpec(null);
  }

  const activeCount = specs.filter((s) => s.isActive).length;
  const inactiveCount = specs.filter((s) => !s.isActive).length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-500/10 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-700 dark:text-amber-400">
          <strong className="font-medium">Mockup — MaterialSpec Configuration Grid</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-border px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Material Specs</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activeCount} active
              {inactiveCount > 0 && `, ${inactiveCount} inactive`}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                size="sm"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label
                htmlFor="show-inactive"
                className="cursor-pointer font-normal text-sm text-muted-foreground"
              >
                Show Inactive
              </Label>
            </div>
            <Button disabled title="Cascade create modal — coming in next commit">
              <span className="text-base leading-none">+</span>
              Add New MaterialSpec
            </Button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-8 py-6">
        <MaterialSpecGrid
          specs={displayed}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          onRowClick={setSelectedSpec}
        />
      </div>

      {/* Detail panel — hidden while deactivation modal is open */}
      {selectedSpec !== null && (
        <MaterialSpecDetailModal
          spec={selectedSpec}
          allSpecs={specs}
          onClose={() => { setSelectedSpec(null); setSpecToDeactivate(null); }}
          onUpdate={handleUpdate}
          onDeactivate={setSpecToDeactivate}
        />
      )}

      {/* Deactivation modal — layered on top of detail panel */}
      {specToDeactivate !== null && (
        <MaterialSpecDeactivateModal
          spec={specToDeactivate}
          onClose={() => setSpecToDeactivate(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}
    </div>
  );
}
