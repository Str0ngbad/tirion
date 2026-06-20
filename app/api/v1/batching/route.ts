import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";
import { getBatchingViewData } from "@/lib/batching/service";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const data = await getBatchingViewData();
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
