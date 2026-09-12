# Interviewer code-review audit

## Scope

This pass assumes the reviewer is no longer asking whether the challenge works. It asks whether the implementation boundaries remain convincing under code review: application/repository separation, transaction correctness, HTTP semantics, error taxonomy, personalized-data handling, and test reproducibility.

## Findings fixed

| Area | Finding | Why it matters | Resolution |
|---|---|---|---|
| HTTP caching | Session-scoped GET/result JSON had no explicit cache directive | Personalized FREE/ACTIVE payloads should not rely on Cloudflare/Next defaults to avoid shared-cache reuse | All session API success/error responses use `Cache-Control: private, no-store` |
| Cross-field validation | A numeric-valid target could contradict the selected goal, be persisted, and return `saved: true` while `nextRequiredStep` stayed `TARGET_WEIGHT` | Successful persistence with no semantic progress is confusing and weakens the aggregate contract | Direct inconsistent candidates return `422 STEP_VALUE_INCONSISTENT`; value/revision remain unchanged |
| E2E isolation | Local Playwright could reuse any responsive server on port 3000 | A stale developer process can make a clean-checkout test command validate the wrong code/database | Local E2E owns `127.0.0.1:3100` and sets `reuseExistingServer: false` |
| Persisted scalar invariants | Domain progress/submission previously treated any non-null height/weight/age as valid | HTTP validation is not the only possible source of persisted data; old migrations/manual writes must not produce a result from invalid state | Domain validity now rechecks shared scalar limits and integer age before progress/submission |
| Remote E2E bootstrap | `E2E_BASE_URL` skipped the local web server but the wrapper still started/reset local PostgreSQL | Public smoke verification should not require unrelated local infrastructure | Remote E2E now runs Playwright directly; local DB/migration/reset only happen for local E2E |
| Product/reviewer boundary | Live pages narrated persistence, snapshots, server state, and simulated-payment mechanics | A take-home can look less complete when the product explains its implementation to the user | Public copy now stays end-user-facing; engineering proof remains in repository/docs/tests |
| API contract drift | Success DTOs, error-detail shapes, and status-code choices could be maintained independently | TypeScript assertions can make two drifting network shapes look compatible until runtime | Zod success/error contracts now drive inferred DTOs; browser and server both parse them; error code -> HTTP status is one exhaustive map |
| Cross-layer type drift | Step order/UI config, domain/Prisma enums and persisted fields, and calculation input shapes had overlapping handwritten definitions | A field or enum addition could compile in one layer while silently becoming unreachable or mis-persisted in another | Exhaustive `Record` maps plus compile-only API/Prisma alignment checks tie the projections together without coupling domain code to Prisma |
| Permissive compiler defaults | `strict: true` still left unchecked array access and exact-optional-property gaps | Those gaps hide precisely the kinds of state/config drift the challenge is meant to surface | Added `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, fallthrough/unused checks; the first run exposed and fixed a real back-navigation index assumption |
| Ambiguous write responses | A PATCH or submit could commit successfully while its HTTP response was lost, leaving the browser on stale local state | Retry safety is incomplete if the server is idempotent but the UI cannot reconcile an ambiguous outcome | Failed writes now re-read canonical assessment state; committed PATCH/submit outcomes recover automatically, with component tests for both lost-response paths |
| CI/toolchain drift | Only the image-publish job needs package write access, and the standalone migrator repeats the Prisma tool version | Excess permissions and migration/app version skew are avoidable release risks | Workflow defaults to read-only and grants `packages: write` only to image publication; a test keeps migrator Prisma/pnpm aligned with the app |
| JSON media-type boundary | `request.json()` accepted JSON-looking `text/plain` bodies | Body schema validation did not prove the HTTP media type, and browser simple requests could reach state-changing parsers through a weaker path | PATCH/submit/pay require `application/json`; other media types return `415 UNSUPPORTED_MEDIA_TYPE` before parsing |
| CAS response snapshot | A successful PATCH updated by revision, then performed a separate SELECT to build its response | A second writer could commit between those statements, causing the first response to report the later writer’s revision/state | `updateManyAndReturn` now returns the exact row produced by the CAS statement; a forced interleaving integration test reproduces the old race |
| Database invariant backstop | Scalar bounds, nonnegative revision, lifecycle timestamps, and key shape were enforced only above PostgreSQL | Direct/legacy/manual writes could create states the application then had to defensively reinterpret | A committed migration adds validated CHECK constraints while deliberately leaving goal/target cross-field draft semantics in the domain |
| Replay side-effect repair | Duplicate payment events returned `replayed: true` before verifying ACTIVE access still held | Idempotency should represent the operation outcome, not merely the existence of its dedupe record | Replays now idempotently re-establish FREE→ACTIVE within the same transaction; a regression test simulates an externally downgraded subscription |
| Session 1:1 repair | Bootstrap repaired a missing assessment but not a missing subscription row | The documented 1:1 resource invariant could remain partially broken after legacy/manual corruption | Existing-session bootstrap ensures both child rows with duplicate-safe inserts while read boundaries still fail closed to FREE |

The first two changes were driven RED-first by integration assertions. The E2E isolation change was verified while a separate development process remained on port 3000; Playwright launched the current checkout on port 3100 and both journeys passed.

## Repository/application boundary review

The assessment module intentionally exposes small use-case-specific repository ports (`AssessmentRepository`, `AssessmentSubmissionRepository`, `AssessmentResultRepository`) instead of one CRUD-heavy generic repository. That duplication is accepted because the write contracts are materially different: step saves need optimistic compare-and-swap, submit needs atomic completion plus snapshot creation, and result reads need subscription-aware projection input.

Route Handlers remain transport adapters: cookie/body parsing and HTTP status mapping live there; state/order/calculation rules do not. Prisma-specific shapes and transactions remain under `infrastructure/`.

## Transaction review

### Step mutation

A preliminary read is used for product policy and expected revision. The actual write uses `UPDATE ... WHERE sessionId/status/revision` semantics through Prisma `updateManyAndReturn`. If another request wins after the read, the compare-and-swap mutation returns no row and the application returns `409 ASSESSMENT_VERSION_CONFLICT`. On success, the returned row is the exact snapshot produced by that SQL statement, avoiding a post-write SELECT race where a later writer could leak its newer revision into the first response. The preliminary read is therefore not treated as the concurrency boundary.

### Submit

Assessment completion/revision increment and `AssessmentResult` creation happen in one Prisma transaction. The unique `assessmentId` result relationship plus completed-state replay path prevents semantic duplicate snapshots. The existing preliminary read can race, but the transaction's compare-and-swap decides correctness.

### Payment

Payment event insertion and session activation happen in one transaction. `(sessionId, idempotencyKey)` is unique; concurrent same-key requests are integration-tested so exactly one inserts the event and the other is reported as replayed. Replay still re-applies the idempotent ACTIVE transition, so an existing dedupe record cannot cause the API to claim ACTIVE while the canonical subscription is FREE.

## HTTP/error taxonomy review

The current mapping is intentional:

| Status | Meaning in this API |
|---|---|
| `400` | malformed JSON or structurally invalid request schema |
| `401` | no usable anonymous bearer session |
| `404` | syntactically valid identity but requested session/assessment/result does not exist |
| `409` | valid request conflicts with aggregate order/lifecycle/revision |
| `415` | request body media type is not `application/json` |
| `422` | structurally valid candidate value conflicts with existing domain context |

Stable machine-readable error codes remain more important than prose messages for clients/tests.

## Accepted limitations rather than late over-engineering

- No generic repository abstraction: current use-case ports are easier to reason about and test.
- Dedicated subscription storage stays intentionally minimal: the 1:1 row models only FREE/ACTIVE access and activation time; plan/expiry/provider lifecycle remains out of scope.
- No distributed lock: PostgreSQL constraints/transactions/CAS cover the required single-database consistency boundary.
- No real payment webhook/signature verification: `/pay` is explicitly simulated by the brief.
- No broad rate limiting/observability platform: useful production concerns, but lower signal than the required three-day correctness loop.

## Evidence after this review

- 83 unit/component tests;
- 49 real PostgreSQL integration tests;
- 2 Playwright browser journeys;
- `pnpm test:all` runs all three layers;
- lint + route-aware typecheck + production build remain required CI gates;
- the same public FREE and paid journeys are rerun after deployment.
