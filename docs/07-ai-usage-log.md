# AI usage log

## Purpose

This file records meaningful AI-assisted engineering decisions during the challenge. It is intentionally more specific than a generic statement such as "AI was used to help code."

For each noteworthy interaction, record what AI proposed, what evidence constrained the decision, what was accepted/rejected, and why.

## Working protocol

1. Start from an acceptance criterion or explicit design question.
2. Ask AI for alternatives, edge cases, or implementation help.
3. Review the proposal against the challenge scope and existing tests.
4. Prefer writing/approving the failing test before accepting implementation.
5. Record disagreements or important corrections here.

## Entries

### 2026-09-10 — Architecture planning

**Context**

Before implementation, the challenge brief and the BetterMe-style reference funnel were analyzed together.

**AI contribution**

AI helped compress the long reference funnel into technical phases and proposed an architecture containing anonymous session state, incremental persistence, semantic step keys, optimistic concurrency, result snapshots, server-side access projection, and idempotent simulated payment.

**Developer decision**

Accepted the general architecture, with the explicit constraint that it remain a small modular monolith rather than introducing Redis, queues, microservices, CQRS, or other infrastructure that does not earn its cost in a three-day challenge.

**Evidence / rationale**

The challenge emphasizes state recovery, correctness, permissions, testing, and AI efficiency. The selected architecture maps directly to those behaviors while keeping the implementation reviewable.

### 2026-09-10 — TDD as the implementation method

**Context**

Initial planning treated tests as an important project area, but the development order was not yet explicitly test-first.

**Developer correction**

The implementation method was changed to outside-in TDD with vertical slices.

**Decision**

Each non-trivial behavior will begin with an acceptance criterion and failing test, followed by minimal implementation and refactoring.

**Why this matters**

This prevents AI-generated implementation from defining behavior implicitly and turns the challenge requirements into executable evidence throughout development rather than adding tests at the end.

### 2026-09-10 — Domain model v0.2 freeze

**Context**

The first architecture draft was reviewed immediately before Prisma implementation. Several fields represented convenient implementation ideas rather than necessary domain facts.

**AI proposal reviewed**

The earlier draft persisted `currentStepKey`, included `ANALYSIS` in the assessment-step enum, left the session-to-assessment relationship as potentially one-to-many, used Prisma `Decimal` for physical measurements, and named the simulated payment key `paymentId`.

**Developer review / correction**

The model was tightened before code was allowed to depend on it:

- removed persisted `currentStepKey`; `nextRequiredStep` is derived from answer validity;
- removed `ANALYSIS` and other presentation screens from domain step identity;
- froze one assessment per anonymous session for v1;
- made target weight required rather than adding an unrequested branch;
- defined cross-field revalidation after earlier edits;
- kept stale PATCH behavior strict under optimistic concurrency;
- required first-time submit to participate in revision control while preserving successful-submit retry semantics;
- renamed simulated `paymentId` to session-scoped `idempotencyKey`;
- changed physical measurements/results from Prisma `Decimal` to regular floating-point representation with explicit domain rounding.

**Evidence**

The deciding principle was to persist independent facts once and derive dependent state. The challenge needs reliable resume/concurrency/payment behavior, but it does not require assessment history, a real payment provider, or financial numeric precision.

**Outcome**

`scope`, reference audit, architecture, domain/data model, API contract, TDD strategy, implementation plan, decision log, and README were synchronized to domain model v0.2 before T01 bootstrap.

### 2026-09-10 — UI primitive strategy

**Context**

The initial architecture had not frozen a UI component library and could have led to locally rebuilding generic controls during funnel implementation.

**Developer decision**

Use shadcn/ui with the Base UI component base and prefer existing library components whenever they fit. Local customization and product-level composition are encouraged, but a second hand-built primitive set should not be created in parallel.

**Evidence / rationale**

The challenge benefits from a consistent accessible UI baseline, while shadcn's local-source model still permits product-specific styling. Reusing established primitives reduces duplicated keyboard/focus/state work and keeps the three-day implementation focused on the assessed behavior.

**Outcome**

The stack, architecture, implementation plan, and dedicated UI component policy were updated before project bootstrap.

### 2026-09-10 — T01 toolchain bootstrap

**Context**

Implementation began after the domain and UI-component policies were frozen.

**AI-assisted execution**

The project was scaffolded with the current Next.js App Router template, then shadcn/ui was initialized explicitly with Base UI and the Nova preset. A shadcn `Button` was added as the first shared primitive to verify the library-first policy in the actual repository.

**TDD evidence**

`src/test/bootstrap.test.ts` was written before Vitest was installed. Running `pnpm test` failed because the runner did not exist (RED). Vitest was then installed/configured and the same test passed (GREEN).

**Developer/review correction**

The first dependency verification exposed an unmet Vitest peer requirement because create-next-app had selected `@types/node` 20 while the runtime is Node 24. The types package was deliberately aligned to `@types/node` 24 and `pnpm peers check` was required to be clean before accepting the bootstrap.

**Outcome**

`pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` all pass. The shadcn project reports `base` as its component base and `base-nova` as its style preset.

### 2026-09-10 — T02 real PostgreSQL integration foundation

**Context**

The next vertical slice needed executable proof that persistence and migrations work against PostgreSQL rather than a mocked ORM.

**TDD evidence**

An integration test importing the not-yet-existing database adapter was written first and failed with a module-resolution error (RED). The implementation then introduced Prisma 7, the PostgreSQL driver adapter, a disposable PostgreSQL 17 service, the first migration, and a Prisma client factory. The same test then persisted and reloaded an anonymous session (GREEN).

**Review corrections**

Two bootstrap issues were caught before acceptance: Vitest/Node type versions were aligned earlier, and the pnpm supply-chain gate required explicit approval of Prisma/esbuild lifecycle build scripts rather than bypassing script security globally. An attempted ESLint 10 upgrade was rejected because transitive Next.js ESLint plugins still declare ESLint 9 peer ranges; the generated ESLint 9 line was retained until that ecosystem constraint changes.

**Outcome**

The test database can be destroyed, recreated, migrated from zero, and exercised by the integration suite. A fresh dependency install regenerates the ignored Prisma client through `postinstall`, while production credentials remain outside the repository.

### 2026-09-10 — T03 anonymous session vertical slice

**Context**

The first behavior-bearing backend slice needed to establish anonymous browser identity without introducing a full authentication system.

**TDD evidence**

A route-level integration test was written first for three observable behaviors: fresh session creation, cookie-based reuse, and rejection of a client-selected unknown session identifier. It initially failed because the session route did not exist.

**Implementation/review choices**

The slice uses a repository port, a Prisma adapter, and a small application use case rather than putting Prisma queries directly in the Route Handler. The cookie value is UUID-validated before lookup, the route does not serialize the raw session ID, and a minimal 1:1 `Assessment` shell is created with the session because the API contract promises that bootstrap ensures an assessment exists.

The code follows the installed Next.js 16 documentation rather than older synchronous-cookie examples: Route Handlers use `NextRequest`/`NextResponse`, which also keeps this HTTP boundary directly testable without relying on global request context.

**Outcome**

The three integration cases pass against PostgreSQL, and the session/assessment ownership boundary now exists for T04 answer persistence.

### 2026-09-10 — T04 first answer persistence

**Context**

The first assessment mutation needed to persist `GENDER`, advance the optimistic aggregate revision, and establish the shape that later answer steps will reuse.

**TDD evidence**

The route-level integration test was written before the dynamic step Route Handler existed and failed on module resolution. During GREEN work, a hard-coded `GOAL` response was recognized as inconsistent with the frozen domain decision that progress must be derived, so a separate RED unit test was added for `getNextRequiredStep()` before implementing the resolver.

A later ownership test deliberately sent a valid UUID that did not own an assessment. It failed because the first repository API collapsed both "not found" and "stale revision" into the same null/409 outcome. The persistence contract was changed to a discriminated `saved | not_found | conflict` result so the application/HTTP boundary can map the states correctly.

**Outcome**

Gender persistence, runtime validation, revision increment, derived next-step behavior, missing-session handling, and unknown-assessment handling are all executable against PostgreSQL. No generic multi-step abstraction was introduced before the second step proves which parts actually generalize.

### 2026-09-10 — T05 server-derived recovery

**Context**

Once the first answer was persisted, the system needed to prove that refresh/revisit state comes from PostgreSQL rather than client-only state or a duplicated progress pointer.

**TDD evidence**

The recovery integration suite was added before `GET /api/assessment` existed and failed on module resolution. It also exercised `POST /api/session` after saving gender and expected `GOAL`, revealing that the bootstrap response still contained the temporary hard-coded `GENDER` used before answer persistence existed.

**Developer/review decision**

Both recovery and bootstrap now project progress through the domain `getNextRequiredStep()` function. No `currentStepKey` column was introduced. The persistence read model exposes stored facts, and the application layer derives the resumable state.

**Outcome**

Saved gender, revision, and semantic progress survive a new request; invalid/unknown session identities remain bounded by stable 401/404 behavior.

### 2026-09-10 — T06 generalize only after the second step set

**Context**

T04 deliberately implemented only gender instead of guessing a generic questionnaire framework. T06 introduced the remaining six answer types, making it possible to see what actually generalized.

**TDD evidence**

A runtime-contract test suite was written first for category values, inclusive boundaries, invalid numeric values, unknown step keys, and strict rejection of extra client fields. It failed because no shared parser existed. A separate PostgreSQL integration test attempted the seven-answer sequence and failed at `goal` because the route still supported only gender.

**Developer/review decision**

Only then was the first-step-specific path refactored into a typed `AssessmentStepCommand` union, a shared `saveAssessmentStep` use case, and an explicit Prisma mutation mapper. The Route Handler delegates parsing and business behavior rather than accumulating a giant switch. Scalar validation bounds (age 18–100 integer, height 120–230 cm, weight/target 25–300 kg) are recorded as challenge implementation choices; no claim is made that the source brief supplied them.

**Outcome**

All seven fields persist incrementally, each successful mutation advances revision exactly once, the complete answer state is recoverable, and the domain resolver reaches ready-to-submit (`nextRequiredStep: null`). Cross-field target-weight semantics remain for the dedicated state-policy slice rather than being smuggled into scalar validation.

### 2026-09-10 — T07 reject an incorrect test, not correct behavior

**Context**

The server-side step policy needed to distinguish a real skipped unresolved step from editing a value that is already present, while also revalidating target weight after upstream edits.

**TDD evidence**

The initial RED suite correctly exposed two missing production behaviors: later unresolved steps were accepted, and target weight was validated only by presence. However, one generated unit fixture for "skip HEIGHT" accidentally retained `heightCm` from a complete fixture. Under the agreed policy, an already-present answer is editable, so production code correctly returned `allowed: true`.

**Developer review / rejection**

The failing test was rejected as incorrectly specified. The fixture was changed to make `heightCm` genuinely unresolved rather than weakening the production rule to make a bad test green. This is the clearest example so far of TDD constraining AI while still requiring human review of the tests themselves.

**Outcome**

The final policy rejects unresolved skips, permits edits, and revalidates target weight contextually (`LOSE_WEIGHT`: target lower; `GAIN_WEIGHT`: target higher; `MAINTAIN`: target equal). The API returns stable `STEP_OUT_OF_ORDER` details and leaves revision unchanged on rejection.

### 2026-09-10 — T08 acceptance test was already green

**Context**

The dedicated optimistic-concurrency slice needed to prove the architecture claim with real concurrent PostgreSQL writes, including the strict same-value stale retry rule.

**Test result**

The new acceptance test launched two gender writes concurrently with the same expected revision. It passed immediately: one writer won, the other received `409`, and the aggregate revision advanced once. A stale retry carrying the already-persisted value also returned `409` as designed.

**Developer decision**

No production change was made just to manufacture a TDD RED phase. The behavior had already been implemented incrementally by earlier slices. The test is retained as executable characterization/acceptance evidence. This is preferable to changing correct code for process theater.

**Outcome**

The concurrency contract is now directly tested against PostgreSQL rather than inferred from the presence of a `revision` field.

### 2026-09-10 — T09 calculation policy before calculation code

**Context**

The source challenge names three outputs but does not define the intake or target-date algorithms. Implementing a plausible formula directly in code would silently invent requirements and make later tests merely mirror the implementation.

**Research/review**

CDC BMI category guidance, the published Mifflin–St Jeor equation, and NIDDK's Body Weight Planner were reviewed as external context. The NIDDK planner is a dynamic physiological model; reproducing it is outside this three-day challenge.

**Developer decision**

A separate `demo-v1` calculation policy was frozen first. Recognizable external formulas/thresholds are distinguished from project constants such as activity multipliers, ±300 calorie adjustment, the `OTHER` midpoint fallback, and the deliberately static 0.5 kg/week projection. All limitations are explicit and the output is not presented as medical advice.

**Outcome**

`10-calculation-policy.md` now contains exact formulas, rounding/date semantics, external references, and required RED vectors. T10 can therefore write tests from the policy rather than from production code.

### 2026-09-10 — T10 calculations implemented from policy, not vice versa

**Context**

The exact `demo-v1` calculation policy had already been frozen in T09, including test vectors and rounding/date semantics.

**TDD evidence**

A 22-case unit suite was written before `calculation.ts` existed and failed on module resolution. The suite covers BMI threshold boundaries, the deliberate raw-before-rounding classification rule, all Mifflin gender branches including the documented `OTHER` midpoint, all activity multipliers, all goal adjustments, the 1000 kcal lower guard, target-date lose/gain/maintain cases, partial-week ceiling, and UTC normalization.

**Outcome**

The resulting production functions are pure and have no framework, database, environment, cookie, or wall-clock dependency. Test expectations came from the prior policy document, avoiding the anti-pattern of writing implementation first and tests that simply reproduce it afterward.

### 2026-09-11 — T11 result snapshot migration caught by integration test

**Context**

Submission is the first multi-write aggregate transition: validate a complete draft, calculate a versioned result, mark the assessment completed, and create the canonical snapshot atomically.

**TDD evidence**

Domain and integration tests were written before the submission modules existed. The route suite covers incomplete submit, successful snapshot creation, retry idempotency, and stale first-time submission.

**Implementation/review correction**

The first scripted Prisma-schema edit added `BmiCategory` but failed to insert the `AssessmentResult` model because a textual replacement anchor did not match the formatted schema. Prisma therefore generated a syntactically valid but incomplete migration, and the integration suite failed at runtime because `prisma.assessmentResult` was absent. The incomplete migration had not been committed, so it was removed; the disposable PostgreSQL database was destroyed/recreated from committed migrations; the schema was rewritten explicitly; and a corrected migration was generated. The generated client was then inspected to verify the `assessmentResult` accessor before rerunning the suite.

**Outcome**

First submit is revision-safe and transactional, retries reuse exactly one stored snapshot, and a stale first-time submit cannot create a result. The incident is retained as evidence that AI/scripted edits are not trusted without executable database verification.

### 2026-09-11 — T12 prove locked values are absent, not blurred

**Context**

The challenge distinguishes free and subscribed results. A visually blurred premium value would still leak the data to the browser and would not be authorization.

**TDD evidence**

The free-result tests were written before implementation. In addition to exact DTO shape, both domain and integration coverage serialize the response and assert that the real calorie value and target date do not occur in the JSON at all.

**Developer decision**

The domain creates a dedicated free projection rather than returning the persistence model and asking React to hide selected properties. The result route is session-scoped and returns `RESULT_NOT_FOUND` until a canonical snapshot exists.

**Outcome**

The access boundary is executable: FREE receives public BMI plus locked markers, with premium values omitted before serialization.

### 2026-09-11 — T13 idempotency at the database boundary

**Context**

The simulated `/pay` endpoint must make retry safety real rather than relying on the UI to avoid double clicks.

**TDD evidence**

Tests were written first for activation, sequential replay, two concurrent requests carrying the same key, the same key used by two different sessions, invalid input, and missing/unknown session identity.

**Developer decision**

The identifier is named `idempotencyKey`, not `paymentId`, because there is no external provider. Composite database uniqueness scopes it to a session. The repository uses a transaction and `createMany(..., skipDuplicates: true)` so the database decides which concurrent request owns the side effect rather than implementing a race-prone read-then-create check in application code.

**Outcome**

The concurrent test produces one persisted event and exactly one `replayed: false` / one `replayed: true` response. Subscription becomes `ACTIVE` once.

## Entry template

### YYYY-MM-DD — Short title

**Context**

What was being designed or implemented?

**AI proposal**

What did AI recommend or generate?

**Developer review**

What was accepted, changed, or rejected?

**Evidence**

Which requirement, test, measurement, code constraint, or trade-off informed the decision?

**Outcome**

What changed in code/docs/tests?
