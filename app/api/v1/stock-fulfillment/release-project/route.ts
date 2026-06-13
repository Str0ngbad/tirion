import { type NextRequest, NextResponse } from "next/server";
import { releaseProject } from "@/lib/stock-fulfillment/service";
import { ReleaseProjectSchema } from "@/lib/stock-fulfillment/schemas";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const body = ReleaseProjectSchema.parse(await request.json());
    const result = await releaseProject(body.projectId, userId);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
