# ADR-007: Vitest over Jest

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

Tirion's testing approach focuses on business logic and transactions — state
machine functions, cascade behavior, AuditLog writes, and multi-write
transactional operations. These tests run against a real database (see
ADR-011), use TypeScript throughout, and need to import application modules
directly. The test runner must handle TypeScript natively, support async
database operations cleanly, and not require a separate transpilation pipeline.

## Decision

Vitest for all unit and integration tests. Configuration lives in
`vitest.config.ts`. Tests import application code directly; no separate build
step is required. The test database connection is configured via environment
variable so test runs don't touch development or production data.

## Consequences

**Positive:**

- Vitest handles TypeScript and ESM natively without Babel or `ts-jest`. Tests
  import application code using the same import paths and resolution that
  Next.js uses, eliminating a class of configuration drift bugs.
- Test execution is meaningfully faster than Jest on equivalent test suites,
  particularly for TypeScript-heavy codebases, because there is no Babel
  transpilation step.
- The `vitest` API is intentionally compatible with Jest's `describe`/`it`/`expect`
  surface. Existing Jest knowledge transfers directly for common patterns.
- The config file is TypeScript, consistent with the rest of the project.

**Negative:**

- Vitest's ecosystem is smaller than Jest's. Some test utilities and mocking
  libraries have Jest-first documentation, and not all have been validated
  against Vitest. Edge cases may require workarounds that a Jest user could
  solve immediately from Stack Overflow.
- Vitest is newer than Jest. Long-term maintenance trajectory is less certain,
  though the project is actively maintained and backed by the Vite team.
- Some Jest-specific APIs (e.g., certain mock timer behaviors, module mock
  hoisting patterns) don't translate directly and require adjustment.

## Alternatives considered

- **Jest:** The incumbent standard, with the largest community, most
  third-party integrations, and most Q&A coverage. Requires `ts-jest` or Babel
  for TypeScript, which adds configuration surface and occasional version
  incompatibilities. The overhead is manageable but adds friction in a
  TypeScript-first project.
- **Node.js built-in test runner (`node:test`):** Available since Node 18,
  zero dependencies. Too minimal for this use case — lacks the assertion
  library, mocking, and watch-mode features that integration tests against a
  real database require.
- **Bun test:** Fast, TypeScript-native, but tied to the Bun runtime. The
  project targets Node.js and Next.js; introducing Bun as a test runner creates
  a runtime split that adds more complexity than it removes.
