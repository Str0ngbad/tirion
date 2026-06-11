import { type NextRequest, NextResponse } from "next/server";
import { ListProjectsQuerySchema, CreateProjectSchema } from "@/lib/projects/schemas";
import { getProjects, createProject } from "@/lib/projects/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams);
    // Support repeated ?status= params
    const statusParam = request.nextUrl.searchParams.getAll("status");
    const query = ListProjectsQuerySchema.parse({
      ...raw,
      status: statusParam.length > 1 ? statusParam : statusParam[0],
    });
    const result = await getProjects(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateProjectSchema.parse(await request.json());
    const result = await createProject(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
