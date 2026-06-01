import { type NextRequest, NextResponse } from "next/server";
import { deactivateProcessTypeSubStatus } from "@/lib/process-type-sub-statuses/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseProcessTypeSubStatusId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid process type sub-status ID" } },
  { status: 400 }
);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const actorUserId = await requireUser(request);
    const { id } = await params;
    const processTypeSubStatusId = parseProcessTypeSubStatusId(id);
    if (processTypeSubStatusId === null) return INVALID_ID_RESPONSE;

    const result = await deactivateProcessTypeSubStatus(processTypeSubStatusId, actorUserId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
