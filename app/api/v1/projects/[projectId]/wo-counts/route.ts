import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ projectId: string }> };

function parseProjectId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid project ID" } },
  { status: 400 }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId: rawId } = await params;
    const projectId = parseProjectId(rawId);
    if (projectId === null) return INVALID_ID;

    const [total, complete] = await Promise.all([
      prisma.workOrder.count({ where: { projectId } }),
      prisma.workOrder.count({ where: { projectId, status: "Complete" } }),
    ]);

    return NextResponse.json({ total, complete }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
