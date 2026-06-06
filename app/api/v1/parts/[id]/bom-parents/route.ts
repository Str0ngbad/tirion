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

    const rows = await prisma.bOM.findMany({
      where: { childPartId: partId },
      include: {
        parentPart: { select: { partId: true, partNumber: true, partName: true, isActive: true } },
      },
      orderBy: { parentPart: { partNumber: "asc" } },
    });

    const data = rows.map((r) => ({
      bomId: r.bomId,
      parentPartId: r.parentPart.partId,
      partNumber: r.parentPart.partNumber,
      partName: r.parentPart.partName,
      isActive: r.parentPart.isActive,
      qtyUsed: r.quantity.toNumber(),
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
