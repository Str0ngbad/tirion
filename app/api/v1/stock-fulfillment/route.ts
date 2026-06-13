import { type NextRequest, NextResponse } from "next/server";
import { getSfViewData } from "@/lib/stock-fulfillment/service";
import { SfFiltersSchema } from "@/lib/stock-fulfillment/schemas";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);

    const { searchParams } = new URL(request.url);
    const rawFilters = SfFiltersSchema.safeParse({
      projectId: searchParams.get("projectId") ?? undefined,
      competingOnly: searchParams.get("competingOnly") ?? undefined,
    });

    const filters = rawFilters.success ? rawFilters.data : {};

    const data = await getSfViewData(
      filters as { projectId?: number; competingOnly?: boolean }
    );
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
