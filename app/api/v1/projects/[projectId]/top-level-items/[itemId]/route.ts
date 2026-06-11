import { type NextRequest, NextResponse } from "next/server";
import { UpdateTopLevelItemSchema } from "@/lib/projects/schemas";
import { updateTopLevelItem, removeTopLevelItem } from "@/lib/projects/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ projectId: string; itemId: string }> };

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid ID" } },
  { status: 400 }
);

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { projectId: rawProjectId, itemId: rawItemId } = await params;
    const projectId = parseId(rawProjectId);
    const itemId = parseId(rawItemId);
    if (projectId === null || itemId === null) return INVALID_ID;

    const input = UpdateTopLevelItemSchema.parse(await request.json());
    const result = await updateTopLevelItem(projectId, itemId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { projectId: rawProjectId, itemId: rawItemId } = await params;
    const projectId = parseId(rawProjectId);
    const itemId = parseId(rawItemId);
    if (projectId === null || itemId === null) return INVALID_ID;

    await removeTopLevelItem(projectId, itemId, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
