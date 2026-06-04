import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const processTypes = await prisma.processType.findMany({
    where: { isActive: true },
    select: { processTypeId: true, processName: true, processCode: true },
    orderBy: { processName: "asc" },
  });

  return NextResponse.json({ data: processTypes });
}
