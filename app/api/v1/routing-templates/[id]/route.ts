import { type NextRequest, NextResponse } from "next/server";
import { UpdateRoutingTemplateSchema } from "@/lib/routing-templates/schemas";
import { getRoutingTemplate, updateRoutingTemplate } from "@/lib/routing-templates/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

type RouteParams = { params: Promise<{ id: string }> };

function parseTemplateId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const INVALID_ID_RESPONSE = NextResponse.json(
  { error: { code: "VALIDATION_ERROR", message: "Invalid routing template ID" } },
  { status: 400 }
);

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const templateId = parseTemplateId(id);
    if (templateId === null) return INVALID_ID_RESPONSE;

    const result = await getRoutingTemplate(templateId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUser(request);
    const { id } = await params;
    const templateId = parseTemplateId(id);
    if (templateId === null) return INVALID_ID_RESPONSE;

    const input = UpdateRoutingTemplateSchema.parse(await request.json());
    const result = await updateRoutingTemplate(templateId, input, userId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}
