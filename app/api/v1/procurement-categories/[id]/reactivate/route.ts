import { type NextRequest, NextResponse } from "next/server";
import { reactivateProcurementCategory } from "@/lib/procurement-categories/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseProcurementCategoryId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid procurement category ID" } },
  { status: 400 }
);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const procurementCategoryId = parseProcurementCategoryId(id);
    if (procurementCategoryId === null) return INVALID_ID_RESPONSE;

    const result = await reactivateProcurementCategory(procurementCategoryId, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
