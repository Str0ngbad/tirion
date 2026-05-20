# Security Notes

This document captures security-relevant decisions and known issues for
the Tirion project. Each entry includes the issue, the analysis of
exploitability in our deployment context, and the decision.

When `npm audit` reports new vulnerabilities, the discipline is:

1. Identify the specific vulnerable package and its affected version range.
2. Determine whether we depend on it directly or transitively.
3. Trace the code path: where does the vulnerable code actually run in our
   deployment? Production runtime? Build time only? Dev tooling only?
4. Determine whether attacker-controlled input can reach the vulnerable
   code path.
5. Document the decision: accept (with rationale), patch, or downgrade.

A vulnerability rating from `npm audit` is a starting point, not a verdict.

---

## Accepted Vulnerabilities

### @hono/node-server middleware bypass via repeated slashes

**CVE / Advisory:** middleware bypass via repeated slashes in `serveStatic`
**Affected:** `@hono/node-server < 1.19.13`
**How we pull it in:** transitively, via `@prisma/dev` → `prisma >= 6.20.0-dev.1`
**Exploitability in Tirion:** none. `@prisma/dev` is a development-time CLI
package, not deployed to production. The vulnerable middleware never runs
in our deployed application.
**Recommended npm fix:** downgrade Prisma to 6.19.3 — rejected as a
breaking change with no real security benefit for our usage.
**Decision:** accepted. Reassess when Prisma updates the transitive dependency.
**Date:** 2026-05-20

### postcss XSS via unescaped CSS stringify

**CVE / Advisory:** XSS via unescaped `</style>` in CSS stringify output
**Affected:** `postcss < 8.5.10`
**How we pull it in:** transitively, via Next.js's bundled postcss
**Exploitability in Tirion:** none. postcss runs at build time against CSS
files in our repository. There is no attacker-controlled input path to
the build process. The vulnerability would require an attacker to inject
crafted CSS into our source tree, at which point CSS injection is the
least of our problems.
**Recommended npm fix:** downgrade Next.js to 9.3.3 — rejected as
catastrophically out-of-date.
**Decision:** accepted. Reassess when Next.js updates the bundled postcss.
**Date:** 2026-05-20
