import { type NextRequest, NextResponse } from "next/server";
import { ListProcessTypeSubStatusesQuerySchema, CreateProcessTypeSubStatusSchema } from "@/lib/process-type-sub-statuses/schemas";
import { listProcessTypeSubStatuses, createProcessTypeSubStatus } from "@/lib/process-type-sub-statuses/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListProcessTypeSubStatusesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listProcessTypeSubStatuses(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateProcessTypeSubStatusSchema.parse(await request.json());
    const result = await createProcessTypeSubStatus(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
