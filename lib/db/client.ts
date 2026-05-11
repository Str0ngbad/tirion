import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Shared Prisma client for the Tirion application.
 *
 * Prisma 7 requires an explicit driver adapter. We use @prisma/adapter-pg
 * with the standard `pg` Postgres driver.
 *
 * In development, the client is stashed on globalThis to survive Next.js
 * hot reloads (which otherwise would create a new instance per file save
 * and exhaust the database's connection limit). In production, no
 * hot-reloading happens, so we instantiate normally.
 */

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}