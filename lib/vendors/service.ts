import { Prisma, SupplyOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { mutateWithAudit } from "@/lib/audit/mutateWithAudit";
import {
  VendorNotFoundError,
  VendorAlreadyActiveError,
  VendorAlreadyInactiveError,
  VendorNameCollisionError,
  VendorDeactivationBlockedError,
} from "@/lib/errors/vendor";
import type {
  ListVendorsQuery,
  CreateVendorInput,
  UpdateVendorInput,
  VendorWithCounts,
} from "@/lib/vendors/types";

// Internal shape of Prisma's return when requesting vendor _count with filters.
type VendorWithCountsRaw = {
  vendorId: number;
  vendorName: string;
  contactInfo: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  _count: {
    parts: number;
    supplyOrders: number;
  };
};

function toVendorWithCounts(raw: VendorWithCountsRaw): VendorWithCounts {
  return {
    vendorId: raw.vendorId,
    vendorName: raw.vendorName,
    contactInfo: raw.contactInfo,
    leadTimeDays: raw.leadTimeDays,
    notes: raw.notes,
    isActive: raw.isActive,
    defaultVendorForCount: raw._count.parts,
    openSupplyOrderCount: raw._count.supplyOrders,
  };
}

// Shared list of Supply Order statuses that count as "open".
// See spec: configuration_management_spec.md Vendor Management — Grid Columns.
const OPEN_SO_STATUSES = [SupplyOrderStatus.Ordered, SupplyOrderStatus.PartialReceived];

async function fetchWithCounts(
  tx: Prisma.TransactionClient,
  vendorId: number
): Promise<VendorWithCountsRaw> {
  return tx.vendor.findUniqueOrThrow({
    where: { vendorId },
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
          supplyOrders: { where: { status: { in: OPEN_SO_STATUSES } } },
        },
      },
    },
  });
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function listVendors(query: ListVendorsQuery): Promise<VendorWithCounts[]> {
  let where: Prisma.VendorWhereInput;

  switch (query.active) {
    case "true":
      where = { isActive: true };
      break;
    case "false":
      where = { isActive: false };
      break;
    case "all":
      where = {};
      break;
    default: {
      const _exhaustive: never = query.active;
      throw new Error(`Unhandled active filter: ${String(_exhaustive)}`);
    }
  }

  const rows = await prisma.vendor.findMany({
    where,
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
          supplyOrders: { where: { status: { in: OPEN_SO_STATUSES } } },
        },
      },
    },
    orderBy: { vendorName: "asc" },
  });

  return rows.map(toVendorWithCounts);
}

export async function getVendor(vendorId: number): Promise<VendorWithCounts> {
  const raw = await prisma.vendor.findUnique({
    where: { vendorId },
    include: {
      _count: {
        select: {
          parts: { where: { isActive: true } },
          supplyOrders: { where: { status: { in: OPEN_SO_STATUSES } } },
        },
      },
    },
  });

  if (raw === null) throw new VendorNotFoundError(vendorId);

  return toVendorWithCounts(raw);
}

export async function createVendor(
  input: CreateVendorInput,
  userId: number
): Promise<VendorWithCounts> {
  try {
    return await mutateWithAudit<VendorWithCounts>({
      userId,
      entityType: "Vendor",
      action: "VendorCreated",
      work: async (tx) => {
        const created = await tx.vendor.create({
          data: {
            vendorName: input.vendorName,
            contactInfo: input.contactInfo ?? null,
            leadTimeDays: input.leadTimeDays ?? null,
            notes: input.notes ?? null,
          },
        });

        const result: VendorWithCounts = {
          vendorId: created.vendorId,
          vendorName: created.vendorName,
          contactInfo: created.contactInfo,
          leadTimeDays: created.leadTimeDays,
          notes: created.notes,
          isActive: created.isActive,
          defaultVendorForCount: 0,
          openSupplyOrderCount: 0,
        };

        return {
          entityId: created.vendorId,
          previousValue: null,
          newValue: {
            vendorName: created.vendorName,
            contactInfo: created.contactInfo,
            leadTimeDays: created.leadTimeDays,
            notes: created.notes,
            isActive: created.isActive,
          },
          result,
        };
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) throw new VendorNameCollisionError(input.vendorName);
    throw err;
  }
}

export async function updateVendor(
  vendorId: number,
  input: UpdateVendorInput,
  userId: number
): Promise<VendorWithCounts> {
  try {
    return await mutateWithAudit<VendorWithCounts>({
      userId,
      entityType: "Vendor",
      action: "VendorUpdated",
      work: async (tx) => {
        const vendor = await tx.vendor.findUnique({ where: { vendorId } });
        if (vendor === null) throw new VendorNotFoundError(vendorId);

        const previousValue = {
          vendorName: vendor.vendorName,
          contactInfo: vendor.contactInfo,
          leadTimeDays: vendor.leadTimeDays,
          notes: vendor.notes,
        };

        await tx.vendor.update({ where: { vendorId }, data: input });

        const refreshed = await fetchWithCounts(tx, vendorId);
        const result = toVendorWithCounts(refreshed);

        return {
          entityId: vendorId,
          previousValue,
          newValue: {
            vendorName: refreshed.vendorName,
            contactInfo: refreshed.contactInfo,
            leadTimeDays: refreshed.leadTimeDays,
            notes: refreshed.notes,
          },
          result,
        };
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new VendorNameCollisionError(input.vendorName ?? "");
    }
    throw err;
  }
}

export async function deactivateVendor(
  vendorId: number,
  userId: number
): Promise<VendorWithCounts> {
  return mutateWithAudit<VendorWithCounts>({
    userId,
    entityType: "Vendor",
    action: "VendorDeactivated",
    work: async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { vendorId } });
      if (vendor === null) throw new VendorNotFoundError(vendorId);
      if (!vendor.isActive) throw new VendorAlreadyInactiveError(vendorId);

      const blockingParts = await tx.part.findMany({
        where: { defaultVendorId: vendorId, isActive: true },
        select: { partId: true, partNumber: true },
      });

      if (blockingParts.length > 0) throw new VendorDeactivationBlockedError(blockingParts);

      await tx.vendor.update({ where: { vendorId }, data: { isActive: false } });

      const refreshed = await fetchWithCounts(tx, vendorId);
      return {
        entityId: vendorId,
        previousValue: { isActive: true },
        newValue: { isActive: false },
        result: toVendorWithCounts(refreshed),
      };
    },
  });
}

export async function reactivateVendor(
  vendorId: number,
  userId: number
): Promise<VendorWithCounts> {
  return mutateWithAudit<VendorWithCounts>({
    userId,
    entityType: "Vendor",
    action: "VendorReactivated",
    work: async (tx) => {
      const vendor = await tx.vendor.findUnique({ where: { vendorId } });
      if (vendor === null) throw new VendorNotFoundError(vendorId);
      if (vendor.isActive) throw new VendorAlreadyActiveError(vendorId);

      await tx.vendor.update({ where: { vendorId }, data: { isActive: true } });

      const refreshed = await fetchWithCounts(tx, vendorId);
      return {
        entityId: vendorId,
        previousValue: { isActive: false },
        newValue: { isActive: true },
        result: toVendorWithCounts(refreshed),
      };
    },
  });
}
