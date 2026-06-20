import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

vi.mock("@/lib/db/client", () => ({
  prisma: {
    workOrder: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    productionBatch: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    auditAction: { findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/client";
import { deriveProductionState, getBatchingViewData } from "@/lib/batching/service";
import {
  BatchNotFoundError,
  BatchEligibilityError,
  WONotBatchCandidateError,
} from "@/lib/errors/batching-errors";

type MockPrisma = {
  workOrder: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  productionBatch: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditLog: { create: ReturnType<typeof vi.fn> };
  auditAction: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

const mockPrisma = prisma as unknown as MockPrisma;

beforeEach(() => {
  vi.clearAllMocks();
  // Default $transaction to run callback with mock as tx
  mockPrisma.$transaction.mockImplementation(async (cb: (tx: MockPrisma) => Promise<unknown>) =>
    cb(mockPrisma)
  );
});

// ─── deriveProductionState (pure) ────────────────────────────────────────────

describe("deriveProductionState", () => {
  it("returns case1 when no steps", () => {
    expect(deriveProductionState([])).toBe("case1");
  });

  it("returns case1 when all steps are Waiting/Ready with no subStatus", () => {
    const steps = [
      { state: "Waiting", subStatusId: null, completedQty: null },
      { state: "Ready", subStatusId: null, completedQty: null },
    ];
    expect(deriveProductionState(steps)).toBe("case1");
  });

  it("returns case2 when any step has completedQty > 0 and activity exists", () => {
    const steps = [
      { state: "Complete", subStatusId: null, completedQty: new Decimal(5) },
    ];
    expect(deriveProductionState(steps)).toBe("case2");
  });

  it("returns case3 when activity exists but no completedQty", () => {
    const steps = [
      { state: "Started", subStatusId: null, completedQty: null },
    ];
    expect(deriveProductionState(steps)).toBe("case3");
  });

  it("returns case3 when subStatus set but no completedQty", () => {
    const steps = [
      { state: "Waiting", subStatusId: 7, completedQty: null },
    ];
    expect(deriveProductionState(steps)).toBe("case3");
  });

  it("returns case2 even when completedQty is zero (treated as no qty)", () => {
    // completedQty = 0 should NOT count as "has completed qty"
    const steps = [
      { state: "Started", subStatusId: null, completedQty: new Decimal(0) },
    ];
    // 0 is not > 0, so case3
    expect(deriveProductionState(steps)).toBe("case3");
  });
});

// ─── getBatchingViewData ──────────────────────────────────────────────────────

describe("getBatchingViewData", () => {
  it("returns empty data when no reviewed Unreleased WOs exist", async () => {
    mockPrisma.workOrder.findMany.mockResolvedValueOnce([]);

    const result = await getBatchingViewData();

    expect(result.partIds).toHaveLength(0);
    expect(result.candidatesByPartId).toEqual({});
    expect(result.openRowsByPartId).toEqual({});
  });

  it("sets lockState Locked for singleton with no Open work", async () => {
    const candidateWO = {
      workOrderId: 1,
      partId: 10,
      quantity: new Decimal(5),
      priority: 1,
      dueDate: null,
      topLevelIndex: 1,
      bomPath: ["P-001 Widget"],
      stockFulfillmentReviewedAt: new Date(),
      project: { projectNumber: "10001.01" },
      routingTemplateDefinition: { steps: [] },
      steps: [],
      part: { partNumber: "P-001", partName: "Widget" },
    };

    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([candidateWO]) // candidate query
      .mockResolvedValueOnce([]); // open WO query

    const result = await getBatchingViewData();

    const part10 = result.candidatesByPartId[10]!;
    expect(part10).toHaveLength(1);
    expect(part10[0]!.lockState).toBe("Locked");
  });

  it("sets lockState Unlocked when multiple candidates for same part", async () => {
    const makeWO = (id: number) => ({
      workOrderId: id,
      partId: 10,
      quantity: new Decimal(3),
      priority: null,
      dueDate: null,
      topLevelIndex: id,
      bomPath: ["P-001 Widget"],
      stockFulfillmentReviewedAt: new Date(),
      project: { projectNumber: "10001.01" },
      routingTemplateDefinition: { steps: [] },
      steps: [],
      part: { partNumber: "P-001", partName: "Widget" },
    });

    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([makeWO(1), makeWO(2)])
      .mockResolvedValueOnce([]);

    const result = await getBatchingViewData();
    const candidates = result.candidatesByPartId[10] ?? [];
    expect(candidates.every((c) => c.lockState === "Unlocked")).toBe(true);
  });

  it("sets lockState Unlocked for singleton that has Open work for same part", async () => {
    const candidateWO = {
      workOrderId: 1,
      partId: 10,
      quantity: new Decimal(5),
      priority: null,
      dueDate: null,
      topLevelIndex: 1,
      bomPath: ["P-001 Widget"],
      stockFulfillmentReviewedAt: new Date(),
      project: { projectNumber: "10001.01" },
      routingTemplateDefinition: { steps: [] },
      steps: [],
      part: { partNumber: "P-001", partName: "Widget" },
    };
    const openWO = {
      workOrderId: 99,
      partId: 10,
      quantity: new Decimal(10),
      batchId: null,
      batch: null,
      steps: [],
      part: { partNumber: "P-001", partName: "Widget" },
    };

    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([candidateWO])
      .mockResolvedValueOnce([openWO]);

    const result = await getBatchingViewData();
    expect(result.candidatesByPartId[10]?.[0]?.lockState).toBe("Unlocked");
  });
});

// ─── updatePlannedQty ─────────────────────────────────────────────────────────

describe("updatePlannedQty", () => {
  it("throws BatchNotFoundError when batch does not exist", async () => {
    const { updatePlannedQty } = await import("@/lib/batching/service");
    mockPrisma.productionBatch.findUnique.mockResolvedValueOnce(null);

    await expect(updatePlannedQty(999, { plannedQty: 10 }, 1)).rejects.toBeInstanceOf(
      BatchNotFoundError
    );
  });

  it("throws BatchEligibilityError when plannedQty < totalQuantity (BL-9)", async () => {
    const { updatePlannedQty } = await import("@/lib/batching/service");
    mockPrisma.productionBatch.findUnique.mockResolvedValueOnce({
      batchId: 1,
      totalQuantity: new Decimal(20),
      plannedQuantity: null,
    });

    await expect(updatePlannedQty(1, { plannedQty: 5 }, 1)).rejects.toBeInstanceOf(
      BatchEligibilityError
    );
  });
});

// ─── confirmDraft ─────────────────────────────────────────────────────────────

describe("confirmDraft", () => {
  it("throws BatchConfirmEmptyError when assignments is empty", async () => {
    const { confirmDraft } = await import("@/lib/batching/service");
    const { BatchConfirmEmptyError } = await import("@/lib/errors/batching-errors");

    await expect(confirmDraft({ assignments: [] }, 1)).rejects.toBeInstanceOf(
      BatchConfirmEmptyError
    );
  });

  it("throws WONotBatchCandidateError when WO is not Unreleased", async () => {
    const { confirmDraft } = await import("@/lib/batching/service");

    mockPrisma.auditAction.findMany.mockResolvedValueOnce([
      { auditActionId: 1, actionName: "BatchCreated" },
      { auditActionId: 2, actionName: "WOAddedToOpenBatch" },
      { auditActionId: 3, actionName: "SingletonConfirmed" },
    ]);
    mockPrisma.workOrder.findMany.mockResolvedValueOnce([
      {
        workOrderId: 42,
        status: "Open",
        partId: 10,
        quantity: new Decimal(5),
        stockFulfillmentReviewedAt: new Date(),
      },
    ]);

    await expect(
      confirmDraft({ assignments: [{ workOrderIds: [42], targetType: "standalone" }] }, 1)
    ).rejects.toBeInstanceOf(WONotBatchCandidateError);
  });
});
