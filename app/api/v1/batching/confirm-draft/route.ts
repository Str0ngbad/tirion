import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";
import { ConfirmDraftSchema } from "@/lib/batching/schemas";
import { confirmDraft } from "@/lib/batching/service";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = await request.json();
    const input = ConfirmDraftSchema.parse(body);
    await confirmDraft(input, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
