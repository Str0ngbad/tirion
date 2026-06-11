import { type NextRequest, NextResponse } from "next/server";
import { UpdateProjectSchema } from "@/lib/projects/schemas";
import { getProjectById, updateProject, deleteProject } from "@/lib/projects/service";
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId: rawId } = await params;
    const projectId = parseProjectId(rawId);
    if (projectId === null) return INVALID_ID;

    const result = await getProjectById(projectId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { projectId: rawId } = await params;
    const projectId = parseProjectId(rawId);
    if (projectId === null) return INVALID_ID;

    const input = UpdateProjectSchema.parse(await request.json());
    const result = await updateProject(projectId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { projectId: rawId } = await params;
    const projectId = parseProjectId(rawId);
    if (projectId === null) return INVALID_ID;

    await deleteProject(projectId, userId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleApiError(err);
  }
}
