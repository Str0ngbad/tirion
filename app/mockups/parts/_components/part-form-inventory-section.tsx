"use client";

import { PartType } from "../_data";
import { Input } from "@/components/ui/input";

type Props = {
  partType: PartType;
  stockCount: number;
  inventoryLocation: string;
  binMin: string;
  binMax: string;
  onStockCountChange: (v: number) => void;
  onInventoryLocationChange: (v: string) => void;
  onBinMinChange: (v: string) => void;
  onBinMaxChange: (v: string) => void;
};

function InventoryField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export default function PartFormInventorySection({
  partType,
  stockCount,
  inventoryLocation,
  binMin,
  binMax,
  onStockCountChange,
  onInventoryLocationChange,
  onBinMinChange,
  onBinMaxChange,
}: Props) {
  if (partType === "Assembly") {
    return (
      <p className="text-sm text-muted-foreground">
        Assemblies don&apos;t carry inventory. Component parts maintain their own stock.
      </p>
    );
  }

  const binMinNum = binMin !== "" ? parseFloat(binMin) : null;
  const binMaxNum = binMax !== "" ? parseFloat(binMax) : null;
  const binWarning = binMinNum !== null && binMaxNum !== null && binMaxNum < binMinNum;

  return (
    <div className="space-y-3">
      <InventoryField label="Stock Count">
        <Input
          type="number"
          value={stockCount}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onStockCountChange(isNaN(v) ? 0 : Math.max(0, v));
          }}
          min={0}
          className="h-8 w-32 text-sm"
        />
      </InventoryField>

      <InventoryField label="Inventory Location">
        <Input
          value={inventoryLocation}
          onChange={(e) => onInventoryLocationChange(e.target.value)}
          placeholder="e.g., A-01"
          className="h-8 text-sm"
        />
      </InventoryField>

      <InventoryField label="Bin Minimum">
        <Input
          type="number"
          value={binMin}
          onChange={(e) => onBinMinChange(e.target.value)}
          min={0}
          placeholder="0"
          className="h-8 w-32 text-sm"
        />
      </InventoryField>

      <InventoryField label="Bin Maximum">
        <Input
          type="number"
          value={binMax}
          onChange={(e) => onBinMaxChange(e.target.value)}
          min={0}
          placeholder="0"
          className="h-8 w-32 text-sm"
        />
        {binWarning && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Bin Maximum is less than Bin Minimum. Verify the threshold values are correct.
          </p>
        )}
      </InventoryField>
    </div>
  );
}
