import { type NextRequest, NextResponse } from "next/server";
import { deactivateUser } from "@/lib/users/service";
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

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actorUserId = await requireUser(request);
    const { id } = await params;
    const userId = parseUserId(id);
    if (userId === null) return INVALID_ID_RESPONSE;

    const result = await deactivateUser(userId, actorUserId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
