import { type NextRequest, NextResponse } from "next/server";
import { validateProject } from "@/lib/projects/service";
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

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId: rawId } = await params;
    const projectId = parseProjectId(rawId);
    if (projectId === null) return INVALID_ID;

    const failures = await validateProject(projectId);
    return NextResponse.json(
      { valid: failures.length === 0, failures },
      { status: 200 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
