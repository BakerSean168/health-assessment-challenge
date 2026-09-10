# Decision log

This is a lightweight ADR index for decisions that are important enough to explain but do not require heavyweight architecture-process ceremony.

| ID | Decision | Status | Reason |
|---|---|---|---|
| D001 | Next.js modular monolith | accepted | lowest deployment/integration overhead for three-day scope |
| D002 | PostgreSQL + Prisma | accepted | explicit relational schema and testable persistence |
| D003 | anonymous HttpOnly session | accepted | challenge does not need full account/auth implementation |
| D004 | explicit assessment columns | accepted | small stable field set; clearer schema than JSON blob |
| D005 | semantic step keys | accepted | resilient to branching/reordering |
| D006 | optimistic `revision` | accepted | prevents stale writes and gives concrete concurrency behavior |
| D007 | result snapshot | accepted | historical reproducibility and retry-safe submit |
| D008 | server-side free/full DTO projection | accepted | authorization must not depend on UI hiding |
| D009 | unique payment ID + replay semantics | accepted | simulated payment should be idempotent |
| D010 | outside-in TDD | accepted | requirements become executable before implementation |
| D011 | real Postgres integration tests | planned | persistence/concurrency behavior is central to challenge |
| D012 | intake calculation formula | pending | source brief requires output but does not prescribe formula |
| D013 | target-date rate policy | pending | must be deterministic and explicitly scoped as demo logic |

## D001 — Next.js modular monolith

A split frontend/API deployment would add CORS, deployment, configuration, and integration overhead without improving the behaviors being evaluated. Next.js Route Handlers provide a convenient transport adapter while domain/application code remains framework-independent.

## D004 — Explicit columns, not arbitrary JSON

The assessment has a compact, known data set. Explicit columns improve schema readability, validation, migrations, and test assertions. A dynamic JSON answer model is intentionally deferred until there is a requirement for server-configurable questionnaires.

## D006 — Optimistic concurrency

The challenge explicitly values state consistency and repeated/out-of-order behavior. A revision check is a small mechanism with a concrete test: two clients cannot silently overwrite one another when they started from the same stale version.

## D007 — Result snapshot

Completed assessment results should not change merely because the calculation implementation changes later. Submission therefore creates a versioned snapshot exactly once semantically.

## D008 — Server-side result projection

Free clients should not receive premium values at all. Returning all data and using CSS blur would be a presentation technique, not access control.

## D010 — Outside-in TDD

Architecture provides boundaries; TDD decides the concrete implementation incrementally. This also provides a controlled interface for AI assistance: code must satisfy reviewed behavior rather than letting generated code define requirements implicitly.
