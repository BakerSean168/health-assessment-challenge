# Interviewer code-review audit

## Scope

This pass assumes the reviewer is no longer asking whether the challenge works. It asks whether the implementation boundaries remain convincing under code review: application/repository separation, transaction correctness, HTTP semantics, error taxonomy, personalized-data handling, and test reproducibility.

## Findings fixed

| Area | Finding | Why it matters | Resolution |
|---|---|---|---|
| HTTP caching | Session-scoped GET/result JSON had no explicit cache directive | Personalized FREE/ACTIVE payloads should not rely on Cloudflare/Next defaults to avoid shared-cache reuse | All session API success/error responses use `Cache-Control: private, no-store` |
| Cross-field validation | A numeric-valid target could contradict the selected goal, be persisted, and return `saved: true` while `nextRequiredStep` stayed `TARGET_WEIGHT` | Successful persistence with no semantic progress is confusing and weakens the aggregate contract | Direct inconsistent candidates return `422 STEP_VALUE_INCONSISTENT`; value/revision remain unchanged |
| E2E isolation | Local Playwright could reuse any responsive server on port 3000 | A stale developer process can make a clean-checkout test command validate the wrong code/database | Local E2E owns `127.0.0.1:3100` and sets `reuseExistingServer: false` |

The first two changes were driven RED-first by integration assertions. The E2E isolation change was verified while a separate development process remained on port 3000; Playwright launched the current checkout on port 3100 and both journeys passed.

## Repository/application boundary review

The assessment module intentionally exposes small use-case-specific repository ports (`AssessmentRepository`, `AssessmentSubmissionRepository`, `AssessmentResultRepository`) instead of one CRUD-heavy generic repository. That duplication is accepted because the write contracts are materially different: step saves need optimistic compare-and-swap, submit needs atomic completion plus snapshot creation, and result reads need subscription-aware projection input.

Route Handlers remain transport adapters: cookie/body parsing and HTTP status mapping live there; state/order/calculation rules do not. Prisma-specific shapes and transactions remain under `infrastructure/`.

## Transaction review

### Step mutation

A preliminary read is used for product policy and expected revision. The actual write uses `UPDATE ... WHERE sessionId/status/revision` semantics through Prisma `updateMany`. If another request wins after the read, the compare-and-swap mutation affects zero rows and the application returns `409 ASSESSMENT_VERSION_CONFLICT`. The preliminary read is therefore not treated as the concurrency boundary.

### Submit

Assessment completion/revision increment and `AssessmentResult` creation happen in one Prisma transaction. The unique `assessmentId` result relationship plus completed-state replay path prevents semantic duplicate snapshots. The existing preliminary read can race, but the transaction's compare-and-swap decides correctness.

### Payment

Payment event insertion and session activation happen in one transaction. `(sessionId, idempotencyKey)` is unique; concurrent same-key requests are integration-tested so exactly one applies the side effect and the other is reported as replayed.

## HTTP/error taxonomy review

The current mapping is intentional:

| Status | Meaning in this API |
|---|---|
| `400` | malformed JSON or structurally invalid request schema |
| `401` | no usable anonymous bearer session |
| `404` | syntactically valid identity but requested session/assessment/result does not exist |
| `409` | valid request conflicts with aggregate order/lifecycle/revision |
| `422` | structurally valid candidate value conflicts with existing domain context |

Stable machine-readable error codes remain more important than prose messages for clients/tests.

## Accepted limitations rather than late over-engineering

- No generic repository abstraction: current use-case ports are easier to reason about and test.
- No dedicated subscription table: binary demo access state has no plan/expiry/provider lifecycle yet.
- No distributed lock: PostgreSQL constraints/transactions/CAS cover the required single-database consistency boundary.
- No real payment webhook/signature verification: `/pay` is explicitly simulated by the brief.
- No broad rate limiting/observability platform: useful production concerns, but lower signal than the required three-day correctness loop.

## Evidence after this review

- 54 unit/component tests;
- 34 real PostgreSQL integration tests;
- 2 Playwright browser journeys;
- `pnpm test:all` runs all three layers;
- lint + route-aware typecheck + production build remain required CI gates;
- the same public FREE and paid journeys are rerun after deployment.
