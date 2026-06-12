import { type NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { archiveProject } from "@/lib/projects/service";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { projectId: rawId } = await params;
    const projectId = parseInt(rawId, 10);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid project ID" } },
        { status: 400 }
      );
    }

    const result = await archiveProject(projectId, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
