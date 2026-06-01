import { type NextRequest, NextResponse } from "next/server";
import { reactivateMaterialSpec } from "@/lib/material-specs/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseMaterialSpecId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid material spec ID" } },
  { status: 400 }
);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const materialSpecId = parseMaterialSpecId(id);
    if (materialSpecId === null) return INVALID_ID_RESPONSE;

    const result = await reactivateMaterialSpec(materialSpecId, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
