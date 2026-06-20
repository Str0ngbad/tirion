import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";
import { UpdatePlannedQtySchema } from "@/lib/batching/schemas";
import { updatePlannedQty } from "@/lib/batching/service";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { batchId: batchIdStr } = await params;
    const batchId = parseInt(batchIdStr, 10);
    if (isNaN(batchId) || batchId <= 0) {
      return NextResponse.json(
        { error: { code: "INVALID_BATCH_ID", message: "batchId must be a positive integer" } },
        { status: 400 }
      );
    }
    const body = await request.json();
    const input = UpdatePlannedQtySchema.parse(body);
    await updatePlannedQty(batchId, input, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
