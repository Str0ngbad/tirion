import type { PartType, Prisma } from "@prisma/client";

type Decimal = Prisma.Decimal;

export type CandidateWO = {
  workOrderId: number;
  projectId: number;
  projectNumber: string;
  partId: number;
  partNumber: string;
  partName: string;
  partType: PartType;
  quantity: Decimal;
  stockCount: Decimal;
  dueDate: Date | null;
  topLevelIndex: number | null;
  parentWoId: number | null;
  inventoryLocation: string | null;
  bomPath: string[];
  cumulativeDemand: Decimal;
};

export type ProjectStats = {
  projectId: number;
  projectNumber: string;
  customerName: string | null;
  dueDate: Date | null;
  candidateCount: number;
  pendingReleaseCount: number;
  unreleasedCount: number;
};

export type SfViewData = {
  candidates: CandidateWO[];
  projectStats: ProjectStats[];
};
