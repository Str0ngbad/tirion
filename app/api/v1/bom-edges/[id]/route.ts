import { type NextRequest, NextResponse } from "next/server";
import { UpdateBomEdgeSchema } from "@/lib/bom/schemas";
import { updateBomEdge, deleteBomEdge } from "@/lib/bom/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseEdgeId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid BOM edge ID" } },
  { status: 400 }
);

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const edgeId = parseEdgeId(id);
    if (edgeId === null) return INVALID_ID_RESPONSE;

    const input = UpdateBomEdgeSchema.parse(await request.json());
    const result = await updateBomEdge(edgeId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const edgeId = parseEdgeId(id);
    if (edgeId === null) return INVALID_ID_RESPONSE;

    await deleteBomEdge(edgeId, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
