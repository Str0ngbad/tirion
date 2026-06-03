import { type NextRequest, NextResponse } from "next/server";
import { CreateBomEdgeSchema } from "@/lib/bom/schemas";
import { createBomEdge } from "@/lib/bom/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateBomEdgeSchema.parse(await request.json());
    const result = await createBomEdge(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
