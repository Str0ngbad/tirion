import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production: 1.0 captures 100% of transactions.
  // For Rev 1 with low traffic, full capture is fine.
  tracesSampleRate: 1.0,

  // Show debug info in the browser console when developing
  debug: false,

  // Set to true if you want to capture Replay session data (we're skipping for Rev 1)
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
});