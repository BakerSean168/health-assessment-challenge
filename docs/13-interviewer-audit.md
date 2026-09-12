# Interviewer-perspective delivery audit

## Purpose

This is a final review against the supplied three-day challenge brief, written from the perspective of an interviewer who has limited time and wants fast evidence rather than implementation narration. The audit distinguishes required behavior from deliberate scope choices.

## Requirement-to-evidence matrix

| Brief area | Evidence a reviewer can verify | Status |
|---|---|---|
| Professional API design | Six small HTTP endpoints, stable DTO/error codes, thin Route Handlers, full contract in `04-api-contract.md` | PASS |
| Stable/extensible data model | Explicit relational columns, 1:1 session-assessment, 1:1 session-subscription, immutable result snapshot, payment idempotency events, Mermaid schema | PASS |
| Incremental persistence | Every accepted answer is persisted before UI progression; revision increments are integration-tested | PASS |
| Progress recovery | `GET /api/assessment` restores answers; `nextRequiredStep` is derived from persisted facts; public E2E reloads mid-funnel | PASS |
| State consistency | Server-side step ordering, direct inconsistent target rejection, upstream cross-field revalidation, strict stale-write `409`, real concurrent-writer integration test | PASS |
| BMI / intake / target date | Versioned `demo-v1` pure calculations with explicit bounds/rounding/reference date and 22 calculation tests | PASS |
| Persist calculated result | Submit transaction creates one canonical `AssessmentResult` snapshot and completes the aggregate atomically | PASS |
| FREE vs member access | FREE JSON omits premium values entirely; ACTIVE reads the same stored snapshot with protected fields present | PASS |
| `/pay` closed loop | Session-scoped idempotency key, replay/concurrent tests, public browser paywall flow, README cURL | PASS |
| Extreme/missing/illegal input | Inclusive boundary tests plus route-level missing/null/object/injection-shaped payload rejection and goal-inconsistent target rejection with no mutation | PASS |
| Interrupted/repeated/out-of-order/concurrent behavior | Integration tests cover resume, skip rejection, stale same-value retry, submit retry, concurrent OCC and payment replay | PASS |
| One-command tests | `pnpm test:all` runs unit/component + PostgreSQL integration + Playwright E2E | PASS |
| CI | GitHub Actions runs Quality, PostgreSQL integration, Chromium E2E, and immutable container publishing | PASS |
| Public runnable URL | `https://assessment.bakersean.top`, HTTPS via Cloudflare/Caddy, production smoke and public Playwright pass | PASS |
| Paid evaluator session | Synthetic ACTIVE session ID is in README and returns full result projection | PASS |
| Schema diagram | README quick diagram + detailed `03-domain-and-data-model.md`; user/session, assessment data, subscription state, result snapshot, and payment events are explicit relations | PASS |
| AI-use retrospective | Running log + concise retrospective with accepted/rejected AI proposals and executable evidence | PASS |
| Frontend completion willingness | Mobile-first single-question pacing, progress indicator, persisted refresh, honest trust copy, visible value before paywall, Base UI accessibility primitives | PASS for brief scope |

## Deliberate trade-offs a reviewer may ask about

### Why is Subscription a very small 1:1 table?

The brief explicitly asks the schema to show the relationship between user/session data, assessment records, and subscription information. The final model therefore uses `Subscription.sessionId` as its primary/foreign key and stores only the facts the mock flow actually owns: `status`, `activatedAt`, and timestamps. This satisfies the required relational boundary without inventing plan, expiry, provider-customer, renewal, or cancellation concepts that the challenge does not implement.

### Why one assessment per session?

History/restarts are not required. `Assessment.sessionId` is unique, which makes recovery unambiguous and keeps the time-boxed aggregate small. A future account/history model can change this to 1:N without changing result-snapshot semantics.

### Why a static target-date policy?

The challenge requires a deterministic target prediction, not a clinical model. `demo-v1` uses an injected date and documented fixed rate so tests remain reproducible. Engineering-demo details stay in repository documentation; the live UI uses a concise general-wellness/not-medical-advice disclaimer rather than implementation narration.

### Why only two browser E2E tests?

The browser suite is reserved for the two end-to-end behaviors with the highest integration value: FREE and paid journeys. Boundary combinatorics, concurrency, and error semantics live lower in unit/integration tests where failures are faster and more diagnostic.

## Findings discovered during final interviewer audit

1. `test:all` previously omitted browser E2E even though the brief asks for a one-command automated test path. It now runs all three test layers.
2. Runtime validation already rejected malformed values, but the brief explicitly calls out illegal-value injection. A route-level integration test now proves missing, null, object, and injection-shaped numeric payloads return `400 VALIDATION_ERROR` without persistence.
3. README previously linked to API/schema docs but forced reviewers to hunt for the highest-signal evidence. The first screen now includes a reviewer path, API surface, actual schema, `/pay` cURL, test coverage rationale, and intentional exclusions.
4. Public responses exposed `X-Powered-By: Next.js`. This is not a functional requirement, but the production config now disables that unnecessary framework disclosure.
5. Final docs still contained a few bootstrap-era words such as "planned" and an obsolete future-tense database-test note. Those were reconciled to the implementation that actually shipped.
6. A lightweight desktop/mobile browser audit found no horizontal overflow, console errors, page errors, or failed network requests on the landing, assessment entry, and paid-result surfaces. A local app icon was added so the submission does not fall back to a missing favicon request.
7. The live UI had accumulated reviewer-facing implementation narration (persistence, versioned snapshots, access boundaries, server transition details). A product-surface pass moved that evidence back to README/docs/tests and rewrote landing, questionnaire, processing, result, checkout, and metadata copy around end-user value while keeping mock checkout transparent.
8. A final source-to-brief audit found two remaining alignment gaps that the repository's earlier self-audit had normalized as trade-offs: subscription state was not yet a separate relation even though the brief explicitly asks for a subscription-information table, and stale-write conflicts were detected but not recovered in the browser. The final pass introduces the minimal 1:1 `Subscription` extension table with a data-preserving backfill migration and adds client-side canonical-state refresh on `ASSESSMENT_VERSION_CONFLICT`.

## Remaining known limitations

- Anonymous session cookies are intentionally demo authentication, not user accounts.
- Payment is simulated; there is no provider signature/webhook verification.
- Subscription state is intentionally binary; the dedicated 1:1 table has no plan, expiry, cancellation, or renewal lifecycle because the brief only requires mocked FREE/ACTIVE access.
- One anonymous session owns one assessment; no assessment history/restart UI.
- E2E is Chromium-only; no broad device/browser compatibility matrix.
- No load/performance benchmark suite; the challenge's correctness/state-consistency behaviors were prioritized.
- The health calculations are deterministic demo policies, not clinical recommendations.

These limitations are explicit rather than hidden because each corresponds to work outside the supplied challenge's core evaluation boundary.

## Second-round code review

A separate code-level pass reviewed repository ports, transaction boundaries, HTTP caching/status semantics, error handling, and test isolation. It found three concrete issues worth changing rather than merely documenting:

- session-personalized JSON had no explicit cache directive; all API success/error responses now use `Cache-Control: private, no-store`;
- a directly entered target weight could be scalar-valid but contradict the selected goal, be persisted, and leave the UI on the same step; it now returns `422 STEP_VALUE_INCONSISTENT` without advancing revision;
- local Playwright could reuse an unrelated/stale server on port 3000; it now owns a dedicated port and never reuses an existing process.

The review also retained several choices deliberately: `400` is used for malformed request syntax/schema, `422` for a structurally valid but semantically inconsistent answer, and `409` for aggregate state/order/concurrency conflicts; repository interfaces remain use-case-specific rather than collapsing into a generic repository; and submit correctness continues to rely on the transactional compare-and-swap boundary rather than trying to make its preliminary read snapshot authoritative.

## Interview defense

For likely follow-up questions and concise code-backed answers, see `15-interview-defense.md`. The guide explicitly separates shipped guarantees from demo-scope limitations so the interview explanation does not overclaim production authentication, billing, or medical correctness.

## Third-round invariant/HTTP audit

A subsequent review attacked lower-level assumptions that the earlier type/source-of-truth pass did not cover. RED integration tests demonstrated four concrete gaps: JSON-looking `text/plain` requests were accepted by write routes; a successful CAS writer could report a later writer’s revision because it re-read after commit; PostgreSQL itself did not reject several structurally impossible states; and payment replay returned success from the dedupe record without re-establishing ACTIVE if that side effect had been externally lost.

The final implementation requires `application/json` on PATCH/submit/pay (`415` otherwise), returns the exact `updateManyAndReturn` CAS row, adds committed/validated CHECK constraints for structural persistence invariants, makes replay re-apply the idempotent ACTIVE transition, repairs missing 1:1 child rows during bootstrap, and proves concurrent submit collapse with one canonical result snapshot. The fast suite is now 83 tests and the real-PostgreSQL integration suite is 49 tests. Main CI passed all four jobs; production had zero pre-migration invariant violations, applied all eight migrations, passed both public Playwright journeys, and returned the expected live `415` for a JSON-looking `text/plain` payment request.
