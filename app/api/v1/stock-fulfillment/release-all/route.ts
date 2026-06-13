import { type NextRequest, NextResponse } from "next/server";
import { releaseAll } from "@/lib/stock-fulfillment/service";
import { ReleaseAllSchema } from "@/lib/stock-fulfillment/schemas";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = ReleaseAllSchema.parse(await request.json());
    const result = await releaseAll(userId, body.projectIds);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
