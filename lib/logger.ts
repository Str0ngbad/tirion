import pino from "pino";

/**
 * Shared logger instance for the Tirion application.
 *
 * - In development, output is human-readable (pino-pretty)
 * - In production, output is JSON (one log per line) for Vercel/log aggregators to ingest
 * - Default level is "info"; can be overridden via LOG_LEVEL env var
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("server starting");
 *   logger.error({ err, userId }, "failed to load user");
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  }),
});