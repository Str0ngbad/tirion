"use client";

import { useState } from "react";
import { PartType, MockMinimalMaterialSpec, MockMinimalVendor } from "../_data";
import MaterialSpecCombobox from "./material-spec-combobox";
import VendorCombobox from "./vendor-combobox";
import AddMaterialSpecModal from "./add-material-spec-modal";
import AddVendorModal from "./add-vendor-modal";
import { Input } from "@/components/ui/input";

type Props = {
  partType: PartType;
  materialSpec: MockMinimalMaterialSpec | null;
  stockSize: string;
  defaultVendor: MockMinimalVendor | null;
  materialSpecs: MockMinimalMaterialSpec[];
  vendors: MockMinimalVendor[];
  onMaterialSpecChange: (spec: MockMinimalMaterialSpec | null) => void;
  onStockSizeChange: (value: string) => void;
  onVendorChange: (vendor: MockMinimalVendor | null) => void;
  onAddMaterialSpec: (spec: MockMinimalMaterialSpec) => void;
  onAddVendor: (vendor: MockMinimalVendor) => void;
};

export default function PartFormMaterialVendorSection({
  partType,
  materialSpec,
  stockSize,
  defaultVendor,
  materialSpecs,
  vendors,
  onMaterialSpecChange,
  onStockSizeChange,
  onVendorChange,
  onAddMaterialSpec,
  onAddVendor,
}: Props) {
  const [materialSpecModalOpen, setMaterialSpecModalOpen] = useState(false);
  const [vendorModalOpen, setVendorModalOpen] = useState(false);

  const isAssembly = partType === "Assembly";

  function handleMaterialSpecSelect(spec: MockMinimalMaterialSpec, isNew: boolean) {
    if (isNew) onAddMaterialSpec(spec);
    onMaterialSpecChange(spec);
    setMaterialSpecModalOpen(false);
  }

  function handleVendorSelect(vendor: MockMinimalVendor) {
    onAddVendor(vendor);
    onVendorChange(vendor);
    setVendorModalOpen(false);
  }

  return (
    <>
      {isAssembly && (
        <p className="mb-3 text-xs text-muted-foreground italic">
          Material &amp; Vendor fields are not used for Assemblies.
        </p>
      )}

      <div className="space-y-0">
        {/* MaterialSpec */}
        <div className="space-y-1 py-2">
          <div className="text-xs font-medium text-muted-foreground">Material Spec</div>
          <MaterialSpecCombobox
            value={materialSpec}
            materialSpecs={materialSpecs}
            disabled={isAssembly}
            onChange={onMaterialSpecChange}
            onAddNew={() => setMaterialSpecModalOpen(true)}
          />
        </div>

        {/* Stock Size */}
        <div className="space-y-1 py-2">
          <div className="text-xs font-medium text-muted-foreground">Stock Size</div>
          <Input
            value={stockSize}
            onChange={(e) => onStockSizeChange(e.target.value)}
            placeholder='e.g. 1.5" Round or 0.5" thick × 4" wide'
            disabled={isAssembly}
            className="h-8 text-sm"
          />
        </div>

        {/* Default Vendor */}
        <div className="space-y-1 py-2">
          <div className="text-xs font-medium text-muted-foreground">Default Vendor</div>
          <VendorCombobox
            value={defaultVendor}
            vendors={vendors}
            disabled={isAssembly}
            onChange={onVendorChange}
            onAddNew={() => setVendorModalOpen(true)}
          />
        </div>
      </div>

      {materialSpecModalOpen && (
        <AddMaterialSpecModal
          existingSpecs={materialSpecs}
          onClose={() => setMaterialSpecModalOpen(false)}
          onSelect={handleMaterialSpecSelect}
        />
      )}

      {vendorModalOpen && (
        <AddVendorModal
          existingVendors={vendors}
          onClose={() => setVendorModalOpen(false)}
          onSelect={handleVendorSelect}
        />
      )}
    </>
  );
}
