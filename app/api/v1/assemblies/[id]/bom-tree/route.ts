import { type NextRequest, NextResponse } from "next/server";
import { getBomTree } from "@/lib/bom/service";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseAssemblyId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid assembly ID" } },
  { status: 400 }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const assemblyId = parseAssemblyId(id);
    if (assemblyId === null) return INVALID_ID_RESPONSE;

    const result = await getBomTree(assemblyId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
