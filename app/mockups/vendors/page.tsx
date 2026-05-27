"use client";

import { useState } from "react";
import { MOCK_VENDORS, MockVendor, MockAuditEntry } from "./_data";
import VendorGrid, { SortKey } from "./_components/vendor-grid";
import VendorDetailModal from "./_components/vendor-detail-modal";
import VendorDeactivateModal from "./_components/vendor-deactivate-modal";
import VendorCreateModal from "./_components/vendor-create-modal";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<MockVendor[]>(MOCK_VENDORS);
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("vendorName");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<MockVendor | null>(null);
  const [vendorToDeactivate, setVendorToDeactivate] = useState<MockVendor | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const displayed = vendors
    .filter((v) => showInactive || v.isActive)
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "vendorName":
          return dir * a.vendorName.localeCompare(b.vendorName);
        case "leadTimeDays": {
          if (a.leadTimeDays === null && b.leadTimeDays === null) return 0;
          if (a.leadTimeDays === null) return 1;
          if (b.leadTimeDays === null) return -1;
          return dir * (a.leadTimeDays - b.leadTimeDays);
        }
        case "defaultVendorForCount":
          return dir * (a.defaultVendorForCount - b.defaultVendorForCount);
        case "openSupplyOrderCount":
          return dir * (a.openSupplyOrderCount - b.openSupplyOrderCount);
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

  function handleUpdate(updated: MockVendor) {
    setVendors((prev) => prev.map((v) => (v.vendorId === updated.vendorId ? updated : v)));
    setSelectedVendor(updated);
  }

  function handleDeactivateConfirm() {
    if (!vendorToDeactivate) return;
    const entry: MockAuditEntry = {
      timestamp: new Date().toISOString(),
      userName: "Jane Chen",
      action: "VendorDeactivated",
    };
    const updated: MockVendor = {
      ...vendorToDeactivate,
      isActive: false,
      auditLog: [entry, ...vendorToDeactivate.auditLog],
    };
    setVendors((prev) => prev.map((v) => (v.vendorId === updated.vendorId ? updated : v)));
    setVendorToDeactivate(null);
    setSelectedVendor(null);
  }

  function handleCreate(vendor: MockVendor) {
    setVendors((prev) => [...prev, vendor]);
    setShowCreateModal(false);
  }

  const activeCount = vendors.filter((v) => v.isActive).length;
  const inactiveCount = vendors.filter((v) => !v.isActive).length;
  const maxVendorId = Math.max(...vendors.map((v) => v.vendorId));

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      {/* Mockup banner */}
      <div className="border-b border-amber-900/30 bg-amber-950/25 px-6 py-1.5 text-center">
        <span className="text-xs text-amber-400/70">
          <strong className="font-medium">Mockup — Vendor Configuration Grid</strong>
          {" · "}Spec validation, not production · in-memory state, resets on reload
        </span>
      </div>

      {/* Page header */}
      <div className="border-b border-zinc-800 px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Vendors</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {activeCount} active
              {inactiveCount > 0 && `, ${inactiveCount} inactive`}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-800 accent-zinc-400"
              />
              Show Inactive
            </label>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
            >
              <span className="text-base leading-none">+</span>
              Add New Vendor
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-8 py-6">
        <VendorGrid
          vendors={displayed}
          sortKey={sortKey}
          sortAsc={sortAsc}
          onSort={handleSort}
          onRowClick={setSelectedVendor}
        />
      </div>

      {/* Detail panel — hidden while deactivation modal is open */}
      {selectedVendor !== null && (
        <VendorDetailModal
          vendor={selectedVendor}
          onClose={() => { setSelectedVendor(null); setVendorToDeactivate(null); }}
          onUpdate={handleUpdate}
          onDeactivate={setVendorToDeactivate}
        />
      )}

      {/* Deactivation modal — layered on top of detail panel */}
      {vendorToDeactivate !== null && (
        <VendorDeactivateModal
          vendor={vendorToDeactivate}
          onClose={() => setVendorToDeactivate(null)}
          onConfirm={handleDeactivateConfirm}
        />
      )}

      {/* Create modal */}
      {showCreateModal && (
        <VendorCreateModal
          existingVendorNames={vendors.map((v) => v.vendorName)}
          maxVendorId={maxVendorId}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
