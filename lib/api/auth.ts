import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { UserRequiredError, UserNotFoundError } from "@/lib/errors/auth";

export async function requireUser(request: NextRequest): Promise<number> {
  const header = request.headers.get("x-user-id");

  if (!header) throw new UserRequiredError();

  const userId = parseInt(header, 10);
  if (isNaN(userId)) throw new UserRequiredError();

  const user = await prisma.user.findFirst({
    where: { userId, isActive: true },
    select: { userId: true },
  });

  if (!user) throw new UserNotFoundError(userId);

  return userId;
}
