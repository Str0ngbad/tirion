# ADR-006: Sentry for Error Tracking

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

Structured logs (ADR-005) capture what the application records deliberately.
Unhandled errors and uncaught exceptions in a Next.js deployment are invisible
without a separate error tracking layer — they either fail silently or produce
opaque 500 responses. A production application that the user plans to use for
real manufacturing operations needs real-time visibility when something breaks
unexpectedly.

## Decision

Sentry, initialized via the `@sentry/nextjs` SDK. The DSN is stored in
environment variables. Source maps are uploaded at build time so production
stack traces reference original TypeScript source, not compiled output. A test
error was deliberately thrown during Phase 0 setup to verify end-to-end capture.

## Consequences

**Positive:**

- Unhandled exceptions surface in the Sentry dashboard immediately, with full
  stack traces, request context, and environment metadata. No manual log
  scanning required to find production errors.
- Source maps make stack traces readable. Without them, minified production
  output makes errors difficult to locate.
- Sentry's free tier (error volume limits, 30-day retention) is sufficient for
  Rev 1 usage and the user base.
- The `@sentry/nextjs` SDK handles both server-side and client-side error
  capture with a single integration, including App Router instrumentation.

**Negative:**

- The Sentry Next.js SDK integration added non-trivial setup friction during
  Phase 0. Source map upload configuration is sensitive to the Next.js version
  and Sentry SDK version; we encountered a configuration mismatch that required
  debugging before the test error appeared correctly in the dashboard.
- Sentry injects client-side JavaScript into the bundle. The impact is small
  but not zero.
- The SDK wraps Next.js internals to intercept errors. SDK upgrades sometimes
  require reconfiguration when Next.js makes changes to the instrumentation
  surface.
- Error volume in a future high-usage scenario could exhaust free-tier limits,
  requiring a paid plan.

## Alternatives considered

- **Bugsnag:** Comparable feature set, similar Next.js integration. Smaller
  community and fewer documented Next.js-specific patterns than Sentry. No
  functional reason to prefer it.
- **Datadog APM:** Full observability platform covering traces, metrics, and
  logs in addition to errors. Cost and operational complexity are not justified
  by Rev 1's scale. Sentry covers the primary need — knowing when an unhandled
  error occurs.
- **Self-hosted error logging (structured logs only):** Possible using Pino
  to log errors to a log aggregator. Requires building alerting on top; has no
  built-in grouping, deduplication, or resolution workflow. More work for less
  capability.
