# AI usage log

## Purpose

This file records meaningful AI-assisted engineering decisions during the challenge. It is intentionally more specific than a generic statement such as "AI was used to help code."

For each noteworthy interaction, record what AI proposed, what evidence constrained the decision, what was accepted/rejected, and why.

## Working protocol

1. Start from an acceptance criterion or explicit design question.
2. Ask AI for alternatives, edge cases, or implementation help.
3. Review the proposal against the challenge scope and existing tests.
4. Prefer writing/approving the failing test before accepting implementation.
5. Record disagreements or important corrections here.

## Entries

### 2026-09-10 — Architecture planning

**Context**

Before implementation, the challenge brief and the BetterMe-style reference funnel were analyzed together.

**AI contribution**

AI helped compress the long reference funnel into technical phases and proposed an architecture containing anonymous session state, incremental persistence, semantic step keys, optimistic concurrency, result snapshots, server-side access projection, and idempotent simulated payment.

**Developer decision**

Accepted the general architecture, with the explicit constraint that it remain a small modular monolith rather than introducing Redis, queues, microservices, CQRS, or other infrastructure that does not earn its cost in a three-day challenge.

**Evidence / rationale**

The challenge emphasizes state recovery, correctness, permissions, testing, and AI efficiency. The selected architecture maps directly to those behaviors while keeping the implementation reviewable.

### 2026-09-10 — TDD as the implementation method

**Context**

Initial planning treated tests as an important project area, but the development order was not yet explicitly test-first.

**Developer correction**

The implementation method was changed to outside-in TDD with vertical slices.

**Decision**

Each non-trivial behavior will begin with an acceptance criterion and failing test, followed by minimal implementation and refactoring.

**Why this matters**

This prevents AI-generated implementation from defining behavior implicitly and turns the challenge requirements into executable evidence throughout development rather than adding tests at the end.

## Entry template

### YYYY-MM-DD — Short title

**Context**

What was being designed or implemented?

**AI proposal**

What did AI recommend or generate?

**Developer review**

What was accepted, changed, or rejected?

**Evidence**

Which requirement, test, measurement, code constraint, or trade-off informed the decision?

**Outcome**

What changed in code/docs/tests?
