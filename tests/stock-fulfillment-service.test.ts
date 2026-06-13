/**
 * Stock Fulfillment service unit tests.
 * Uses mocked Prisma to isolate business logic from the database.
 * See TESTS_BACKLOG.md for integration test deferrals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma, PartType } from "@prisma/client";

const { Decimal } = Prisma;

// Mock the Prisma client before importing the service.
vi.mock("@/lib/db/client", () => ({
  prisma: {
    project: { findMany: vi.fn(), findUnique: vi.fn() },
    workOrder: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    part: { findUnique: vi.fn(), update: vi.fn() },
    workOrderStep: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    auditAction: { findUniqueOrThrow: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "@/lib/db/client";
import {
  getSfViewData,
  locationSortedProject,
  getDescendantWoIds,
  fulfillFromStock,
  passThrough,
  releaseProject,
} from "@/lib/stock-fulfillment/service";
import {
  WOAlreadyReviewedError,
  WONotUnreleasedError,
  InsufficientStockError,
  DescendantCompleteError,
} from "@/lib/errors/stock-fulfillment-errors";
import type { CandidateWO } from "@/lib/stock-fulfillment/types";

const mockPrisma = prisma as unknown as {
  project: { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  workOrder: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  part: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  workOrderStep: { updateMany: ReturnType<typeof vi.fn> };
  auditLog: { create: ReturnType<typeof vi.fn> };
  auditAction: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Pure helper tests ─────────────────────────────────────────────────────────

describe("getDescendantWoIds", () => {
  it("returns empty array for a WO with no children", () => {
    const wos = [
      { workOrderId: 1, projectId: 1, parentWoId: null, status: "Unreleased" },
      { workOrderId: 2, projectId: 1, parentWoId: null, status: "Unreleased" },
    ];
    expect(getDescendantWoIds(wos, 1)).toEqual([]);
  });

  it("returns all descendants at any depth", () => {
    const wos = [
      { workOrderId: 1, projectId: 1, parentWoId: null, status: "Unreleased" },
      { workOrderId: 2, projectId: 1, parentWoId: 1, status: "Unreleased" },
      { workOrderId: 3, projectId: 1, parentWoId: 2, status: "Unreleased" },
      { workOrderId: 4, projectId: 1, parentWoId: 2, status: "Unreleased" },
    ];
    const result = getDescendantWoIds(wos, 1);
    expect(result.sort()).toEqual([2, 3, 4]);
  });
});

describe("locationSortedProject", () => {
  function makeCand(overrides: Partial<CandidateWO>): CandidateWO {
    return {
      workOrderId: 1,
      projectId: 1,
      projectNumber: "10001",
      partId: 1,
      partNumber: "P-001",
      partName: "Part 1",
      partType: PartType.Part,
      quantity: new Decimal(1),
      stockCount: new Decimal(5),
      dueDate: null,
      topLevelIndex: null,
      parentWoId: null,
      inventoryLocation: null,
      bomPath: [],
      cumulativeDemand: new Decimal(1),
      ...overrides,
    };
  }

  it("top-level WOs sort by topLevelIndex", () => {
    // Realistic IDs: lower topLevelIndex → lower workOrderId (DFS compilation order)
    const candidates = [
      makeCand({ workOrderId: 11, topLevelIndex: 2 }),
      makeCand({ workOrderId: 10, topLevelIndex: 1 }),
    ];
    const sorted = locationSortedProject(candidates);
    expect(sorted.map((c) => c.workOrderId)).toEqual([10, 11]);
  });

  it("child WOs sort by inventoryLocation (nulls last), then workOrderId", () => {
    const candidates = [
      makeCand({ workOrderId: 10, parentWoId: 1, inventoryLocation: "B-02" }),
      makeCand({ workOrderId: 11, parentWoId: 1, inventoryLocation: null }),
      makeCand({ workOrderId: 12, parentWoId: 1, inventoryLocation: "A-01" }),
    ];
    const sorted = locationSortedProject(candidates);
    expect(sorted.map((c) => c.workOrderId)).toEqual([12, 10, 11]);
  });

  it("emits ancestor before descendants (DFS pre-order)", () => {
    // Assembly WO 1 → child WO 2 → grandchild WO 3
    const candidates = [
      makeCand({ workOrderId: 1, topLevelIndex: 1, partType: PartType.Assembly }),
      makeCand({ workOrderId: 2, parentWoId: 1 }),
      makeCand({ workOrderId: 3, parentWoId: 2 }),
    ];
    const sorted = locationSortedProject(candidates);
    expect(sorted.map((c) => c.workOrderId)).toEqual([1, 2, 3]);
  });

  it("orphan candidates (parent not a candidate) group together", () => {
    // Realistic IDs: top-level WO 1, orphan parent is WO 20 (non-candidate), orphan children WOs 21/22.
    // minWoId for orphan group (21) > top-level WO (1), so top-level appears first.
    const candidates = [
      makeCand({ workOrderId: 1, topLevelIndex: 1 }),
      makeCand({ workOrderId: 22, parentWoId: 20, inventoryLocation: "B" }),
      makeCand({ workOrderId: 21, parentWoId: 20, inventoryLocation: "A" }),
    ];
    const sorted = locationSortedProject(candidates);
    // top-level WO 1 first, then orphan group sorted by location (A before B)
    expect(sorted.map((c) => c.workOrderId)).toEqual([1, 21, 22]);
  });
});

// ─── getSfViewData ─────────────────────────────────────────────────────────────

describe("getSfViewData", () => {
  it("returns empty when no active projects", async () => {
    mockPrisma.project.findMany.mockResolvedValue([]);
    const result = await getSfViewData();
    expect(result).toEqual({ candidates: [], projectStats: [] });
  });

  it("excludes WOs where stockFulfillmentReviewedAt is set", async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([{ projectId: 1 }]) // active projects
      .mockResolvedValueOnce([{ projectId: 1, projectNumber: "10001", customerName: null, dueDate: null }]); // meta

    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([
        // unreleased WOs
        {
          workOrderId: 1,
          projectId: 1,
          partId: 1,
          parentWoId: null,
          topLevelIndex: 1,
          quantity: new Decimal(1),
          status: "Unreleased",
          stockFulfillmentReviewedAt: new Date(), // already reviewed
          bomPath: [],
          part: {
            partNumber: "P-001",
            partName: "Part 1",
            partType: PartType.Part,
            stockCount: new Decimal(5),
            inventoryLocation: null,
          },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
      ])
      .mockResolvedValueOnce([]); // all project WOs for descendant check

    const result = await getSfViewData();
    expect(result.candidates).toHaveLength(0);
  });

  it("excludes WOs where stock < demand", async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([{ projectId: 1 }])
      .mockResolvedValueOnce([{ projectId: 1, projectNumber: "10001", customerName: null, dueDate: null }]);

    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([
        {
          workOrderId: 1,
          projectId: 1,
          partId: 1,
          parentWoId: null,
          topLevelIndex: 1,
          quantity: new Decimal(10),
          status: "Unreleased",
          stockFulfillmentReviewedAt: null,
          bomPath: [],
          part: {
            partNumber: "P-001",
            partName: "Part 1",
            partType: PartType.Part,
            stockCount: new Decimal(5), // stock < demand
            inventoryLocation: null,
          },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getSfViewData();
    expect(result.candidates).toHaveLength(0);
  });

  it("competingOnly filter returns only WOs where cumulativeDemand > stockCount", async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([{ projectId: 1 }])
      .mockResolvedValueOnce([{ projectId: 1, projectNumber: "10001", customerName: null, dueDate: null }]);

    const sharedPartId = 42;
    // Two WOs for the same part: stock=5, each demand=3 → cumulative=6 > 5
    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([
        {
          workOrderId: 1,
          projectId: 1,
          partId: sharedPartId,
          parentWoId: null,
          topLevelIndex: 1,
          quantity: new Decimal(3),
          status: "Unreleased",
          stockFulfillmentReviewedAt: null,
          bomPath: [],
          part: {
            partNumber: "P-042",
            partName: "Shared Part",
            partType: PartType.Part,
            stockCount: new Decimal(5),
            inventoryLocation: null,
          },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
        {
          workOrderId: 2,
          projectId: 1,
          partId: sharedPartId,
          parentWoId: null,
          topLevelIndex: 2,
          quantity: new Decimal(3),
          status: "Unreleased",
          stockFulfillmentReviewedAt: null,
          bomPath: [],
          part: {
            partNumber: "P-042",
            partName: "Shared Part",
            partType: PartType.Part,
            stockCount: new Decimal(5),
            inventoryLocation: null,
          },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getSfViewData({ competingOnly: true });
    // Both WOs are competing (cumulative=6 > stock=5)
    expect(result.candidates).toHaveLength(2);
  });

  it("C + P = U invariant holds", async () => {
    mockPrisma.project.findMany
      .mockResolvedValueOnce([{ projectId: 1 }])
      .mockResolvedValueOnce([{ projectId: 1, projectNumber: "10001", customerName: null, dueDate: null }]);

    // 3 Unreleased WOs: 1 candidate (stock ok), 2 non-candidates (no stock)
    mockPrisma.workOrder.findMany
      .mockResolvedValueOnce([
        {
          workOrderId: 1,
          projectId: 1,
          partId: 1,
          parentWoId: null,
          topLevelIndex: 1,
          quantity: new Decimal(1),
          status: "Unreleased",
          stockFulfillmentReviewedAt: null,
          bomPath: [],
          part: { partNumber: "P-001", partName: "A", partType: PartType.Part, stockCount: new Decimal(5), inventoryLocation: null },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
        {
          workOrderId: 2,
          projectId: 1,
          partId: 2,
          parentWoId: null,
          topLevelIndex: 2,
          quantity: new Decimal(10),
          status: "Unreleased",
          stockFulfillmentReviewedAt: null,
          bomPath: [],
          part: { partNumber: "P-002", partName: "B", partType: PartType.Part, stockCount: new Decimal(0), inventoryLocation: null },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
        {
          workOrderId: 3,
          projectId: 1,
          partId: 3,
          parentWoId: null,
          topLevelIndex: 3,
          quantity: new Decimal(5),
          status: "Unreleased",
          stockFulfillmentReviewedAt: new Date(), // already reviewed
          bomPath: [],
          part: { partNumber: "P-003", partName: "C", partType: PartType.Part, stockCount: new Decimal(5), inventoryLocation: null },
          project: { projectNumber: "10001", customerName: null, dueDate: null },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getSfViewData();
    const stats = result.projectStats.find((s) => s.projectId === 1);
    expect(stats).toBeDefined();
    expect(stats!.candidateCount + stats!.pendingReleaseCount).toBe(stats!.unreleasedCount);
    expect(stats!.candidateCount).toBe(1);
    expect(stats!.unreleasedCount).toBe(3);
  });
});

// ─── fulfillFromStock ──────────────────────────────────────────────────────────

describe("fulfillFromStock", () => {
  const AUDIT_ACTION = { auditActionId: 1 };

  function setupAuditActions() {
    mockPrisma.auditAction.findUniqueOrThrow.mockResolvedValue(AUDIT_ACTION);
  }

  function setupTransaction(impl: (tx: unknown) => Promise<unknown>) {
    mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        part: { update: vi.fn().mockResolvedValue({}) },
        workOrderStep: { updateMany: vi.fn().mockResolvedValue({}) },
        workOrder: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });
  }

  it("throws InsufficientStockError when stock < demand at action time", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: null,
      partId: 10,
      quantity: new Decimal(5),
      part: { partId: 10, partNumber: "P-001", partType: PartType.Part, stockCount: new Decimal(3) },
      project: { projectId: 1 },
    });

    await expect(fulfillFromStock(1, 99)).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("throws WOAlreadyReviewedError when reviewedAt is set", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: new Date(),
      partId: 10,
      quantity: new Decimal(1),
      part: { partId: 10, partNumber: "P-001", partType: PartType.Part, stockCount: new Decimal(5) },
      project: { projectId: 1 },
    });

    await expect(fulfillFromStock(1, 99)).rejects.toBeInstanceOf(WOAlreadyReviewedError);
  });

  it("throws WONotUnreleasedError for non-Unreleased WO", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Open",
      stockFulfillmentReviewedAt: null,
      partId: 10,
      quantity: new Decimal(1),
      part: { partId: 10, partNumber: "P-001", partType: PartType.Part, stockCount: new Decimal(5) },
      project: { projectId: 1 },
    });

    await expect(fulfillFromStock(1, 99)).rejects.toBeInstanceOf(WONotUnreleasedError);
  });

  it("throws DescendantCompleteError when a descendant is already Complete", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: null,
      partId: 10,
      quantity: new Decimal(1),
      part: { partId: 10, partNumber: "ASSY-001", partType: PartType.Assembly, stockCount: new Decimal(5) },
      project: { projectId: 1 },
    });

    // WO 2 is a descendant of WO 1 and is Complete
    mockPrisma.workOrder.findMany.mockResolvedValue([
      { workOrderId: 1, projectId: 1, parentWoId: null, status: "Unreleased" },
      { workOrderId: 2, projectId: 1, parentWoId: 1, status: "Complete" },
    ]);

    await expect(fulfillFromStock(1, 99)).rejects.toBeInstanceOf(DescendantCompleteError);
  });

  it("cascades all descendants to Complete for an Assembly WO", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: null,
      partId: 10,
      quantity: new Decimal(1),
      part: { partId: 10, partNumber: "ASSY-001", partType: PartType.Assembly, stockCount: new Decimal(5) },
      project: { projectId: 1 },
    });

    mockPrisma.workOrder.findMany.mockResolvedValue([
      { workOrderId: 1, projectId: 1, parentWoId: null, status: "Unreleased" },
      { workOrderId: 2, projectId: 1, parentWoId: 1, status: "Unreleased" },
      { workOrderId: 3, projectId: 1, parentWoId: 2, status: "Unreleased" },
    ]);

    setupAuditActions();

    let capturedDescendantIds: number[] = [];
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        part: { update: vi.fn().mockResolvedValue({}) },
        workOrderStep: { updateMany: vi.fn().mockResolvedValue({}) },
        workOrder: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockImplementation(({ where }: { where: { workOrderId?: { in?: number[] } } }) => {
            if (where?.workOrderId?.in) {
              capturedDescendantIds = where.workOrderId.in;
            }
            return Promise.resolve({});
          }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const result = await fulfillFromStock(1, 99);
    expect(result.cascadedWoIds.sort()).toEqual([2, 3]);
  });

  it("auto-passes-through WOs for the same part whose demand exceeds new stock", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: null,
      partId: 10,
      quantity: new Decimal(4),
      part: { partId: 10, partNumber: "P-001", partType: PartType.Part, stockCount: new Decimal(5) },
      project: { projectId: 1 },
    });

    // No descendants
    mockPrisma.workOrder.findMany.mockResolvedValue([
      { workOrderId: 1, projectId: 1, parentWoId: null, status: "Unreleased" },
    ]);

    setupAuditActions();

    let capturedAutoPassIds: number[] = [];
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        part: { update: vi.fn().mockResolvedValue({}) },
        workOrderStep: { updateMany: vi.fn().mockResolvedValue({}) },
        workOrder: {
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockImplementation(({ where }: { where: { workOrderId?: { in?: number[] } } }) => {
            if (where?.workOrderId?.in) {
              capturedAutoPassIds = where.workOrderId.in;
            }
            return Promise.resolve({});
          }),
          // WO 99 shares partId 10 and has quantity=2 > newStock=1
          findMany: vi.fn().mockResolvedValue([{ workOrderId: 99, quantity: new Decimal(2) }]),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const result = await fulfillFromStock(1, 99);
    expect(result.autoPassedWoIds).toContain(99);
  });
});

// ─── passThrough ──────────────────────────────────────────────────────────────

describe("passThrough", () => {
  it("throws WOAlreadyReviewedError if already reviewed", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: new Date(),
      partId: 10,
    });
    await expect(passThrough(1, 99)).rejects.toBeInstanceOf(WOAlreadyReviewedError);
  });

  it("stamps reviewedAt and keeps status Unreleased", async () => {
    mockPrisma.workOrder.findUnique.mockResolvedValue({
      workOrderId: 1,
      status: "Unreleased",
      stockFulfillmentReviewedAt: null,
      partId: 10,
    });

    mockPrisma.auditAction.findUniqueOrThrow.mockResolvedValue({ auditActionId: 5 });

    let updatedData: Record<string, unknown> = {};
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workOrder: {
          update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            updatedData = data;
            return Promise.resolve({ workOrderId: 1, status: "Unreleased", stockFulfillmentReviewedAt: data.stockFulfillmentReviewedAt });
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await passThrough(1, 99);
    expect(updatedData.stockFulfillmentReviewedAt).toBeInstanceOf(Date);
    expect(updatedData.status).toBeUndefined(); // status NOT changed
  });
});

// ─── releaseProject ───────────────────────────────────────────────────────────

describe("releaseProject", () => {
  it("releases non-candidate WOs (reviewed and non-reviewed non-candidates) to Open", async () => {
    mockPrisma.auditAction.findUniqueOrThrow.mockResolvedValue({ auditActionId: 7 });

    let releasedWoIds: number[] = [];
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workOrder: {
          findMany: vi.fn()
            .mockResolvedValueOnce([
              // Unreleased WOs: 1 candidate, 2 non-candidates
              {
                workOrderId: 10,
                stockFulfillmentReviewedAt: null,
                quantity: new Decimal(1),
                part: { stockCount: new Decimal(5), partType: PartType.Part },
              },
              {
                workOrderId: 20,
                stockFulfillmentReviewedAt: new Date(), // already reviewed pass-through
                quantity: new Decimal(10),
                part: { stockCount: new Decimal(0), partType: PartType.Part },
              },
              {
                workOrderId: 30,
                stockFulfillmentReviewedAt: null,
                quantity: new Decimal(10),
                part: { stockCount: new Decimal(0), partType: PartType.Part }, // stock < demand → non-candidate
              },
            ])
            .mockResolvedValueOnce([
              // all project WOs for descendant check
              { workOrderId: 10, projectId: 1, parentWoId: null, status: "Unreleased" },
              { workOrderId: 20, projectId: 1, parentWoId: null, status: "Unreleased" },
              { workOrderId: 30, projectId: 1, parentWoId: null, status: "Unreleased" },
            ]),
          updateMany: vi.fn().mockImplementation(({ where, data }: { where: { workOrderId?: { in?: number[] } }; data: Record<string, unknown> }) => {
            if (data.status === "Open" && where?.workOrderId?.in) {
              releasedWoIds = where.workOrderId.in;
            }
            return Promise.resolve({});
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await releaseProject(1, 99);
    expect(releasedWoIds.sort()).toEqual([20, 30]);
    expect(releasedWoIds).not.toContain(10); // candidate stays in SF
  });

  it("does not release WOs that are still candidates (SF-17)", async () => {
    mockPrisma.auditAction.findUniqueOrThrow.mockResolvedValue({ auditActionId: 7 });

    let releasedWoIds: number[] = [];
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        workOrder: {
          findMany: vi.fn()
            .mockResolvedValueOnce([
              // Only one WO, and it is a candidate
              {
                workOrderId: 10,
                stockFulfillmentReviewedAt: null,
                quantity: new Decimal(1),
                part: { stockCount: new Decimal(5), partType: PartType.Part },
              },
            ])
            .mockResolvedValueOnce([
              { workOrderId: 10, projectId: 1, parentWoId: null, status: "Unreleased" },
            ]),
          updateMany: vi.fn().mockImplementation(({ where, data }: { where: { workOrderId?: { in?: number[] } }; data: Record<string, unknown> }) => {
            if (data.status === "Open" && where?.workOrderId?.in) {
              releasedWoIds = where.workOrderId.in;
            }
            return Promise.resolve({});
          }),
        },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await releaseProject(1, 99);
    expect(releasedWoIds).toHaveLength(0);
  });
});
