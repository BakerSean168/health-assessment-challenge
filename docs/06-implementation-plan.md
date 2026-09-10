# Implementation plan

## 1. Strategy

Implementation proceeds in vertical TDD slices rather than "finish database, then backend, then frontend, then add tests."

Architecture is intentionally defined first, but code is added only when a failing behavior requires it.

## 2. Phase 0 — repository and documentation

### P0.1 Public repository

**Status:** done

Acceptance:

- repository exists under the developer GitHub account;
- visibility is public;
- `main` is the default branch;
- repository description communicates the challenge intent.

### P0.2 Architecture baseline

**Status:** in progress / initial version created

Artifacts:

- README;
- scope/success criteria;
- reference-funnel audit;
- architecture;
- data model;
- API contract;
- TDD matrix;
- implementation plan;
- AI usage log;
- decision log.

## 3. Phase 1 — project bootstrap

### T01 Initialize Next.js/TypeScript toolchain

RED/verification first:

- add a trivial test to prove test runner executes;
- add `typecheck`, `lint`, `test`, and `build` scripts.

Implementation:

- Next.js application;
- strict TypeScript;
- ESLint;
- Vitest;
- Playwright scaffold;
- environment example;
- formatting conventions.

Acceptance:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

all succeed from a clean install.

### T02 PostgreSQL + Prisma test foundation

RED:

- integration smoke test requires persisted row round-trip.

Implementation:

- Prisma schema foundation;
- migration strategy;
- local/test database configuration;
- deterministic fixture cleanup.

Acceptance:

- migration applies from empty DB;
- integration test talks to a real DB;
- no production credentials used in tests.

## 4. Phase 2 — session and progressive persistence

### T03 Anonymous session bootstrap

Acceptance criterion:

> A fresh browser obtains one server-owned session and revisiting with the same cookie reuses it.

Implementation after RED:

- `UserSession` model;
- secure cookie helper;
- `POST /api/session`;
- session repository/use case.

### T04 First assessment and first saved step

Acceptance criterion:

> Saving `GENDER` persists the answer and increments revision.

Implementation after RED:

- `Assessment` model fields required for this slice;
- `saveAssessmentStep` application use case;
- gender Zod schema;
- step endpoint.

### T05 Resume assessment

Acceptance criterion:

> Saved answers and the semantic next step survive refresh/revisit.

Implementation after RED:

- `GET /api/assessment`;
- recovery DTO;
- current-step progression logic.

### T06 Remaining answer contracts

Add one step at a time, each with RED validation/persistence cases:

- goal;
- activity;
- height;
- current weight;
- age;
- target weight.

Acceptance:

- each has valid/boundary/invalid cases;
- all persisted via the same use-case pattern without a giant route switch containing business logic.

## 5. Phase 3 — state consistency

### T07 Step-order policy

Acceptance:

- next legal step succeeds;
- already-completed step can be edited;
- skipped unresolved step returns `STEP_OUT_OF_ORDER`;
- current semantic step remains correct.

### T08 Optimistic concurrency

Acceptance:

- stale `expectedRevision` returns `409`;
- newer persisted value remains intact;
- successful write increments exactly once.

## 6. Phase 4 — calculations and submission

### T09 Freeze calculation policy

Before writing production calculation code:

- create ADR for intake and target-date formulas;
- define accepted measurement ranges;
- define rounding rules;
- define BMI category thresholds;
- explicitly state non-medical intent.

### T10 Calculation unit tests

RED-first for:

- BMI;
- BMI category boundaries;
- intake policy;
- lose/maintain/gain differences if supported;
- target date;
- already-at-target case;
- deterministic reference date.

### T11 Submit + result snapshot

Acceptance:

- incomplete assessment rejected with missing steps;
- complete assessment creates one result snapshot;
- assessment becomes completed;
- calculation version persisted;
- retry returns the existing result rather than a new calculation.

## 7. Phase 5 — result access and payment

### T12 Free result policy

Acceptance:

- BMI/public summary available;
- premium fields are represented as locked;
- actual premium values are absent from the serialized response.

### T13 Simulated payment

Acceptance:

- valid payment changes `FREE -> ACTIVE`;
- payment event is persisted;
- same `paymentId` can be replayed without repeating side effects.

### T14 Active result policy

Acceptance:

- same result endpoint now returns full result after activation;
- no second "premium-only" calculation occurs.

## 8. Phase 6 — product UI

### T15 Assessment shell

Implement the reusable funnel layout:

- progress indicator;
- question title/supporting copy;
- answer controls;
- continue/back behavior;
- save/loading/error feedback;
- responsive layout.

### T16 Wire persisted steps

Acceptance:

- each continue action saves before navigation;
- server errors are represented correctly;
- refresh restores the page and value;
- stale-conflict behavior provides a safe recovery path.

### T17 Derived feedback screens

Implement compact reference-inspired value moments:

- analysis transition;
- wellness/BMI profile;
- goal projection;
- free result preview;
- paywall/full result transition.

No fake long-running analysis delay.

## 9. Phase 7 — E2E, CI, deployment

### T18 Browser flow: free user

New browser -> complete funnel -> submit -> free result.

Assert premium values are visibly locked and flow can complete without manually modifying DB state.

### T19 Browser flow: paid user

New browser -> complete funnel -> free result -> simulated payment -> same result page unlocked.

### T20 GitHub Actions

Required jobs/checks:

- install/cache;
- lint;
- typecheck;
- unit + integration tests;
- build;
- Playwright where environment is stable enough.

### T21 Public deployment

Acceptance:

- public URL loads;
- migration/database configured;
- production secure-cookie behavior works;
- complete assessment/payment demo works on deployed environment.

## 10. Phase 8 — delivery polish

### T22 Documentation reconciliation

Update docs from plans to actual implementation:

- actual schema diagram;
- actual endpoint examples;
- actual test counts;
- actual deployment URL;
- actual trade-offs/known limitations;
- calculation policy;
- setup commands.

### T23 AI usage review

Convert the running AI log into a concise retrospective:

- where AI saved time;
- what it proposed;
- one or more proposals rejected by the developer;
- why they were rejected;
- how tests/review caught mistakes.

## 11. Commit strategy

Prefer small, reviewable commits aligned with behavior slices, for example:

```text
test(session): define anonymous session reuse behavior
feat(session): implement anonymous session bootstrap
refactor(session): isolate cookie adapter

test(assessment): define stale revision conflict
feat(assessment): add optimistic revision update
```

Do not force separate RED/GREEN commits when it slows delivery excessively, but preserve test-first evidence in the diff/history whenever practical.

## 12. Three-day schedule

### Day 1

- bootstrap;
- DB/test foundation;
- session;
- incremental persistence;
- resume;
- state-order and revision behavior;
- minimal assessment UI shell.

### Day 2

- freeze calculation ADR;
- calculations;
- submit/result snapshot;
- free result projection;
- simulated payment;
- active result;
- finish core UI flow.

### Day 3

- E2E;
- CI;
- deployment;
- edge-case hardening;
- docs reconciliation;
- AI retrospective;
- final clean-room run from README instructions.

## 13. Stop-the-line conditions

Do not continue stacking features if any of these become red:

- migrations do not recreate the DB from scratch;
- integration test isolation is unreliable;
- free result leaks premium values;
- refresh loses authoritative progress;
- stale writes can silently overwrite newer state;
- submit or payment retry duplicates side effects;
- CI differs materially from documented local commands.
