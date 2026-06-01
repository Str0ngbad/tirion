import { type NextRequest, NextResponse } from "next/server";
import { UpdateUserSchema } from "@/lib/users/schemas";
import { getUser, updateUser } from "@/lib/users/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseUserId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid user ID" } },
  { status: 400 }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = parseUserId(id);
    if (userId === null) return INVALID_ID_RESPONSE;

    const result = await getUser(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actorUserId = await requireUser(request);
    const { id } = await params;
    const userId = parseUserId(id);
    if (userId === null) return INVALID_ID_RESPONSE;

    const input = UpdateUserSchema.parse(await request.json());
    const result = await updateUser(userId, input, actorUserId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
