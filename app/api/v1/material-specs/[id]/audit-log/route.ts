import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const materialSpecId = Number(id);
    if (!Number.isInteger(materialSpecId) || materialSpecId <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid material spec ID" } },
        { status: 400 }
      );
    }

    const entries = await prisma.auditLog.findMany({
      where: { entityType: "MaterialSpec", entityId: materialSpecId },
      include: {
        action: { select: { actionName: true } },
        changedBy: { select: { userName: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    const data = entries.map((e) => ({
      auditLogId: e.auditLogId,
      actionName: e.action.actionName,
      changedByUserName: e.changedBy.userName,
      timestamp: e.timestamp.toISOString(),
      note: e.note,
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
