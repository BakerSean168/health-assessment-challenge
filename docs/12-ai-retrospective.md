# AI collaboration retrospective

## How AI was used

AI was used as an implementation and review accelerator, not as the source of truth for requirements. It helped summarize the reference funnel, propose domain/API shapes, draft test scenarios, implement vertical slices, audit dependency versions, and diagnose CI/deployment failures. Each accepted change remained constrained by reviewed acceptance criteria and executable tests.

The working loop was deliberately narrow:

```text
requirement / observed behavior
  -> reviewed acceptance criterion
  -> failing test or reproducible failure
  -> AI-assisted implementation
  -> lint / typecheck / tests / build
  -> developer review and refactor
```

## Where AI saved time

The highest leverage came from quickly enumerating edge cases and turning them into concrete test matrices: resumable progress, out-of-order steps, stale optimistic revisions, repeated submission, concurrent idempotent payment, FREE-versus-ACTIVE result projection, and deployment reproducibility. AI also accelerated repetitive adapter/DTO/component work while the domain contracts stayed explicit.

## Proposals or implementations that were rejected or corrected

1. **Persisted numeric/current step pointer.** The early design stored progress separately from answers. After auditing the reference funnel and dependency behavior, this was rejected because answers and `currentStep` could drift. The final model persists facts and derives `nextRequiredStep` from semantic answer keys.
2. **Client-side premium hiding.** A tempting result design sent full result data and blurred premium values. This was rejected because CSS is not authorization. FREE responses now omit protected values entirely and return only `{ locked: true }`.
3. **Latest-version upgrades without compatibility proof.** ESLint 10 and TypeScript 7 were both evaluated. The project itself largely worked, but the current Next lint/plugin stack did not support those versions cleanly, so both upgrades were rolled back rather than weakening linting or carrying custom compatibility hacks.
4. **Production Prisma lifecycle.** The production database helper created a fresh Prisma/pg pool on repeated lookups. Local tests did not expose it, but the first public concurrent Playwright run produced `P2037 TooManyConnections`. A production-mode failing regression test was added first; the fix reuses one application client and caps the pool at four connections.
5. **Personalized-response caching and semantic target writes.** A final interviewer-style code review found that session-scoped JSON had no explicit no-store policy, and a scalar-valid but goal-inconsistent target could be persisted while the funnel stayed on the same step. Failing integration assertions were added first; responses are now `private, no-store`, and inconsistent target candidates return `422 STEP_VALUE_INCONSISTENT` without mutating revision.
6. **Persisted-data trust and remote test isolation.** A technical-interview pressure test found that domain completion treated any non-null scalar already in PostgreSQL as valid, even when it violated the HTTP contract range. RED domain/submission tests proved the gap; domain validity now rechecks the shared bounds. The same pass removed unnecessary local PostgreSQL bootstrap from `E2E_BASE_URL` runs so deployed-environment tests depend only on the deployed system.
7. **Reviewer evidence leaked into product copy.** The implementation over-applied the “make evidence easy to review” goal and put persistence, snapshot, access-boundary, deterministic-demo, and server-transition narration directly into the live funnel. The user rejected that presentation. RED-first component expectations were changed to require end-user value language; the live copy now reads as a wellness product while technical proof remains in README/docs/tests.

## Evidence used to accept changes

At delivery time the repository has:

- 64 Vitest unit/component tests;
- 35 PostgreSQL integration tests against committed migrations;
- two Playwright browser flows covering FREE and paid journeys;
- GitHub Actions gates for lint, route-aware typecheck, tests, production build, and immutable container publication;
- the same two Playwright flows passing against the public HTTPS deployment;
- a reproducible GHCR -> guarded migration -> standalone Next.js -> Caddy release path.

The important AI lesson from the challenge is that strong assistance increases implementation speed, but only explicit contracts and independent evidence prevent fast mistakes from becoming architecture. The most valuable AI interactions were therefore not "generate the whole app" prompts; they were short iterations bounded by a test, a production observation, or a concrete design decision that could be rejected.
