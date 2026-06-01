import { type NextRequest, NextResponse } from "next/server";
import { CreateViewSchema } from "@/lib/views/schemas";
import { listViews, createView } from "@/lib/views/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const result = await listViews();
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateViewSchema.parse(await request.json());
    const result = await createView(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
