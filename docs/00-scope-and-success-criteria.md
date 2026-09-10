# Scope and success criteria

## 1. Purpose

This repository implements the engineering core of a progressive health-assessment funnel under a constrained three-day delivery window.

The brief emphasizes backend engineering rather than visual cloning. The implementation therefore prioritizes persistence, state consistency, deterministic business logic, access control, retry safety, tests, CI, documentation, and deployment evidence.

## 2. Source-derived functional scope

The challenge requires a user to progress through a health assessment containing fields such as gender, goal, age, height, current weight, target weight, and exercise frequency. Progress must be saved incrementally and recoverable after interruption.

After completion, the server must calculate and persist a result containing at least:

- BMI;
- recommended intake guidance;
- an estimated target date.

Result access depends on subscription status:

- a free user receives a deliberately restricted result;
- an active subscriber receives the complete result.

A simulated `/pay` flow changes the subscription state so the same result can be unlocked without integrating a real payment provider.

Testing must cover more than the happy path, including interrupted/resumed assessment state, repeated or out-of-order submissions, free-versus-active result behavior, payment state changes, invalid input, and boundary conditions.

## 3. Product interpretation

The reference BetterMe-style funnel is treated as a product-pattern reference, not a requirement to reproduce all captured screens.

We extract four mechanics:

1. **Progressive commitment** — ask for a small amount of information at a time.
2. **Ask -> derive -> give value** — surface meaningful feedback before the final paywall.
3. **Personalized projection** — convert current state plus goal into an understandable future outcome.
4. **Value before paywall** — show enough useful information to establish trust while keeping selected fields server-locked for free users.

## 4. Planned assessment inputs

The initial product model contains seven persisted answer groups:

| Step key | Field | Persistence | Notes |
|---|---|---:|---|
| `GENDER` | `gender` | yes | categorical |
| `GOAL` | `goal` | yes | lose / maintain / gain |
| `ACTIVITY` | `activityLevel` | yes | categorical |
| `HEIGHT` | `heightCm` | yes | validated numeric |
| `WEIGHT` | `weightKg` | yes | validated numeric |
| `AGE` | `age` | yes | validated integer |
| `TARGET_WEIGHT` | `targetWeightKg` | yes | required in v1; cross-validated against current weight and goal |

`ANALYSIS`, `WELLNESS_PROFILE`, `PROJECTION`, and result/paywall views are presentation or derived-result states rather than assessment steps. The server does not persist a `currentStepKey`; the next required answer step is derived from persisted answers and domain validation on every read.

## 5. Definition of done

The challenge is considered complete only when all of the following are true:

- A fresh visitor can start an anonymous assessment.
- Each answer is persisted server-side as the user progresses.
- A returning browser session restores saved answers and derives the correct resumable step from server state.
- Changing an earlier answer revalidates dependent answers and can move the resumable step backward without deleting valid data unnecessarily.
- Invalid, skipped, and stale writes are rejected using stable error codes.
- A complete assessment can be submitted exactly once semantically, while retrying the request remains safe.
- Submission writes a versioned result snapshot.
- A free response never contains locked premium values.
- Simulated payment changes subscription state and is safe to replay.
- An active subscriber receives the complete result from the same result endpoint.
- Unit and integration tests cover the behavior matrix documented in `05-tdd-strategy.md`.
- Two high-value Playwright journeys pass.
- CI runs lint, typecheck, tests, and build.
- The application is deployed to a public URL.
- README explains architecture, schema, API, local setup, testing, assumptions, limitations, and AI usage.

## 6. Non-goals

The following are explicitly outside the initial challenge scope:

- real authentication/accounts;
- real billing or payment-provider webhooks;
- marketing email collection;
- analytics attribution;
- dozens of reference-funnel marketing screens;
- scratch-card discounts, countdowns, or upsells;
- real clinical recommendation logic;
- Redis, queues, microservices, CQRS, or event sourcing without a demonstrated need;
- pixel-perfect duplication of third-party visual assets.

## 7. Quality bar

The implementation should optimize for reviewability rather than feature count. A reviewer should be able to answer the following within a few minutes:

- Where is runtime validation performed?
- What enforces assessment order?
- How is state restored?
- How are stale writes handled?
- Where are calculations implemented and tested?
- Why does a free response not leak premium data?
- Why are submit and payment retries safe?
- What behavior does each test prove?
- Which decisions were made by the developer rather than accepted blindly from AI suggestions?
