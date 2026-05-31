import { type NextRequest, NextResponse } from "next/server";
import { UpdateProcurementCategorySchema } from "@/lib/procurement-categories/schemas";
import {
  getProcurementCategory,
  updateProcurementCategory,
} from "@/lib/procurement-categories/service";
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const procurementCategoryId = parseProcurementCategoryId(id);
    if (procurementCategoryId === null) return INVALID_ID_RESPONSE;

    const result = await getProcurementCategory(procurementCategoryId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const procurementCategoryId = parseProcurementCategoryId(id);
    if (procurementCategoryId === null) return INVALID_ID_RESPONSE;

    const input = UpdateProcurementCategorySchema.parse(await request.json());
    const result = await updateProcurementCategory(procurementCategoryId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
