import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";

describe("Database connectivity", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("can connect to the database and run a trivial query", async () => {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
    expect(result).toEqual([{ ok: 1 }]);
  });

  it("can read the Part table (expects empty initially)", async () => {
    const parts = await prisma.part.findMany();
    expect(Array.isArray(parts)).toBe(true);
  });
});