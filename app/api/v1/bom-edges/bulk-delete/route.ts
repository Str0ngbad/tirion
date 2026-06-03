import { type NextRequest, NextResponse } from "next/server";
import { BulkDeleteSchema } from "@/lib/bom/schemas";
import { bulkDeleteBomEdges } from "@/lib/bom/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = BulkDeleteSchema.parse(await request.json());
    const result = await bulkDeleteBomEdges(input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
