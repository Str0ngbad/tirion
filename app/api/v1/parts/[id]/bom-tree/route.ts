import { type NextRequest, NextResponse } from "next/server";
import { getBomTree } from "@/lib/bom/service";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const assemblyId = Number(id);
    if (!Number.isInteger(assemblyId) || assemblyId <= 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid part ID" } },
        { status: 400 }
      );
    }

    const tree = await getBomTree(assemblyId);
    return NextResponse.json(tree, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
