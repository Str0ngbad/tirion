import { type NextRequest, NextResponse } from "next/server";
import { GridQueryBodySchema } from "@/lib/grids/schemas";
import { queryPartsGrid } from "@/lib/parts/service";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const body = GridQueryBodySchema.parse(await request.json());
    const result = await queryPartsGrid(body);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
