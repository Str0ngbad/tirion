import { type NextRequest, NextResponse } from "next/server";
import { UpdateVendorSchema } from "@/lib/vendors/schemas";
import { getVendor, updateVendor } from "@/lib/vendors/service";
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

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const vendorId = parseVendorId(id);
    if (vendorId === null) return INVALID_ID_RESPONSE;

    const result = await getVendor(vendorId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const vendorId = parseVendorId(id);
    if (vendorId === null) return INVALID_ID_RESPONSE;

    const input = UpdateVendorSchema.parse(await request.json());
    const result = await updateVendor(vendorId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
