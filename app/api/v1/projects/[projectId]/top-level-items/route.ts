import { type NextRequest, NextResponse } from "next/server";
import { AddTopLevelItemSchema } from "@/lib/projects/schemas";
import { addTopLevelItem } from "@/lib/projects/service";
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

    const input = AddTopLevelItemSchema.parse(await request.json());
    const result = await addTopLevelItem(projectId, input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
