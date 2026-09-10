# Health Assessment Full-Stack Challenge

A TDD-first implementation of a progressive health-assessment funnel inspired by BetterMe-style Web-to-App onboarding.

The project is intentionally scoped as a three-day engineering challenge. The goal is not to clone a commercial product or reproduce dozens of marketing screens. Instead, it extracts the core product mechanics that matter technically: progressive data collection, server-side persistence and recovery, deterministic result generation, subscription-gated result projection, idempotent payment simulation, and evidence-driven testing.

## Status

**Phase:** T07 server-side step policy complete; T08 optimistic concurrency verification is next

The repository is public from the start so the implementation history, test-first workflow, design decisions, and trade-offs remain reviewable.

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

The planned implementation keeps seven persisted assessment inputs while using feedback screens to preserve the ask -> derive -> give-value rhythm observed in the reference funnel.

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
- Make assessment submit and simulated payment safe to retry while keeping stale answer writes strict under optimistic concurrency.
- Develop behavior-first using RED -> GREEN -> REFACTOR.
- Keep CI as executable evidence of linting, typing, tests, and build health.

## Frozen stack

- Node.js 24.19.0 + pnpm 11.22.0
- Next.js 16.3.4 App Router + React 19.2.8 + strict TypeScript
- Tailwind CSS 4
- shadcn/ui `base-nova` preset using Base UI primitives
- Lucide icons
- PostgreSQL
- Prisma
- Zod
- Vitest
- Playwright
- GitHub Actions
- Vercel-compatible deployment

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

## Non-goals

This challenge intentionally does **not** attempt to implement a production health platform, real medical guidance, real payment processing, marketing analytics, upsells, referral systems, or a pixel-perfect BetterMe clone.

The calculation policy for calorie guidance and target-date estimation will be explicitly documented as a deterministic engineering-demo policy before it is implemented. It will not be presented as medical advice.

## Repository principles

1. Behavior before implementation.
2. Server state is authoritative.
3. TypeScript types do not replace runtime validation.
4. Authorization is not UI hiding.
5. Persist facts; derive presentation/progress state instead of duplicating it.
6. Retry safety is part of correctness, but stale writes must not be silently accepted.
7. Prefer explicit, small abstractions over framework-heavy ceremony.
8. Every non-obvious design choice should be explainable in an interview.
