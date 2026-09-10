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
