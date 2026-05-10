import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capture 100% of transactions for Rev 1
  tracesSampleRate: 1.0,

  // Debug logs in development only
  debug: false,
});