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

    const wos = await prisma.workOrder.findMany({
      where: {
        partId,
        status: { in: ["Open", "Unreleased"] },
      },
      include: {
        project: { select: { projectNumber: true, projectName: true } },
      },
      orderBy: [{ priority: "asc" }, { workOrderId: "asc" }],
    });

    const data = wos.map((wo) => ({
      workOrderId: wo.workOrderId,
      projectNumber: wo.project.projectNumber,
      projectName: wo.project.projectName,
      status: wo.status,
      quantity: wo.quantity.toNumber(),
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
