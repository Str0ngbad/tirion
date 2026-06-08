import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProcessTypeDetail, updateProcessType } from "@/lib/process-types/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseProcessTypeId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid process type ID" } },
  { status: 400 }
);

const UpdateProcessTypeSchema = z.object({
  description: z.string().nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const processTypeId = parseProcessTypeId(id);
    if (processTypeId === null) return INVALID_ID_RESPONSE;

    const result = await getProcessTypeDetail(processTypeId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const actorUserId = await requireUser(request);
    const { id } = await params;
    const processTypeId = parseProcessTypeId(id);
    if (processTypeId === null) return INVALID_ID_RESPONSE;

    const input = UpdateProcessTypeSchema.parse(await request.json());
    const result = await updateProcessType(processTypeId, input, actorUserId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
