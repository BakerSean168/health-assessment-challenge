# TDD strategy and test matrix

## 1. Development model

The implementation uses outside-in TDD with small vertical slices.

```text
Acceptance criterion
      |
      v
RED: executable failing behavior
      |
      v
GREEN: smallest implementation that satisfies it
      |
      v
REFACTOR: improve names/boundaries without changing behavior
      |
      v
Commit the slice and its evidence
```

The purpose is not to maximize test count. The purpose is to make each non-trivial behavior explicit before implementation and to keep AI-generated changes constrained by executable expectations.

## 2. Test layers

### Unit tests

Use for pure logic with no database/network dependency:

- BMI calculation and classification;
- recommended-intake policy;
- target-date policy;
- next-required-step resolver derived from persisted answers;
- cross-field validity after editing earlier answers;
- result-access projection;
- error/policy helpers when they contain meaningful behavior.

### Integration tests

Use for the core of the challenge:

- session lifecycle;
- Prisma persistence;
- step saving;
- resume state;
- ordering;
- optimistic concurrency;
- submit transaction;
- result snapshot;
- free/active result behavior;
- payment idempotency.

### End-to-end tests

Keep browser tests intentionally small:

1. new visitor -> complete assessment -> free result with locked premium fields;
2. new visitor -> complete assessment -> pay -> full result unlocked.

## 3. Behavior matrix

Behavior IDs use the `Bxx` prefix so they cannot be confused with executable implementation tasks (`Txx`) in `06-implementation-plan.md`.

| ID | Behavior | Layer | RED condition | Done when |
|---|---|---|---|---|
| B01 | create/reuse anonymous session | integration | no session implementation | same browser identity reuses session |
| B02 | persist first answer | integration | assessment cannot save gender | DB contains answer + revision advances |
| B03 | resume after refresh | integration/unit | GET loses saved state | answers restored + next required step derived |
| B04 | reject skipped step | integration/unit | target step accepted too early | stable `STEP_OUT_OF_ORDER` |
| B05 | cross-field target consistency | integration/unit | invalid direct target is saved or upstream edit leaves progress falsely complete | direct inconsistent candidate is rejected; upstream edit derives `TARGET_WEIGHT` without unnecessary data loss |
| B06 | reject stale write | integration | two writers overwrite/accept stale duplicate | stale revision returns `409`, even for same-value retry |
| B07 | calculate BMI | unit | function absent | fixed examples + boundaries pass |
| B08 | calculate intake | unit | policy absent | frozen policy cases pass |
| B09 | estimate target date | unit | policy absent | deterministic reference-date cases pass |
| B10 | reject incomplete/stale submit | integration | partial or stale assessment completes | missing-step or version-conflict error returned |
| B11 | create result snapshot | integration | complete submit has no atomic result | one persisted versioned result + completed aggregate |
| B12 | retry submit safely | integration | second submit duplicates/recalculates or fails only because revision advanced | existing result returned |
| B13 | free result projection | unit/integration | premium values leak | values omitted from response |
| B14 | activate subscription | integration | `/pay` has no effect | session becomes `ACTIVE` |
| B15 | replay payment safely | integration | duplicate payment repeats effect | unique event + replay response |
| B16 | active result projection | integration | active user still sees locked shape | full DTO returned |
| B17 | complete free browser flow | e2e | UI not wired | assessment -> preview passes |
| B18 | complete paid browser flow | e2e | pay/unlock not wired | preview -> pay -> full result passes |
| B19 | reject malformed/injection-shaped input | integration/contracts | HTTP boundary accepts missing, object, or injection-shaped scalar input | `400 VALIDATION_ERROR` and no persisted mutation |

## 4. Example RED-first slice

### Acceptance criterion

> When two clients hold revision 4 and one saves first, the second must not overwrite the newer value.

### RED test concept

```ts
const a = await loadAssessment();
const b = await loadAssessment();

await saveWeight({ value: 72, expectedRevision: a.revision });

const staleWrite = await saveWeight({
  value: 75,
  expectedRevision: b.revision,
});

expect(staleWrite.status).toBe(409);
expect(staleWrite.body.error.code).toBe(
  "ASSESSMENT_VERSION_CONFLICT",
);
```

Only after this behavior is executable do we implement `revision`-conditioned persistence.

## 5. Deterministic calculations

Tests must not depend directly on today's date.

Bad:

```ts
estimateGoalDate(input); // internally reads new Date()
```

Preferred:

```ts
estimateGoalDate(input, new Date("2026-09-10T00:00:00Z"));
```

The same inputs therefore produce the same expected result in CI tomorrow.

## 6. Database testing

Integration tests should use a real PostgreSQL-compatible test database rather than mocking Prisma behavior that is central to the challenge.

The implemented strategy uses a disposable PostgreSQL 17 Compose service locally and a PostgreSQL service container in GitHub Actions. Each top-level database-backed suite resets aggregate roots before execution so E2E and integration runs cannot leak state into one another.

Each integration test must isolate state through transactions, cleanup, or unique fixtures so ordering does not affect results.

## 7. What not to over-test

Avoid tests that merely snapshot implementation noise:

- framework-generated markup;
- private helper call counts;
- exact log strings;
- Tailwind class names;
- implementation-specific repository internals.

Tests should survive refactoring when user-visible or domain behavior has not changed.

## 8. AI-assisted TDD protocol

AI can propose scenarios and implementation, but it does not get to silently redefine behavior.

For each slice:

1. write/approve the acceptance criterion;
2. let AI propose edge cases;
3. reject or amend incorrect scenarios;
4. commit the failing test;
5. implement the smallest passing change;
6. review the diff against the criterion;
7. refactor only while all tests remain green;
8. log notable AI disagreements in `07-ai-usage-log.md`.

This makes AI usage reviewable rather than a generic claim that "AI helped write the project."
