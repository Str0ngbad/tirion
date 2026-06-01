import { type NextRequest, NextResponse } from "next/server";
import { ListRoutingTemplatesQuerySchema, CreateRoutingTemplateSchema } from "@/lib/routing-templates/schemas";
import { listRoutingTemplates, createRoutingTemplate } from "@/lib/routing-templates/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListRoutingTemplatesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listRoutingTemplates(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateRoutingTemplateSchema.parse(await request.json());
    const result = await createRoutingTemplate(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
