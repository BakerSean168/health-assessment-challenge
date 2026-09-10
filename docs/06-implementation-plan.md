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

**Status:** done — domain model v0.2 frozen before implementation

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

## 2.1 Domain freeze gate

**Status:** done — v0.2

Before T01 starts, the implementation must honor these frozen constraints:

- one `AnonymousSession` owns one v1 `Assessment`;
- no persisted `currentStepKey`; progress is derived from answers;
- `ANALYZING`/profile/projection/paywall are presentation states, not answer steps;
- all seven answer groups, including target weight, are required in v1;
- earlier edits revalidate dependent later answers;
- stale answer writes are strict `409` conflicts, including same-value stale retries;
- first-time submit uses aggregate revision control, while retry after successful completion returns the existing result;
- simulated payment uses a session-scoped `idempotencyKey`;
- physical measurements use `Float`, with domain-controlled rounding.

Calculation-policy constants remain intentionally pending until T09, where ADR + RED tests freeze them before production calculation code.

## 3. Phase 1 — project bootstrap

### T01 Initialize Next.js/TypeScript toolchain

**Status:** done — 2026-09-10

RED/verification first:

- add a trivial test to prove test runner executes;
- add `typecheck`, `lint`, `test`, and `build` scripts.

Implementation:

- Next.js App Router application;
- strict TypeScript;
- Tailwind CSS;
- shadcn/ui initialized explicitly with the Base UI component base;
- a minimal initial shadcn primitive set needed by bootstrap/demo work rather than bulk-installing the registry;
- ESLint;
- Vitest;
- Playwright scaffold;
- environment example;
- formatting conventions;
- pinned Node/pnpm toolchain metadata.

Acceptance:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

all succeed from a clean install.

Implemented baseline:

- Node.js `24.19.0` and pnpm `11.22.0` pinned in repository metadata;
- Next.js `16.3.4`, React `19.2.8`, strict TypeScript;
- Tailwind CSS v4;
- shadcn/ui initialized with explicit `--base base` and `base-nova` preset;
- first shared `Button` primitive added from shadcn rather than recreated locally;
- Vitest `5.0.0` and Playwright `1.63.0` scaffolded;
- `.env.example`, `.editorconfig`, `AGENTS.md`, lint/typecheck/test/build scripts;
- peer dependency check clean after aligning `@types/node` with Node 24 / Vitest requirements.

T01 TDD evidence: the bootstrap test existed before Vitest was installed and `pnpm test` failed with `vitest: not found` (RED). After installing/configuring the runner, the same test passed (GREEN), followed by successful typecheck, lint, and production build.

### T02 PostgreSQL + Prisma test foundation

**Status:** done — 2026-09-10

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

Implemented baseline:

- Prisma ORM `7.10.0` with the v7 `prisma-client` generator;
- `@prisma/adapter-pg` + `pg` for PostgreSQL connections;
- disposable PostgreSQL 17 test service in `compose.test.yaml` on local port `55432`;
- initial `AnonymousSession` table and `SubscriptionStatus` enum migration;
- `createPrismaClient(connectionString)` test/application factory plus lazy development singleton access;
- generated Prisma client excluded from git and regenerated on a fresh `pnpm install` through `postinstall`;
- integration tests separated from unit/bootstrap tests and run serially against the real database;
- test runner applies committed migrations before integration execution;
- pnpm build-script allowlist explicitly approves only Prisma/esbuild lifecycle scripts required by the toolchain.

T02 TDD evidence: `database.test.ts` first failed because the persistence adapter did not exist (RED). After Prisma/PostgreSQL setup, the same test round-tripped an `AnonymousSession` through a real PostgreSQL instance (GREEN). The committed migration was then reapplied successfully after destroying and recreating the test database from empty state.

## 4. Phase 2 — session and progressive persistence

### T03 Anonymous session bootstrap

**Status:** done — 2026-09-10

Acceptance criterion:

> A fresh browser obtains one server-owned session and revisiting with the same cookie reuses it.

Implementation after RED:

- `AnonymousSession` model from T02 plus the minimal 1:1 `Assessment` shell required by the session contract;
- secure cookie helper;
- `POST /api/session`;
- session repository port + Prisma adapter + application use case;
- UUID validation for the client-provided cookie value before lookup.

Implemented behavior:

- fresh request creates one session and one `IN_PROGRESS` assessment atomically;
- response is `201` for a new session and `200` when reusing an existing session;
- same cookie reuses the same persisted identity and does not create duplicate assessments;
- unknown/client-selected session IDs are not trusted and are replaced with a new server-created session;
- the raw session ID is carried only in a 30-day HttpOnly, `SameSite=Lax`, path-scoped cookie; `Secure` is enabled in production;
- response exposes only subscription/assessment state, not the raw session ID.

T03 TDD evidence: the route-level integration test was written before `src/app/api/session/route.ts` existed and failed on module resolution (RED). After the session use case/repository/cookie adapter and `Assessment` shell migration were implemented, all three route behaviors passed against PostgreSQL (GREEN).

### T04 First assessment and first saved step

**Status:** done — 2026-09-10

Acceptance criterion:

> Saving `GENDER` persists the answer and increments revision.

Implementation after RED:

- `Gender` enum and nullable `Assessment.gender` persistence field;
- semantic `getNextRequiredStep()` domain resolver started with the first two observable states (`GENDER` -> `GOAL`);
- assessment repository port + Prisma adapter;
- focused `saveGenderStep` application use case;
- strict gender Zod request contract;
- `PATCH /api/assessment/steps/:stepKey` Route Handler with the first supported step;
- stable API error envelope for session, validation, not-found, and version-conflict boundaries.

Implemented behavior:

- valid gender persists and increments `revision` from 0 to 1;
- response derives `nextRequiredStep: GOAL` from domain state instead of hard-coding a stored progress pointer;
- invalid enum values are rejected before persistence and do not increment revision;
- requests without a valid session are rejected with `401 SESSION_REQUIRED`;
- a valid UUID that does not own an assessment returns `404 ASSESSMENT_NOT_FOUND`, not a misleading version conflict;
- persistence results distinguish `saved`, `not_found`, and `conflict`, keeping HTTP status mapping out of the Prisma adapter.

T04 TDD evidence: the route integration test first failed because the step route did not exist (RED). A separate domain test then failed because `getNextRequiredStep` did not exist, preventing the implementation from hard-coding `GOAL`. Finally an ownership/error test exposed that a missing assessment was incorrectly collapsed into `409`; the repository result was refined until the API returned the intended `404`. All T04 cases then passed (GREEN).

### T05 Resume assessment

**Status:** done — 2026-09-10

Acceptance criterion:

> Saved answers and the semantic next step survive refresh/revisit.

Implementation after RED:

- `GET /api/assessment`;
- application recovery use case + repository read model;
- stable recovery DTO;
- derived `nextRequiredStep` resolver (no persisted current-step column);
- session bootstrap response updated to use the same derived progress semantics after persisted answers exist.

Implemented behavior:

- a saved gender survives a later request and is returned from the database;
- recovery returns `revision` and derives `GOAL` as the next required step;
- response already reserves the full v1 answer shape, with not-yet-entered values represented as `null`;
- retrying `POST /api/session` with the existing cookie now reports the derived persisted progress instead of resetting the response projection to `GENDER`;
- missing/malformed session identity returns `401 SESSION_REQUIRED`;
- an unknown but syntactically valid session identity returns `404 ASSESSMENT_NOT_FOUND`.

T05 TDD evidence: the recovery suite was written before `GET /api/assessment` existed and failed on module resolution (RED). The test also specified that retrying session bootstrap after a saved answer must report `GOAL`, preventing the bootstrap endpoint from keeping its earlier hard-coded `GENDER` projection. All four recovery behaviors now pass (GREEN).

### T06 Remaining answer contracts

**Status:** done — 2026-09-10

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

Implemented behavior/design:

- Prisma now persists `goal`, `activityLevel`, `heightCm`, `weightKg`, `age`, and `targetWeightKg` with enum-backed categorical fields;
- all seven route keys parse through one isolated runtime-contract module and become typed domain commands;
- scalar numeric bounds are frozen in executable tests: age 18–100 integer, height 120–230 cm, current/target weight 25–300 kg;
- the HTTP Route Handler no longer contains a per-step business switch;
- T04's first-step-specific application/repository path was refactored into the generic `saveAssessmentStep` use case and typed persistence command only after the second set of behaviors proved the abstraction;
- one Prisma adapter maps typed step commands to explicit columns and increments the aggregate revision;
- `getNextRequiredStep()` now works over the complete v1 answer shape and returns `null` after all seven answers exist;
- recovery and repeated session bootstrap both read the complete persisted answer state.

T06 TDD evidence: the runtime-contract suite first failed because the shared step parser did not exist; the integration suite simultaneously failed when `goal` hit the gender-only route (RED). After the generic contract/application/persistence path and remaining schema fields were introduced, boundary tests and the full seven-answer round-trip passed (GREEN). The scalar ranges are documented as project choices rather than source-provided medical rules.

## 5. Phase 3 — state consistency

### T07 Step-order policy

**Status:** done — 2026-09-10

Acceptance:

- next legal unresolved step succeeds;
- already-answered earlier step can be edited while in progress;
- dependent later answers are revalidated after earlier edits;
- skipped unresolved step returns `STEP_OUT_OF_ORDER`;
- `nextRequiredStep` is derived correctly without persisting duplicate progress state.

Implemented behavior:

- the application use case loads current aggregate state before mutation and validates the semantic step policy;
- only the current unresolved step or an already-present answer can be written while `IN_PROGRESS`;
- attempting to skip an unresolved prerequisite returns `409 STEP_OUT_OF_ORDER` with the server-derived `nextRequiredStep`, without changing revision;
- editing an earlier answered step remains legal and preserves unrelated later answers;
- target-weight validity is now contextual: lose `<` current, gain `>` current, maintain `===` current;
- changing an earlier goal can invalidate the existing target and move derived progress back to `TARGET_WEIGHT`;
- persistence still performs the revision-conditioned update after policy validation, so a concurrent change between read and write remains protected by the repository CAS boundary.

T07 TDD evidence: unit tests first failed because `validateStepWrite()` and contextual target validation did not exist, while the integration test proved the API incorrectly accepted a skipped `HEIGHT`. During GREEN, one proposed unit fixture was itself found to be wrong: it claimed to test a skipped height while keeping `heightCm` already populated, which by the frozen policy is a legitimate edit. The fixture was corrected instead of changing production code to satisfy an invalid test. All domain and integration behavior then passed.

### T08 Optimistic concurrency

**Status:** done — 2026-09-10

Acceptance:

- stale `expectedRevision` returns `409`, including same-value stale retries;
- newer persisted value remains intact;
- successful write increments exactly once.

Verification result:

- two requests using revision `0` were executed concurrently against the same PostgreSQL assessment;
- exactly one returned `200`, exactly one returned `409 ASSESSMENT_VERSION_CONFLICT`;
- persisted revision advanced exactly once to `1` and retained only the winning value;
- replaying the same value with stale revision `0` is still rejected with `409`, preserving the explicit stale-client contract.

T08 did not require new production logic: the acceptance tests passed immediately because the revision-conditioned Prisma update introduced in T04/T06 plus the application-level revision check from T07 already satisfied the behavior. We keep this as explicit executable verification rather than manufacturing an artificial RED state or rewriting working concurrency code merely to claim a RED/GREEN cycle.

## 6. Phase 4 — calculations and submission

### T09 Freeze calculation policy

**Status:** done — 2026-09-10

Before writing production calculation code:

- create ADR for intake and target-date formulas;
- define accepted measurement ranges;
- define rounding rules;
- define BMI category thresholds;
- explicitly state non-medical intent.

Frozen in `10-calculation-policy.md` as `demo-v1`:

- BMI metric formula; one-decimal display/storage; raw-value category classification at 18.5/25/30;
- Mifflin–St Jeor resting estimate with an explicit midpoint fallback for `OTHER`;
- project-defined activity multipliers 1.2 / 1.375 / 1.55 / 1.725 / 1.9;
- lose/maintain/gain adjustment of -300 / 0 / +300 kcal/day;
- defensive 1000 kcal/day lower guard and nearest-10 rounding;
- static 0.5 kg/week target-date projection for lose/gain; maintain returns `referenceDate`;
- UTC calendar-date semantics and injected time;
- required RED vectors and limitations;
- external references are separated from project constants so the README does not imply the challenge supplied a medical algorithm.

### T10 Calculation unit tests

**Status:** done — 2026-09-10

RED-first for:

- BMI;
- BMI category boundaries;
- intake policy;
- lose/maintain/gain differences if supported;
- target date;
- already-at-target case;
- deterministic reference date.

Implemented pure domain functions:

- `calculateBmi()` computes metric BMI, stores/displays one decimal, and classifies from the unrounded value;
- `calculateRecommendedDailyCalories()` implements the frozen Mifflin/activity/goal/guard/nearest-10 `demo-v1` policy;
- `estimateTargetDate()` normalizes the injected reference time to a UTC calendar date and applies the static projection;
- no function imports Prisma/Next.js/environment/cookies or reads the wall clock.

T10 TDD evidence: `calculation.test.ts` was written first from the already-frozen policy and failed because `calculation.ts` did not exist (RED). The production module was then added until all 22 table-driven and edge cases passed (GREEN), including raw-vs-rounded BMI threshold behavior, all gender/activity/goal branches, the lower calorie guard, partial-week rounding, and UTC date normalization.

### T11 Submit + result snapshot

**Status:** done — 2026-09-11

Acceptance:

- incomplete assessment rejected with missing/invalid steps;
- stale first-time submit is rejected using `expectedRevision`;
- complete assessment creates one result snapshot and completes the aggregate atomically;
- aggregate revision increments on first successful submit;
- calculation version persisted;
- retry after successful completion returns the existing result even though the aggregate revision already advanced.

Implemented behavior:

- `validateAssessmentReadyForSubmission()` derives the complete missing/invalid semantic-step list and returns a typed complete answer set only when the draft is valid;
- strict submit input accepts only `expectedRevision` and never accepts client-computed result values;
- first-time submit verifies ownership, revision, and completeness before invoking `calculateAssessmentResult()`;
- `AssessmentResult` persists BMI, category, recommended calories, estimated calendar date, calculation version, and creation timestamp;
- assessment completion, revision increment, `completedAt`, and result creation happen in one Prisma transaction;
- unique `AssessmentResult.assessmentId` enforces one canonical result per assessment;
- retry after completed state returns success without recomputation or duplicate rows, even when the caller carries the pre-completion revision;
- stale first-time submit remains `409 ASSESSMENT_VERSION_CONFLICT` and creates no result.

T11 TDD evidence: both the domain readiness test and route integration suite were written before the submission modules existed and failed on module resolution (RED). During GREEN, an incomplete schema-edit accidentally generated only the new BMI enum while omitting the `AssessmentResult` model; the integration test immediately failed because `prisma.assessmentResult` did not exist. The bad uncommitted migration was discarded, the disposable database was recreated from the four committed migrations, and a corrected result-snapshot migration was generated and verified before the tests passed. This is exactly the kind of persistence wiring defect the real-database integration suite is intended to expose.

## 7. Phase 5 — result access and payment

### T12 Free result policy

**Status:** done — 2026-09-11

Acceptance:

- BMI/public summary available;
- premium fields are represented as locked;
- actual premium values are absent from the serialized response.

Implemented behavior:

- `projectFreeResult()` constructs a purpose-built DTO from the stored result snapshot;
- BMI value/category are public;
- calorie and target-date sections expose only `{ locked: true }` and never carry their underlying values;
- `GET /api/assessment/result` resolves the current session server-side and queries the result through a repository port;
- missing/malformed session identity returns `401 SESSION_REQUIRED`;
- a valid session without a result snapshot returns `404 RESULT_NOT_FOUND`;
- a serialization assertion verifies that the actual calorie/date values are absent from the free JSON, not merely hidden by CSS.

T12 TDD evidence: the domain projection and route integration suites were created before the projection module/route existed and both failed on module resolution (RED). After adding the smallest free-result projection, repository, use case, and route, the two projection cases plus three PostgreSQL-backed route cases passed (GREEN).

### T13 Simulated payment

**Status:** done — 2026-09-11

Acceptance:

- valid payment changes `FREE -> ACTIVE`;
- payment event is persisted;
- same session-scoped `idempotencyKey` can be replayed without repeating side effects.

Implemented behavior:

- `PaymentEvent` stores only a simulated `idempotencyKey`, session ownership, `SUCCEEDED` status, and timestamp;
- PostgreSQL enforces composite uniqueness on `(sessionId, idempotencyKey)`, so the same key is intentionally reusable by different sessions;
- `/api/pay` reads ownership only from the HttpOnly session cookie and accepts no client `sessionId` field;
- strict payment contract bounds the key to 1–128 safe identifier characters;
- one transaction uses `createMany(..., skipDuplicates: true)` plus subscription update so duplicate keys collapse without duplicate side effects;
- repeated same-key requests return `replayed: true` while the first application returns `false`;
- concurrent same-key requests were tested and produce exactly one event with one applied/one replay response;
- invalid body returns `400 PAYMENT_INVALID`; missing identity returns `401 SESSION_REQUIRED`; unknown identity returns `404 SESSION_NOT_FOUND`.

T13 TDD evidence: contract and route integration tests were written before the payment contract/route existed and failed on module resolution (RED). The final PostgreSQL integration suite includes sequential replay, concurrent replay, session-scoped uniqueness, activation, invalid input, and identity-boundary cases (GREEN).

### T14 Active result policy

Acceptance:

- same result endpoint now returns full result after activation;
- no second "premium-only" calculation occurs.

## 8. Phase 6 — product UI

### T15 Assessment shell

Implement the reusable funnel layout using the UI-component policy in `09-ui-component-policy.md`:

- add suitable shadcn/ui Base UI-backed primitives before building equivalents locally;
- progress indicator;
- question title/supporting copy;
- answer controls;
- continue/back behavior;
- save/loading/error feedback;
- responsive layout;
- product-specific compositions and variants may extend the local shadcn source, but must not create a parallel generic component system.

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
