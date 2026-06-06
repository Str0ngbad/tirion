import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const partId = Number(id);
    if (!Number.isInteger(partId) || partId <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid part ID" } },
        { status: 400 }
      );
    }

    const entries = await prisma.auditLog.findMany({
      where: { entityType: "Part", entityId: partId },
      include: {
        action: { select: { actionName: true } },
        changedBy: { select: { userName: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 5,
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
