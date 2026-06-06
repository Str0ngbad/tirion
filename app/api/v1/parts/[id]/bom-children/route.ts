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
      where: { parentPartId: partId },
      include: {
        childPart: {
          select: {
            partId: true,
            partNumber: true,
            partName: true,
            stockCount: true,
            isActive: true,
          },
        },
      },
      orderBy: { childPart: { partNumber: "asc" } },
    });

    const data = rows.map((r) => {
      const stock = r.childPart.stockCount !== null ? r.childPart.stockCount.toNumber() : 0;
      const qty = r.quantity.toNumber();
      const buildableFromThis = qty > 0 ? Math.floor(stock / qty) : 0;
      return {
        bomId: r.bomId,
        childPartId: r.childPart.partId,
        partNumber: r.childPart.partNumber,
        partName: r.childPart.partName,
        isActive: r.childPart.isActive,
        quantity: qty,
        stockCount: stock,
        buildableFromThis,
      };
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
