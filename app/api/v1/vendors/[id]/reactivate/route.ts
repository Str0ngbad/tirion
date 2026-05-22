import { type NextRequest, NextResponse } from "next/server";
import { reactivateVendor } from "@/lib/vendors/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseVendorId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid vendor ID" } },
  { status: 400 }
);

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const vendorId = parseVendorId(id);
    if (vendorId === null) return INVALID_ID_RESPONSE;

    const result = await reactivateVendor(vendorId, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
