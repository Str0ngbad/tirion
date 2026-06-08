import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reorderProcessTypeSubStatuses } from "@/lib/process-type-sub-statuses/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

const ReorderRequestSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.number().int().positive(),
        displayOrder: z.number().int().min(1),
      })
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = ReorderRequestSchema.parse(await request.json());
    await reorderProcessTypeSubStatuses(body.updates, userId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
