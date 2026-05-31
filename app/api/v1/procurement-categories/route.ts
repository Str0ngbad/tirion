import { type NextRequest, NextResponse } from "next/server";
import {
  ListProcurementCategoriesQuerySchema,
  CreateProcurementCategorySchema,
} from "@/lib/procurement-categories/schemas";
import {
  listProcurementCategories,
  createProcurementCategory,
} from "@/lib/procurement-categories/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListProcurementCategoriesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listProcurementCategories(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateProcurementCategorySchema.parse(await request.json());
    const result = await createProcurementCategory(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
