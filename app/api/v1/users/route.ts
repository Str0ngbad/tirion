import { type NextRequest, NextResponse } from "next/server";
import { ListUsersQuerySchema, CreateUserSchema } from "@/lib/users/schemas";
import { listUsers, createUser } from "@/lib/users/service";
import { requireUser } from "@/lib/api/auth";
import { handleApiError } from "@/lib/api/errors";

export async function GET(request: NextRequest) {
  try {
    const query = ListUsersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const result = await listUsers(query);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser(request);
    const input = CreateUserSchema.parse(await request.json());
    const result = await createUser(input, userId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
