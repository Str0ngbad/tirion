# ADR-008: Manual User Selection in Rev 1, No Authentication

**Status:** Accepted
**Date:** 2026-05-19
**Phase:** 0

## Context

Tirion's operations require user identity for two purposes: enforcing role-based
access (some actions are Manager/Admin-only) and attributing AuditLog entries
to a specific person. Real authentication — session management, password
hashing, JWTs, OAuth — adds significant scope and is not the core value being
built in Rev 1. The initial user base is a single known shop with a small team
operating the application in a controlled environment.

Authentication is listed explicitly as out of scope for Rev 1 in the spec
corpus.

## Decision

Rev 1 uses manual user selection: the application presents a user picker at
session start, and the selected user identity is passed to the API via an
`X-User-Id` header. The API trusts this value without verification. Role
checks (Manager/Admin gates) are enforced server-side based on the selected
user's role in the database, but nothing prevents a user from selecting a
different identity.

## Consequences

**Positive:**

- Authentication scope is eliminated from Rev 1. This removes weeks of
  implementation work — session management, password flows, token refresh,
  account recovery — that would otherwise delay the operational features that
  deliver the actual value.
- The AuditLog writes user identity on every state change. The mechanism is
  in place; in Rev 2, the identity source changes from a trusted header to a
  verified session without changing the AuditLog structure.
- Role-based access enforcement at the API layer is implemented and exercised
  in Rev 1. The authorization logic does not need to be rebuilt for Rev 2 —
  only the authentication layer changes beneath it.

**Negative:**

- The application is not production-suitable without network-level controls
  (VPN, IP allowlist, or similar) restricting access to trusted users. A bad
  actor with network access can impersonate any user.
- AuditLog attribution is only as honest as the client. A user who selects
  another person's identity produces audit entries under that person's name.
  For the Rev 1 use case (small known team, internal tooling), this is
  accepted.
- Rev 2 must add real authentication. The retrofit will touch session
  middleware, environment configuration, and the user selection UI flow.

## Alternatives considered

- **NextAuth.js (Auth.js):** Covers OAuth, credential, and email login with
  solid Next.js integration. Adds meaningful scope — database session tables,
  provider configuration, callback handling. Not justified for a single-shop
  internal tool in Rev 1.
- **Clerk:** Third-party auth SaaS with a generous free tier and prebuilt UI
  components. Adds a vendor dependency and couples the identity model to
  Clerk's data structures. The trade-off is not worth it given the explicit
  deferral decision in the spec.
- **Hardcoded user in development, no selection UI:** Even simpler than
  manual selection, but loses the role-switching capability needed to test
  Manager/Admin-only flows without code changes.
