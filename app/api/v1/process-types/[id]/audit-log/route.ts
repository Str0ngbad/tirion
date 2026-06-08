import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const processTypeId = Number(id);
    if (!Number.isInteger(processTypeId) || processTypeId <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid process type ID" } },
        { status: 400 }
      );
    }

    const entries = await prisma.auditLog.findMany({
      where: { entityType: "ProcessType", entityId: processTypeId },
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
