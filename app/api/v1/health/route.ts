import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/v1/health
 *
 * Health check endpoint. Returns 200 OK with basic application state.
 * Used by Vercel, monitoring tools, and deployment health checks to
 * confirm the service is alive.
 *
 * Response shape:
 *   {
 *     ok: true,
 *     timestamp: ISO 8601 string,
 *     version: string from package.json
 *   }
 */
export async function GET() {
  logger.info("health check requested");

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "unknown",
  });
}