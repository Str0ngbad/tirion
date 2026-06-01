import { type NextRequest, NextResponse } from "next/server";
import { UpdateViewSchema } from "@/lib/views/schemas";
import { getView, updateView, deleteView } from "@/lib/views/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseViewId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid view ID" } },
  { status: 400 }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const viewId = parseViewId(id);
    if (viewId === null) return INVALID_ID_RESPONSE;

    const result = await getView(viewId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const viewId = parseViewId(id);
    if (viewId === null) return INVALID_ID_RESPONSE;

    const input = UpdateViewSchema.parse(await request.json());
    const result = await updateView(viewId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const viewId = parseViewId(id);
    if (viewId === null) return INVALID_ID_RESPONSE;

    await deleteView(viewId, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
