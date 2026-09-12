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
| D017 | intake calculation formula | accepted | freeze a deterministic `demo-v1` estimate with explicit external references, project constants, rounding, guard, and limitations |
| D018 | target-date rate policy | accepted | use injected UTC date plus a documented static 0.5 kg/week demo projection; do not pretend to implement a physiological model |
| D019 | scalar assessment input bounds | accepted | freeze runtime-validation boundaries in tests while keeping them explicitly separate from source requirements and cross-field health logic |
| D020 | goal/target directional invariant | accepted | keep the questionnaire internally coherent with a deterministic non-medical rule and make upstream edits revalidate downstream target state |
| D021 | stable dependency refresh with compatibility gate | accepted | prefer current stable runtime packages only when the full framework/plugin toolchain supports them; reject upgrades that break quality gates |
| D022 | one bounded production database pool per app process | accepted | prevent per-request Prisma/pg pools from exhausting the isolated production role |
| D023 | reviewer-first delivery surface | accepted | expose the required demo, API, schema, one-command tests, coverage rationale, and AI evidence without making an interviewer search through implementation history |
| D024 | private/no-store session API responses | accepted | personalized assessment/result payloads must not be eligible for shared-cache reuse |
| D025 | reject inconsistent target candidates before persistence | accepted | avoid reporting a successful save that leaves the same semantic step unresolved |
| D026 | isolated local Playwright server | accepted | one-command E2E must execute the current checkout rather than silently reusing a stale port-3000 process |
| D027 | revalidate persisted scalar invariants in the domain | accepted | transport validation is not sufficient proof that stored legacy/manual data is safe to submit |
| D028 | remote E2E has no local database bootstrap | accepted | production smoke tests should exercise only the remote deployment and not depend on unrelated local Docker state |
| D029 | product-facing UI, reviewer-facing engineering evidence | accepted | let the public funnel behave like a real product; keep persistence/snapshot/TDD/server narration in repository evidence |
| D030 | live client BMI preview from the shared pure calculation | accepted | provide immediate user value on the weight step without duplicating or replacing the server-side result snapshot |

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

## D020 — Goal/target directional invariant

V1 treats target-weight consistency as product-state logic: a lose goal requires a target below current weight, a gain goal requires a target above current weight, and a maintain goal requires the target to equal current weight. The rule is intentionally simple and deterministic. It is not presented as health or clinical advice.

The main architectural value is dependency revalidation: if an already-complete assessment draft changes `goal` or `weightKg`, a previously stored `targetWeightKg` can become invalid. Progress is therefore derived back to `TARGET_WEIGHT` without a mutable current-step column or destructive clearing of unrelated answers.

## D017 — Recommended-intake demo policy

`demo-v1` uses the Mifflin–St Jeor resting-energy equation as an externally recognizable base, then applies project-defined activity multipliers and a -300/0/+300 kcal/day goal adjustment. Output has a defensive 1000 kcal/day lower guard and is rounded to the nearest 10. Because the questionnaire includes `OTHER` while the source equation publishes male/female constants, the demo uses their arithmetic midpoint (-78) for that branch and documents this as a limitation rather than a physiological category. Full formulas and references live in `10-calculation-policy.md`.

## D018 — Static target-date demo policy

`demo-v1` projects lose/gain progress at a static 0.5 kg/week and adds `ceil(abs(current-target)/0.5) * 7` days to an injected UTC calendar date. Maintain returns the reference date because the v1 step policy requires target=current. This is intentionally a transparent simulation, not the dynamic physiological model used by NIDDK's Body Weight Planner.

## D021 — Stable dependency refresh with compatibility gate

The project prefers current stable dependencies, but "latest" is not treated as a requirement that overrides compatibility evidence. After T17, React/React DOM were updated from 19.2.8 to 19.3.0, Zod from 4.5.4 to 4.6.2, and the matching React/Node type packages were refreshed. The complete unit/component, PostgreSQL integration, lint, typecheck, peer-dependency, and production-build gates remained green.

ESLint 10.10.0 was evaluated separately and rejected for now. `eslint-config-next@16.3.4` still resolves `eslint-plugin-react@7.37.5`; that plugin declares support only through ESLint 9 and fails at runtime under ESLint 10 (`contextOrFilename.getFilename is not a function`). Keeping ESLint 9.39.5 is therefore an explicit compatibility decision, not an unnoticed stale dependency. The project will move to ESLint 10 only when the Next/React lint stack supports it cleanly.

Prisma 7.10 remains intentionally unchanged because its current schema/client/migration workflow is already covered by real PostgreSQL integration tests; a major ORM migration is not justified solely to maximize version numbers during this challenge.

TypeScript 7.0.2 was also evaluated and rejected for now. The project itself typechecked and all unit/integration tests passed under TS 7, but the current `typescript-eslint` stack pulled by `eslint-config-next@16.3.4` explicitly rejects TypeScript 7. Keeping TypeScript 5.9.3 preserves a fully supported lint/typecheck toolchain instead of introducing a side-by-side compiler workaround during a three-day challenge.

## D022 — One bounded production database pool per app process

The standalone Next.js process caches one application `PrismaClient` on `globalThis` in every environment. The `@prisma/adapter-pg` adapter is configured with a default maximum of four pooled connections, overridable through `DATABASE_POOL_MAX`. This is intentionally below the dedicated production role's connection cap so migration/administrative work retains headroom.

This decision was made from production evidence rather than style preference: the first public concurrent Playwright run exposed `P2037 TooManyConnections` because the previous production branch constructed a fresh Prisma client and pg pool for repeated request-path lookups. A dedicated production-lifecycle regression test now prevents that behavior from returning.

## D023 — Reviewer-first delivery surface

A correct implementation can still be a weak submission if the reviewer must infer where evidence lives. The final README therefore front-loads the public demo, paid evaluator identity, endpoint map, reproducible `/pay` cURL, actual schema, one-command test runner, behavior coverage, and intentional exclusions. `docs/13-interviewer-audit.md` maps the supplied brief to concrete evidence and names the remaining trade-offs explicitly.

## D024 — Private/no-store session API responses

Every API route in this challenge is scoped to the anonymous bearer session. Success and error JSON therefore use a shared response helper that emits `Cache-Control: private, no-store`. Cloudflare currently treats these routes as dynamic, but correctness should not depend on a particular edge-cache default or future configuration.

## D025 — Reject inconsistent target candidates before persistence

Scalar input validation and cross-field domain validation have different responsibilities. A target can be a valid numeric weight yet contradict `LOSE_WEIGHT`, `GAIN_WEIGHT`, or `MAINTAIN` relative to the stored current weight. Direct inconsistent candidates return `422 STEP_VALUE_INCONSISTENT` and do not advance the optimistic revision. If a previously valid stored target becomes invalid because an earlier goal/current-weight answer is edited, that historical value may remain stored while derived progress moves back to `TARGET_WEIGHT`.

## D026 — Isolated local Playwright server

Local browser tests run on a dedicated `127.0.0.1:3100` server with `reuseExistingServer: false`. This intentionally fails on an unexpected port collision instead of silently testing a stale developer process. Public-deployment verification remains opt-in through `E2E_BASE_URL`.

## D027 — Revalidate persisted scalar invariants in the domain

Zod remains the HTTP contract boundary, but stored state is not assumed valid merely because it exists. `getNextRequiredStep()` and submission validation reuse the frozen scalar limits for height, weight, target weight, and integer age. This protects recovery/submission from legacy, manual, seed, or otherwise non-HTTP data that violates current invariants. The calculation functions can therefore continue to accept a validated complete input rather than duplicating defensive range checks internally.

## D028 — Remote E2E skips local database bootstrap

`E2E_BASE_URL` is a production/deployed-environment verification mode. The E2E wrapper now starts PostgreSQL, applies migrations, and resets fixtures only for local execution. Remote mode launches Playwright directly against the supplied URL. This keeps production smoke evidence independent from local Docker availability and avoids touching an unrelated test database.

## D029 — Product-facing UI, reviewer-facing engineering evidence

The public funnel is not an architecture presentation. Engineering terms such as progressive persistence, versioned result snapshot, access boundary, server state, deterministic implementation, and FREE/ACTIVE transition belong in README/docs/tests. The live UI instead explains user value: body metrics, calorie estimate, goal timeline, and a concise wellness disclaimer.

Mock payment remains transparent without exposing backend mechanics: the paywall states that no payment details are required and the user will not be charged, while details about the idempotency key and subscription-state transition remain in reviewer documentation.

This corrects an earlier reviewer-first interpretation that over-optimized the live page for demonstrating implementation details. Reviewer discoverability is still provided by D023, but on the repository surface rather than inside the end-user experience.

## D030 — Live client BMI preview from the shared pure calculation

Once height is already saved, the current-weight step calculates BMI immediately after the draft weight becomes valid. The preview imports the same pure `calculateBmi()` domain function used by submission, so the browser does not carry a second formula or threshold table. This is presentation feedback only: it does not persist a result and does not replace the canonical server-side snapshot created on submission.

The preview also maps the existing four BMI categories to distinct product states: normal uses a positive state, overweight uses a caution state, and underweight/obese use stronger attention states. Copy deliberately avoids calling BMI alone “dangerous” because it is a screening measure rather than a diagnosis.

Assessment numeric fields retain `type=number` and mobile `inputMode`, but suppress browser-native spinner controls through local styling so height/current-weight/age/target-weight entry remains visually consistent with the product surface. Each numeric label row shows the accepted range (for example `120–230 cm`) without reverting to developer-oriented “accepted range” helper copy below the field.
