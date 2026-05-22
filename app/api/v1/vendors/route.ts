import { type NextRequest, NextResponse } from "next/server";
import { ListVendorsQuerySchema, CreateVendorSchema } from "@/lib/vendors/schemas";
import { listVendors, createVendor } from "@/lib/vendors/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListVendorsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listVendors(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateVendorSchema.parse(await request.json());
    const result = await createVendor(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
