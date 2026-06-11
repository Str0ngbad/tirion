import { type NextRequest, NextResponse } from "next/server";
import { compileProject } from "@/lib/projects/service";
import { ProjectCompilationError, ProjectNotDraftError } from "@/lib/errors/project";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ projectId: string }> };

function parseProjectId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid project ID" } },
  { status: 400 }
);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { projectId: rawId } = await params;
    const projectId = parseProjectId(rawId);
    if (projectId === null) return INVALID_ID;

    const result = await compileProject(projectId, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ProjectCompilationError) {
      return NextResponse.json({ failures: err.failures }, { status: 422 });
    }
    if (err instanceof ProjectNotDraftError) {
      return NextResponse.json(
        { error: { code: err.errorCode, message: err.message, details: err.details } },
        { status: 409 }
      );
    }
    return handleApiError(err);
  }
}
