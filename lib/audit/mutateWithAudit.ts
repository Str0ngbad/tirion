import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

// The shape returned by the work callback. The helper uses entityId,
// previousValue, and newValue to write the AuditLog; it returns result
// to the caller.
type AuditedWorkResult<T> = {
  entityId: number;
  previousValue: Prisma.InputJsonValue | null;
  newValue: Prisma.InputJsonValue | null;
  result: T;
};

type MutateWithAuditOptions<T> = {
  userId: number;
  entityType: string;
  // The actionName must match a row in the AuditAction lookup table
  // (e.g., "VendorCreated", "VendorUpdated", "VendorDeactivated").
  action: string;
  note?: string;
  work: (tx: Prisma.TransactionClient) => Promise<AuditedWorkResult<T>>;
};

export async function mutateWithAudit<T>(
  options: MutateWithAuditOptions<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // 1. Resolve the action name to an auditActionId. Throw loud if the
    //    action isn't seeded — this is a programming error, not a user error.
    const auditAction = await tx.auditAction.findUnique({
      where: { actionName: options.action },
    });

    if (auditAction === null) {
      throw new Error(`AuditAction not found for action: ${options.action}`);
    }

    // 2. Run the caller's work inside the same transaction.
    const { entityId, previousValue, newValue, result } =
      await options.work(tx);

    // 3. Write the AuditLog entry in the same transaction.
    //    Null previousValue/newValue map to DB NULL via Prisma.DbNull.
    await tx.auditLog.create({
      data: {
        entityType: options.entityType,
        entityId,
        auditActionId: auditAction.auditActionId,
        changedByUserId: options.userId,
        previousValue: previousValue !== null ? previousValue : Prisma.DbNull,
        newValue: newValue !== null ? newValue : Prisma.DbNull,
        note: options.note,
      },
    });

    // 4. Return the work result to the caller.
    return result;
  });
}
