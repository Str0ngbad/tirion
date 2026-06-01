import { type NextRequest, NextResponse } from "next/server";
import { UpdatePartSchema } from "@/lib/parts/schemas";
import { getPart, updatePart } from "@/lib/parts/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parsePartId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid part ID" } },
  { status: 400 }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const partId = parsePartId(id);
    if (partId === null) return INVALID_ID_RESPONSE;

    const result = await getPart(partId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const partId = parsePartId(id);
    if (partId === null) return INVALID_ID_RESPONSE;

    const input = UpdatePartSchema.parse(await request.json());
    const result = await updatePart(partId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
