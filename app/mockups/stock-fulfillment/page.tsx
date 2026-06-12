"use client";

// Stock Fulfillment mockup — scaffold
// Full implementation in subsequent commits.

import { useState } from "react";
import { INITIAL_SF_STATE, type SfState } from "./_data";

export default function StockFulfillmentPage() {
  const [state, setState] = useState<SfState>(() => ({
    ...INITIAL_SF_STATE,
    workOrders: [...INITIAL_SF_STATE.workOrders],
    stockCounts: { ...INITIAL_SF_STATE.stockCounts },
    auditLog: [],
  }));

  const totalWos = state.workOrders.length;

  return (
    <div className="p-8 text-center text-muted-foreground">
      <p className="text-sm">Stock Fulfillment — scaffold ({totalWos} WOs loaded)</p>
    </div>
  );
}
