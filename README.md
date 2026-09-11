# Health Assessment Full-Stack Challenge

[![CI](https://github.com/BakerSean168/health-assessment-challenge/actions/workflows/ci.yml/badge.svg)](https://github.com/BakerSean168/health-assessment-challenge/actions/workflows/ci.yml)

A TDD-first implementation of a progressive health-assessment funnel inspired by BetterMe-style Web-to-App onboarding.

The project is intentionally scoped as a three-day engineering challenge. The goal is not to clone a commercial product or reproduce dozens of marketing screens. Instead, it extracts the core product mechanics that matter technically: progressive data collection, server-side persistence and recovery, deterministic result generation, subscription-gated result projection, idempotent payment simulation, and evidence-driven testing.

## Status

**Phase:** implementation and public deployment complete; delivery documentation and AI retrospective reconciled

The repository is public from the start so the implementation history, test-first workflow, design decisions, and trade-offs remain reviewable.

**Live demo:** https://assessment.bakersean.top

The live site is intentionally product-facing: it presents the wellness journey to an end user rather than narrating persistence, snapshots, server state, TDD, or other implementation details. Reviewer evidence lives in this README, the docs, tests, and commit history.

**Synthetic paid evaluator sessionId:** `11111111-1111-4111-8111-111111111111` (contains demo data only).

## Reviewer quick path

If you have only a few minutes:

1. Open the [live assessment](https://assessment.bakersean.top) and complete the seven-step funnel. Refresh once mid-flow to verify server-side recovery.
2. On the FREE result, inspect the network response for `GET /api/assessment/result`: premium values are absent, not CSS-hidden.
3. Complete the simulated payment and confirm the same result endpoint changes to the ACTIVE projection.
4. Run `pnpm test:all` for all automated test layers, or inspect the green GitHub Actions run from the CI badge.
5. Read the [domain/data model](docs/03-domain-and-data-model.md), [API contract](docs/04-api-contract.md), and [AI retrospective](docs/12-ai-retrospective.md) for the three highest-signal design areas.

### API surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/session` | Create/reuse the server-owned anonymous session and assessment |
| `GET` | `/api/assessment` | Restore persisted answers and derived resumable step |
| `PATCH` | `/api/assessment/steps/:stepKey` | Validate and persist one answer with optimistic revision control |
| `POST` | `/api/assessment/submit` | Atomically complete the aggregate and create one versioned result snapshot |
| `GET` | `/api/assessment/result` | Return the FREE or ACTIVE server-side result projection |
| `POST` | `/api/pay` | Idempotently simulate payment and activate the session |

### Reproduce `/pay` with cURL

```bash
BASE_URL=https://assessment.bakersean.top
COOKIE_JAR=$(mktemp)

curl -sS -c "$COOKIE_JAR" -X POST "$BASE_URL/api/session"
curl -sS -b "$COOKIE_JAR" \
  -H 'content-type: application/json' \
  -d '{"idempotencyKey":"reviewer_curl_demo_001"}' \
  "$BASE_URL/api/pay"

rm -f "$COOKIE_JAR"
```

The second request is safe to repeat with the same cookie/key and reports `replayed: true`. The fixed paid session above is provided separately so a reviewer can inspect an already-ACTIVE result without mutating a fresh browser session.

## Product flow

```mermaid
flowchart TD
    A[Landing] --> B[Gender]
    B --> C[Goal]
    C --> D[Activity]
    D --> E[Height]
    E --> F[Current Weight]
    F --> G[Age]
    G --> H[Target Weight]
    H --> I[Analyze]
    I --> J[Wellness Profile]
    J --> K[Projection]
    K --> L[Free Result / Paywall]
    L -->|POST /api/pay| M[Active Subscription]
    M --> N[Full Result]
```

The implementation keeps seven persisted assessment inputs while using feedback screens to preserve the ask -> derive -> give-value rhythm observed in the reference funnel.

## Engineering goals

- Incrementally persist assessment answers on the server.
- Restore the exact resumable state after refresh or revisit by deriving progress from persisted answers.
- Revalidate dependent answers when an earlier answer changes.
- Validate runtime input at the HTTP boundary.
- Enforce funnel ordering on the server, not only in the UI.
- Protect stale writes with optimistic concurrency control.
- Generate deterministic result snapshots on submit.
- Return different result DTOs for free and active subscriptions.
- Never send locked premium values to free clients.
- Mark all session-scoped API responses as private/no-store.
- Make assessment submit and simulated payment safe to retry while keeping stale answer writes strict under optimistic concurrency.
- Develop behavior-first using RED -> GREEN -> REFACTOR.
- Keep CI as executable evidence of linting, typing, tests, and build health.

## Frozen stack

- Node.js 24 LTS (`24.21.0` in CI; engine `>=24.19 <25`) + pnpm 11.22.0
- Next.js 16.3.4 App Router + React 19.3.0 + TypeScript 5.9.3 (`strict`)
- Tailwind CSS 4
- shadcn/ui `base-nova` preset using Base UI primitives
- Lucide icons
- PostgreSQL
- Prisma 7.10 + PostgreSQL 17 integration environment
- Zod 4.6
- Vitest 5
- Playwright 1.63
- GitHub Actions
- Docker/GHCR deployment to the existing Chengdu Aliyun host behind Caddy

The UI layer follows a library-first policy: when shadcn/ui provides a suitable component, use that component as the accessible, styled baseline and customize it locally for the product rather than rebuilding the primitive from scratch. Project-specific composition remains encouraged; duplicate primitives are not.

Exact dependency versions are pinned by the lockfile during bootstrap.

## Architecture at a glance

```text
Browser / React funnel
        |
        v
Next.js Route Handlers
        |
        v
Application use cases
        |
        +-----------------------+
        |                       |
        v                       v
Domain policies             Repositories
(step flow, calculations,       |
 result access)                 v
                            Prisma / PostgreSQL
```

HTTP handlers stay thin. Domain calculations do not depend on React, Prisma, cookies, or wall-clock time. Result access is projected server-side according to subscription state.

### Actual persistence model

```mermaid
erDiagram
    ANONYMOUS_SESSION ||--|| ASSESSMENT : owns
    ASSESSMENT ||--o| ASSESSMENT_RESULT : snapshots
    ANONYMOUS_SESSION ||--o{ PAYMENT_EVENT : records

    ANONYMOUS_SESSION {
      uuid id PK
      enum subscription_status
    }
    ASSESSMENT {
      uuid id PK
      uuid session_id UK
      int revision
      enum status
      float height_cm
      float weight_kg
      int age
      float target_weight_kg
    }
    ASSESSMENT_RESULT {
      uuid id PK
      uuid assessment_id UK
      float bmi
      int recommended_daily_calories
      date estimated_goal_date
      string calculation_version
    }
    PAYMENT_EVENT {
      uuid id PK
      uuid session_id FK
      string idempotency_key
      enum status
    }
```

V1 deliberately keeps the binary `FREE | ACTIVE` subscription state on `AnonymousSession` and records transitions in `PaymentEvent`, rather than creating a speculative subscription table with no plan, expiry, renewal, or provider metadata. If those concepts become requirements, a dedicated 1:1 `Subscription` aggregate can be introduced without changing assessment ownership.

## TDD workflow

Every implementation task follows this loop:

```text
Acceptance criterion
        -> failing test (RED)
        -> minimal implementation (GREEN)
        -> refactor without behavior change
        -> commit with evidence
```

Integration tests drive persistence, resume behavior, ordering, optimistic locking, submission, authorization, and payment semantics. Unit tests drive pure calculation and policy logic. Playwright is reserved for the two highest-value browser flows.

## Run locally

Prerequisites: Node.js 24, pnpm 11, and Docker. The quickest local path reuses the disposable PostgreSQL test container:

```bash
pnpm install
pnpm db:test:up
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public' pnpm db:migrate:deploy
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/health_assessment_test?schema=public' pnpm dev
```

Quality gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
```

One-command automated test run:

```bash
pnpm test:all
```

### Test coverage by behavior

| Layer | Current evidence | Why this layer exists |
|---|---|---|
| Unit/component | 62 tests | Pure calculation boundaries, step policy, FREE redaction, production Prisma lifecycle, and product-component behavior should fail fast without infrastructure noise |
| PostgreSQL integration | 35 tests | Persistence, recovery, ordering, optimistic concurrency, malformed/injection-shaped input, atomic submit, result authorization, and payment idempotency depend on real database/HTTP-boundary semantics |
| Playwright | 2 browser journeys | The two highest-value user paths prove cookies, Next routes, refresh recovery, FREE result, paywall, simulated payment, and ACTIVE result work together |
| GitHub Actions | 4 jobs | A clean runner proves lint/typecheck/tests/build and immutable application/migration image publication are reproducible |

Intentionally not covered in this three-day scope: real account authentication, payment-provider/webhook integration, multi-plan subscription billing, cross-browser/device matrices beyond Chromium, load testing, and the reference product's marketing/upsell screens. Those are omitted because the brief evaluates the backend/data/testing closed loop rather than production billing or pixel-perfect funnel replication. Behavior coverage is prioritized over chasing a line-coverage percentage that would reward low-value implementation-detail tests.

The two browser flows can also be pointed at an already-deployed environment without starting a local dev server:

```bash
E2E_BASE_URL=https://assessment.bakersean.top pnpm test:e2e
```

Evaluator-side paid projection check:

```bash
curl -sS 'https://assessment.bakersean.top/api/assessment/result' \
  -H 'Cookie: health_assessment_session=11111111-1111-4111-8111-111111111111'
```

## Documentation

- [Scope and success criteria](docs/00-scope-and-success-criteria.md)
- [Reference funnel audit](docs/01-reference-funnel-audit.md)
- [System architecture](docs/02-architecture.md)
- [Domain and data model](docs/03-domain-and-data-model.md)
- [API contract](docs/04-api-contract.md)
- [TDD strategy and test matrix](docs/05-tdd-strategy.md)
- [Implementation plan](docs/06-implementation-plan.md)
- [AI usage log](docs/07-ai-usage-log.md)
- [Decision log](docs/08-decisions.md)
- [UI component policy](docs/09-ui-component-policy.md)
- [Calculation policy v1](docs/10-calculation-policy.md)
- [Deployment and evaluator demo](docs/11-deployment.md)
- [AI collaboration retrospective](docs/12-ai-retrospective.md)
- [Interviewer-perspective audit](docs/13-interviewer-audit.md)
- [Interviewer code-review audit](docs/14-code-review-audit.md)
- [Technical interview defense guide](docs/15-interview-defense.md)

## Non-goals

This challenge intentionally does **not** attempt to implement a production health platform, real medical guidance, real payment processing, marketing analytics, upsells, referral systems, or a pixel-perfect BetterMe clone.

The calculation policy for calorie guidance and target-date estimation is documented as a deterministic engineering-demo policy in `docs/10-calculation-policy.md`. It is not presented as medical advice.

## Repository principles

1. Behavior before implementation.
2. Server state is authoritative.
3. TypeScript types do not replace runtime validation.
4. Authorization is not UI hiding.
5. Persist facts; derive presentation/progress state instead of duplicating it.
6. Retry safety is part of correctness, but stale writes must not be silently accepted.
7. Prefer explicit, small abstractions over framework-heavy ceremony.
8. Every non-obvious design choice should be explainable in an interview.
