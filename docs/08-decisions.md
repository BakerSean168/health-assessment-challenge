# Decision log

This is a lightweight ADR index for decisions that are important enough to explain but do not require heavyweight architecture-process ceremony.

| ID | Decision | Status | Reason |
|---|---|---|---|
| D001 | Next.js modular monolith | accepted | lowest deployment/integration overhead for three-day scope |
| D002 | PostgreSQL + Prisma | accepted | explicit relational schema and testable persistence |
| D003 | anonymous HttpOnly session | accepted | challenge does not need full account/auth implementation |
| D004 | explicit assessment columns | accepted | small stable field set; clearer schema than JSON blob |
| D005 | semantic answer-step keys, derived progress | accepted | persist facts once; avoid `currentStepKey` drift and keep branching/reordering possible |
| D006 | optimistic aggregate `revision` | accepted | prevents stale writes and stale first-time submission |
| D007 | result snapshot | accepted | historical reproducibility and retry-safe submit |
| D008 | server-side free/full DTO projection | accepted | authorization must not depend on UI hiding |
| D009 | session-scoped payment `idempotencyKey` | accepted | simulated payment should be replay-safe without pretending to have a provider payment ID |
| D010 | outside-in TDD | accepted | requirements become executable before implementation |
| D011 | real Postgres integration tests | accepted | persistence/concurrency behavior is central to challenge |
| D012 | one assessment per anonymous session in v1 | accepted | history/restart is outside the challenge and should not enlarge the aggregate prematurely |
| D013 | target weight required in v1 | accepted | source scope names target weight and projection depends on it; avoid speculative branching |
| D014 | `Float` for physical measurements/result BMI | accepted | financial precision is not required; simpler TS/JSON boundary than Prisma `Decimal` |
| D015 | strict stale PATCH semantics | accepted | a stale write returns conflict even if the value matches; idempotency is reserved for explicit submit/payment retry contracts |
| D016 | shadcn/ui + Base UI, library-first component policy | accepted | use maintained accessible primitives as the shared baseline, then customize/compose locally to keep UI consistent and avoid duplicate primitives |
| D017 | intake calculation formula | pending | source brief requires output but does not prescribe formula |
| D018 | target-date rate policy | pending | must be deterministic and explicitly scoped as demo logic |
| D019 | scalar assessment input bounds | accepted | freeze runtime-validation boundaries in tests while keeping them explicitly separate from source requirements and cross-field health logic |

## D001 — Next.js modular monolith

A split frontend/API deployment would add CORS, deployment, configuration, and integration overhead without improving the behaviors being evaluated. Next.js Route Handlers provide a convenient transport adapter while domain/application code remains framework-independent.


## D002 — Prisma 7 and PostgreSQL adapter

The implementation uses Prisma ORM 7.10 with the `prisma-client` generator and `@prisma/adapter-pg`/`pg`. Integration tests use a disposable PostgreSQL 17 container, not a mocked Prisma client. The generated client is build output rather than reviewed source: it is ignored by git and regenerated during a fresh package install.

The test database is intentionally separate from any production/hosted database and uses committed migrations as the source of truth.

## D003 — Anonymous HttpOnly session

The challenge does not need account registration or password authentication. A random UUID stored in `health_assessment_session` acts as the anonymous bearer session identifier. It is issued only by the server in a 30-day HttpOnly cookie with `SameSite=Lax`, `Path=/`, and `Secure` in production.

The client cannot authorize access by sending a `sessionId` field. Missing, malformed, or unknown cookie values result in a newly created server-owned session. Session creation also creates the single v1 assessment so later routes do not need to choose among multiple active assessments.

## D004 — Explicit columns, not arbitrary JSON

The assessment has a compact, known data set. Explicit columns improve schema readability, validation, migrations, and test assertions. A dynamic JSON answer model is intentionally deferred until there is a requirement for server-configurable questionnaires.

## D005 — Persist answers, derive progress

The persisted facts are the answers themselves. Storing both answers and a mutable `currentStepKey` would represent progress twice and permit drift. `getNextRequiredStep(assessment)` instead scans semantic step definitions and returns the first missing or context-invalid answer.

This also handles dependency changes safely: editing `goal` or current weight may make a previously entered target weight invalid, so the resolver can move the user back to `TARGET_WEIGHT` without deleting unrelated valid answers. `ANALYZING`, wellness profile, projection, result, and paywall are presentation/result states rather than answer steps.

## D006 — Optimistic aggregate concurrency

`revision` belongs to the assessment aggregate, not just individual fields. Answer writes require `expectedRevision`; the first successful submit does as well. A successful aggregate mutation increments revision.

A stale answer PATCH is always a `409 ASSESSMENT_VERSION_CONFLICT`, including when the stale client sends the same value. Hiding that conflict would make the concurrency guarantee ambiguous.

For submit retries, completed-result detection is checked first: if the first submit succeeded but its response was lost, retry returns the existing canonical result rather than failing solely because the completion mutation advanced revision.

## D007 — Result snapshot

Completed assessment results should not change merely because the calculation implementation changes later. Submission therefore creates a versioned snapshot exactly once semantically. Result creation and aggregate completion must happen atomically.

## D008 — Server-side result projection

Free clients should not receive premium values at all. Returning all data and using CSS blur would be a presentation technique, not access control.

## D009 — Payment idempotency key

The challenge uses a simulated payment endpoint. `PaymentEvent` therefore stores a caller-provided `idempotencyKey` unique within the current anonymous session instead of claiming that a demo token is a real payment-provider ID. Replaying the same key returns the existing outcome without repeating the subscription side effect.

## D012 — One assessment per anonymous session

The v1 relationship is `AnonymousSession 1:1 Assessment`, enforced with a unique `Assessment.sessionId`. Restart/history behavior is intentionally deferred because the challenge does not require it. This keeps recovery unambiguous and removes an unnecessary "which active assessment?" query.

## D013 — Target weight is required

All seven answer groups are required in v1. `targetWeightKg` is cross-validated against `goal` and `weightKg`; changing those earlier answers can make target weight the next required step again. We do not add a speculative branch that skips target weight for maintenance goals.

## D014 — Float measurements

Height, weight, target weight, and BMI use regular floating-point values at persistence/application boundaries. Domain functions own explicit rounding. Prisma `Decimal` would add conversion and serialization ceremony without a financial-precision requirement.

## D010 — Outside-in TDD

Architecture provides boundaries; TDD decides the concrete implementation incrementally. This also provides a controlled interface for AI assistance: code must satisfy reviewed behavior rather than letting generated code define requirements implicitly.

## D016 — shadcn/ui with Base UI; library first

The frontend uses shadcn/ui initialized with the Base UI component base, the `base-nova` preset, and Tailwind CSS v4. shadcn components are checked first whenever the product needs a common primitive such as a button, input, progress indicator, radio group, dialog, alert, separator, or skeleton.

Because shadcn installs component source into the repository, product styling and variants can be implemented directly on that shared baseline. Assessment-specific components should compose these primitives. A new low-level component is justified only when an existing shadcn/Base UI primitive does not fit the required semantics or interaction model.

This is not a rule to maximize dependency/component count. Only components actually needed by a vertical slice are added. The purpose is consistency, accessibility, maintainability, and avoiding duplicated focus/keyboard/state behavior.

## D019 — Scalar assessment input bounds

The v1 request contracts accept age 18–100 (integer), height 120–230 cm, and current/target weight 25–300 kg, all inclusive. These are project-level validation choices used to make boundary behavior deterministic and testable; the challenge brief does not prescribe these exact limits.

Scalar bounds only answer whether one field is structurally acceptable. They do not decide whether a target weight is semantically compatible with `goal` and current weight; that cross-field invariant is owned by the assessment step/domain policy.
