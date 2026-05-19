# ADR-002: TypeScript Strict Mode

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

TypeScript was chosen as the project language (ADR-001). TypeScript offers a
spectrum of strictness settings, from permissive (basic type checking) to full
strict mode. The choice of strictness level has outsized impact on a codebase
where the schema contains a large number of enums (WO status, step status,
batch status, process types, audit action types, blocker states, resolution
types, and more) and where the state machine logic — WO state transitions,
cascade behavior, step readiness derivation — is the heart of the system and
carries the most risk if incorrect.

## Decision

`tsconfig.json` has `"strict": true`. The codebase follows a no-any policy:

- The `any` type is not used without an explicit comment explaining why
- Switch statements over enum-typed values use the `never` exhaustive-check
  pattern so that adding an enum member without handling it becomes a compile
  error
- Types are preferred over interfaces; shared types are re-exported from
  `/lib/types`

## Consequences

**Positive:**

- Unhandled enum members fail at compile time rather than silently falling
  through at runtime. This is load-bearing for state machine code where a
  missing case produces incorrect behavior, not a crash.
- Refactoring is safer: renaming an enum value, adding a state, or changing a
  function signature surfaces every affected call site immediately.
- Prisma's generated types compose cleanly with strict TypeScript; no
  casting is needed to work with database results.
- The constraint reduces the surface area of tests required to maintain
  confidence in the state machine logic.

**Negative:**

- Some edges require extra work: shaping external API response types,
  deserializing dynamic JSON from imports or webhooks, interoperating with
  third-party libraries that have incomplete type definitions. These cases
  require explicit `as` casts or `unknown` intermediate types rather than a
  quick `any`.
- The exhaustive-check `never` pattern is unfamiliar to developers who haven't
  used it and must be established as a convention explicitly.
- Strict null checks occasionally force unwrapping that is self-evidently
  safe from context but cannot be proven statically.

## Alternatives considered

- **Standard mode (`strict: false`):** Permits implicit `any`, less null-check
  enforcement. Lower initial friction, but the state machine code loses the
  primary safety guarantee this project needs.
- **Partial strictness (`noImplicitAny` only):** A middle ground, but leaves
  out strict null checks and strictFunctionTypes, which matter for callback
  and higher-order patterns in the business logic layer.
- **Pragmatic `@ts-ignore`/`any` usage without policy:** Commonly used in
  time-pressured codebases. Creates accumulating debt and defeats the purpose
  of the type system where it matters most — state transitions and audit writes.
