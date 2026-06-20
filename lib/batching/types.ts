import type { Prisma } from "@prisma/client";

export type ProductionState = "case1" | "case2" | "case3";

export type RoutingStep = {
  stepIndex: number;
  processTypeName: string;
};

export type AncestorNode = {
  partNumber: string;
  partName: string;
};

export type CandidateWO = {
  workOrderId: number;
  partId: number;
  partNumber: string;
  partName: string;
  demand: Prisma.Decimal;
  priority: number | null;
  dueDate: Date | null;
  routingSteps: RoutingStep[];
  bomPath: AncestorNode[];
  topLevelRef: string;
  productionState: ProductionState;
  completedQty: Prisma.Decimal | null;
  lockState: "Locked" | "Unlocked";
};

export type OpenWO = {
  /** null when this is a batch row; set to the WO id when standalone */
  workOrderId: number | null;
  batchId: number | null;
  batchDisplayId: string | null;
  partId: number;
  partNumber: string;
  partName: string;
  demand: Prisma.Decimal;
  plannedQty: Prisma.Decimal | null;
  /** available = (plannedQty - demand); 0 when no plannedQty set */
  available: Prisma.Decimal;
  productionState: ProductionState;
  completedQty: Prisma.Decimal | null;
};

export type BatchingViewData = {
  candidatesByPartId: Record<number, CandidateWO[]>;
  openRowsByPartId: Record<number, OpenWO[]>;
  partIds: number[];
};
