# ADR-005: Pino for Structured Logging

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

`console.log` is not viable for production observability. Log output needs to
be machine-parseable so it can be ingested by log aggregators (Vercel log
drain, Datadog, Logtail, or similar). It also needs human-readable output in
development without changing application code. The logging library should have
minimal overhead, since it runs in every request path.

## Decision

Pino for all application logging. In production, Pino outputs newline-delimited
JSON. In development, `pino-pretty` formats the same output as readable,
color-coded text. Log level defaults to `info` in production and `debug` in
development, controlled via environment variable. A shared logger instance is
initialized once and imported throughout the application.

## Consequences

**Positive:**

- JSON log output is structured by default. Fields like `level`, `time`, `msg`,
  and any additional context are individually queryable in log aggregation tools
  without custom parsing.
- Pino is consistently benchmarked as the fastest Node.js logging library.
  The serialization overhead per log statement is low enough to use liberally
  in request handlers.
- `pino-pretty` gives a good development experience without any code-path
  differences between dev and production. The same logger instance is used
  everywhere; output format is determined by environment configuration.
- Pino is widely used in Next.js + Node.js applications. Setup patterns are
  well-documented.

**Negative:**

- Requires configuration for the Next.js edge runtime, which does not support
  all Node.js APIs Pino relies on. Any logging in edge-deployed route handlers
  needs attention. This is not a Rev 1 issue since no routes target the edge
  runtime, but it constrains future choices.
- `pino-pretty` is a development dependency that must be kept separate from the
  production bundle. Small discipline cost.
- Developers accustomed to `console.log` must import and use the shared logger
  instance instead. Stray `console.log` statements in committed code produce
  unstructured output that bypasses log configuration.

## Alternatives considered

- **Winston:** Feature-rich, highly configurable, large ecosystem of transports.
  Heavier than Pino and slower per benchmark. The configurability is overhead
  Tirion doesn't need; Pino covers the actual requirements with less complexity.
- **`console.log` / `console.error`:** Zero setup. Output is unstructured,
  cannot be configured by log level, and is not queryable. Acceptable for a
  prototype; not acceptable for a production-tracked application.
- **Bunyan:** Pino's predecessor and an influence on its design. Less actively
  maintained than Pino. No meaningful advantage over Pino for this use case.
