import { type NextRequest, NextResponse } from "next/server";
import {
  ListMaterialSpecsQuerySchema,
  CreateMaterialSpecSchema,
} from "@/lib/material-specs/schemas";
import { listMaterialSpecs, createMaterialSpec } from "@/lib/material-specs/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListMaterialSpecsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listMaterialSpecs(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateMaterialSpecSchema.parse(await request.json());
    const result = await createMaterialSpec(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
