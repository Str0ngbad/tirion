import { type NextRequest, NextResponse } from "next/server";
import { ListPartsQuerySchema, CreatePartSchema } from "@/lib/parts/schemas";
import { listParts, createPart } from "@/lib/parts/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListPartsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listParts(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreatePartSchema.parse(await request.json());
    const result = await createPart(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
