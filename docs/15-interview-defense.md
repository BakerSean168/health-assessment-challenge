# Technical interview defense guide

## Purpose

This document is not another architecture specification. It is a compact defense guide for the questions a reviewer is most likely to ask after reading the code. Each answer states the actual shipped trade-off, names the code evidence, and avoids claiming production capabilities the three-day challenge does not implement.

## 30-second architecture pitch

> This is a Next.js modular monolith with a deliberately thin HTTP layer, application use cases, domain policies, and Prisma repository adapters over PostgreSQL. The browser owns presentation state, while the server owns assessment answers, progress derivation, optimistic revision, result snapshots, and access projection. Every accepted answer is persisted before progression. Submit atomically freezes one versioned result. FREE clients never receive premium values, and the simulated payment is transactionally idempotent. The implementation was developed and repeatedly corrected through executable tests, including production-like Playwright runs.

## High-probability questions

### 1. Why Next.js Route Handlers instead of a separate NestJS/Express backend?

**Answer:** The challenge needs one small web product, six API routes, one PostgreSQL database, and a three-day delivery window. A split deployment would add CORS, duplicated configuration, deployment coordination, and another failure boundary without improving the evaluated domain behavior. Route Handlers are only transport adapters; domain/application code is framework-independent enough to move later if the product grows.

**Evidence:** `src/app/api/**`, `src/modules/**/application`, `src/modules/**/domain`, `src/modules/**/infrastructure`.

**Do not claim:** that Next.js is always preferable to a separate backend.

### 2. Why is `currentStep` not stored in the database?

**Answer:** Progress is already encoded by persisted answers. Storing a mutable step pointer would duplicate the same fact and allow drift, for example `gender/goal/activity` being present while `currentStep=GOAL`. `getNextRequiredStep()` derives the first missing or context-invalid semantic step on every recovery read. This also handles an earlier goal/weight edit invalidating target weight without destructive data clearing.

**Evidence:** `src/modules/assessment/domain/assessment.ts`, `GET /api/assessment`.

### 3. Why semantic step keys rather than numeric positions?

**Answer:** A numeric position couples persisted progress to one UI ordering. Semantic keys (`GENDER`, `GOAL`, `TARGET_WEIGHT`) keep meaning stable if the funnel is reordered or branching is introduced later. In v1 the flow is mostly linear, but the state model is not tied to screen indexes.

### 4. Why one Assessment per AnonymousSession?

**Answer:** Retake/history is not in the brief. A 1:1 relationship makes recovery deterministic and avoids inventing an “active assessment” selection rule. If accounts/history become requirements, `sessionId` can stop being unique and an explicit lifecycle/current-assessment concept can be added then.

**Evidence:** `Assessment.sessionId @unique` in `prisma/schema.prisma`.

### 5. Why no dedicated Subscription table?

**Answer:** The implemented access model has only one binary fact: `FREE | ACTIVE`. There is no plan, expiry, renewal, cancellation, provider customer, or billing cycle. A table containing only `sessionId + status` would add indirection without modeling a real lifecycle. `PaymentEvent` records the idempotent transition evidence. A dedicated Subscription entity becomes justified when those concepts actually exist.

**Evidence:** `AnonymousSession.subscriptionStatus`, `PaymentEvent`.

### 6. Is a random session UUID really authentication?

**Answer:** It is intentionally demo-grade anonymous bearer authentication, which the brief permits. The server issues a random UUID in an HttpOnly, production-Secure, SameSite=Lax cookie; clients cannot choose another identity through request JSON. It is not presented as account authentication. Production accounts would require a real identity/session system, rotation/revocation policy, CSRF/threat-model review, and possibly shorter-lived credentials.

**Evidence:** `src/modules/session/http/session-cookie.ts`, `POST /api/session` tests.

### 7. Why optimistic concurrency? What race does it solve?

**Answer:** Refresh recovery and multiple tabs can hold stale copies of the same assessment. Each aggregate mutation carries `expectedRevision`. The repository performs a database compare-and-swap update constrained by `sessionId + IN_PROGRESS + revision`. If another writer wins after the preliminary read, the mutation affects zero rows and the request becomes `409 ASSESSMENT_VERSION_CONFLICT`, so stale data cannot silently overwrite newer answers.

**Evidence:** `PrismaAssessmentRepository.saveStep()`, `optimistic-concurrency.test.ts`.

### 8. Isn't the preliminary read before the write racy?

**Answer:** Yes, and correctness does not depend on it. The read is for domain policy and user-friendly validation. The database CAS is the concurrency boundary. A race after the read is detected by the revision-conditioned update.

### 9. Why does submit use a transaction and a result snapshot?

**Answer:** Completion has two invariants that must commit together: the assessment becomes `COMPLETED`, and exactly one canonical result is persisted. The transaction performs the CAS completion and snapshot creation atomically. The snapshot is versioned so a later calculation-code change cannot silently rewrite what an earlier user was shown.

**Evidence:** `PrismaAssessmentSubmissionRepository.completeAssessment()`, unique `AssessmentResult.assessmentId`, `calculationVersion`.

### 10. What happens if the first submit succeeds but the HTTP response is lost?

**Answer:** A retry sees the completed assessment and existing canonical result and returns success without recalculating or inserting another snapshot. Submit retry semantics deliberately differ from stale answer writes: retrying completion is idempotent, while a stale PATCH remains a strict conflict.

**Evidence:** `submit-assessment.test.ts` retry case.

### 11. How is `/pay` idempotent under concurrency?

**Answer:** The caller supplies a session-scoped idempotency key. PostgreSQL enforces uniqueness on `(sessionId, idempotencyKey)`. Payment-event insertion and the FREE→ACTIVE state change happen in one transaction. Concurrent requests with the same key are tested: one applies the side effect and the other returns `replayed: true`, with one event persisted.

**Evidence:** `PrismaPaymentRepository`, `payment.test.ts`.

### 12. Why 400, 409, and 422 separately?

**Answer:** They represent different client recovery behavior. `400` means the JSON/schema itself is malformed or structurally invalid. `409` means a valid request conflicts with aggregate order, lifecycle, or optimistic revision. `422` means the scalar candidate is structurally valid but contradicts current domain context, such as a higher target for `LOSE_WEIGHT`. Stable error codes are the primary machine contract.

**Evidence:** `docs/04-api-contract.md`, Route Handlers.

### 13. Why reject a directly inconsistent target but keep an old target after an upstream edit?

**Answer:** A newly submitted contradictory target has no reason to be persisted, so it returns `422` without advancing revision. By contrast, an old target may have been valid when originally entered; after an upstream goal/current-weight edit it is retained as historical draft data while derived progress moves back to `TARGET_WEIGHT`. That avoids destructive clearing while still preventing submit.

### 14. Are HTTP Zod checks the only protection against invalid values?

**Answer:** No. Zod rejects malformed client input at the transport boundary, but the domain resolver/submission validation also rechecks the frozen scalar ranges. This matters if stored data came from an old migration, manual operation, seed, or other non-HTTP path. A persisted out-of-contract value cannot be treated as a complete assessment or used to create a result snapshot.

**Evidence:** `assessment.ts`, `submission.test.ts`, `submit-assessment.test.ts` persisted-invalid case.

### 15. Why not put all those numeric limits in database CHECK constraints too?

**Answer:** That would be a reasonable production hardening step. For this time-boxed challenge the invariants are enforced at the HTTP and domain layers and verified against real PostgreSQL. Adding CHECK constraints is useful if more write paths appear; it is not necessary to prove the required funnel behavior today. The design intentionally avoids pretending the current database is a complete clinical data platform.

### 16. Why are premium fields omitted instead of returned and blurred?

**Answer:** CSS hiding is not authorization. FREE projection constructs a different DTO that contains `{ locked: true }` and never serializes the calorie/date values. The same stored snapshot is projected fully only after server-side subscription state becomes ACTIVE.

**Evidence:** `result-projection.ts`, `free-result.test.ts` serialized-value assertions.

### 17. Why `Float` for measurements and BMI instead of Decimal?

**Answer:** These values do not have a financial exact-decimal requirement. Domain functions own explicit display rounding, while PostgreSQL/Prisma Float keeps the TypeScript/JSON boundary simple. If the domain later required exact fixed-point measurement semantics, the persistence type could change independently of the API shape.

### 18. Why only two Playwright tests?

**Answer:** Browser tests prove the two highest-value integration paths: FREE and paid. Boundary permutations, stale writes, concurrency, and idempotency are faster and more diagnostic in domain/integration tests against real PostgreSQL. This keeps E2E signal high instead of duplicating every lower-level case in a slow browser matrix.

### 19. Why use real PostgreSQL integration tests instead of mocking Prisma?

**Answer:** The hard parts of this challenge are database semantics: optimistic CAS, uniqueness, transaction rollback, retry behavior, and state recovery. Mocking Prisma would test our mock rather than those guarantees. The disposable PostgreSQL service applies committed migrations before the integration suite.

### 20. Why does local Playwright own port 3100?

**Answer:** Originally local Playwright could reuse any responsive dev process on port 3000 and accidentally validate stale code. It now starts the current checkout on a dedicated `127.0.0.1:3100` server with reuse disabled. Remote production verification skips the local app/database bootstrap entirely when `E2E_BASE_URL` is supplied.

### 21. Why `Cache-Control: private, no-store` on API responses?

**Answer:** Every API response is session-specific, and FREE/ACTIVE payloads can differ for the same URL. Correctness should not depend on current Cloudflare/Next cache defaults. A shared helper applies an explicit private/no-store policy to success and error JSON.

### 22. What was the most important production bug?

**Answer:** The first public concurrent Playwright run exhausted the dedicated PostgreSQL role because production `getPrismaClient()` created repeated Prisma/pg pools. A production-mode regression test was made to fail first, then the app was changed to share one client and cap its pool at four connections. The same public FREE/paid flows passed after redeployment. This is a useful example of production-like evidence overruling confidence in locally green code.

### 23. What did AI actually do, and what did you personally decide?

**Answer:** AI accelerated reference analysis, test enumeration, repetitive implementation, dependency review, and debugging. The developer owned requirement interpretation and acceptance/rejection decisions. Concrete rejected/corrected AI-assisted proposals include persisted `currentStep`, CSS-only premium hiding, unsupported ESLint/TypeScript upgrades, the per-request production Prisma lifecycle, missing explicit no-store caching, and persisting a semantically inconsistent target candidate. The evidence loop was requirement → failing test/reproduction → implementation → independent gates.

**Evidence:** `docs/07-ai-usage-log.md`, `docs/12-ai-retrospective.md`.

## Two-minute code walkthrough

A reviewer asking “show me the important code” can be taken through this order:

1. `prisma/schema.prisma` — ownership, revision, result snapshot, payment unique constraint.
2. `src/modules/assessment/domain/assessment.ts` — derived progress and cross-field validity.
3. `src/modules/assessment/application/save-assessment-step.ts` — application orchestration without Prisma/HTTP.
4. `src/modules/assessment/infrastructure/prisma-assessment-repository.ts` — revision CAS.
5. `src/modules/assessment/infrastructure/prisma-assessment-submission-repository.ts` — atomic completion/snapshot.
6. `src/modules/assessment/domain/result-projection.ts` — FREE values are structurally absent.
7. `src/modules/payment/infrastructure/prisma-payment-repository.ts` — transaction + unique idempotency key.
8. `src/test/integration/optimistic-concurrency.test.ts` and `payment.test.ts` — executable database evidence.
9. `src/test/e2e/*.spec.ts` — full product closure.
10. `docs/12-ai-retrospective.md` — judgment rather than generic “AI assisted” claims.

## Answers to avoid

Avoid saying:

- “I used DDD because it is best practice.” Explain the concrete boundary/problem instead.
- “The transaction makes everything thread-safe.” Name exactly which invariant/rows it protects.
- “UUID is secure authentication.” It is a demo anonymous bearer session.
- “The calorie formula is medically accurate.” It is a deterministic engineering-demo policy.
- “All edge cases are covered.” Name the intentional exclusions.
- “AI wrote most of it but tests passed.” Explain which proposals were rejected and why.
- “Latest dependency is always better.” The repository deliberately rejected incompatible major upgrades.

## Remaining questions where the correct answer is a limitation

A strong defense should acknowledge rather than hide these boundaries:

- no account identity, password recovery, device/session revocation, or full CSRF threat-model work;
- no real payment provider, webhook signature, refunds, expiry, recurring billing, or plan lifecycle;
- no multi-assessment history/restart model;
- no database CHECK constraints for every application bound;
- no broad load/performance benchmark or multi-region design;
- Chromium-only E2E in this challenge;
- calculation policy is deterministic demo logic rather than clinical guidance.

The intended answer is not “I forgot these.” It is “I kept them outside a three-day brief, and here is the boundary where I would add them if the requirement appears.”
