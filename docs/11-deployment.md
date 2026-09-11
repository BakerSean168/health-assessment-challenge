# Deployment and evaluator demo

## Goal

T21 requires one stable public deployment of the complete funnel, including the simulated payment transition. The application is deployment-provider agnostic at the domain/application layers; the current target is a Node.js 24-capable Next.js host plus managed PostgreSQL.

## Required production configuration

Set one server-side environment variable:

```text
DATABASE_URL=postgresql://...
```

Use a managed PostgreSQL connection appropriate for serverless/hosted Node workloads. Do not expose the integration-test container or reuse its credentials in production.

The anonymous session cookie becomes `Secure` automatically when `NODE_ENV=production`, while remaining `HttpOnly`, `SameSite=Lax`, and scoped to `/`.

## Database migration

Apply the committed schema before sending traffic:

```bash
pnpm db:migrate:deploy
```

`prisma migrate deploy` is deliberately separate from the application build so schema changes remain an explicit deployment action.

## Paid evaluator session

After migrations, seed one non-personal ACTIVE demo session:

```bash
DATABASE_URL='postgresql://...' pnpm seed:paid-demo
```

The command prints a generated `sessionId` and the exact cookie value. To make repeated deployments reuse a known UUID, set `DEMO_SESSION_ID` explicitly.

The seeded assessment contains only synthetic challenge data (male, 24, 175 cm, 75 kg, 68 kg target, moderate activity) and uses the same `demo-v1` domain calculation as normal submission. The script is retry-safe for the same session ID: it upserts the session, completed assessment/result snapshot, and one `seeded-paid-demo` payment event.

Once a public base URL exists, the evaluator can verify the ACTIVE projection without browser cookie tooling:

```bash
curl -sS 'https://<public-host>/api/assessment/result' \
  -H 'Cookie: health_assessment_session=<paid-session-id>'
```

A normal fresh browser remains FREE until `/api/pay` succeeds, so the public UI demonstrates the pre-payment projection separately.

## Public smoke checklist

Before marking T21 complete, verify from the deployed host rather than localhost:

1. `/` renders the product landing page and enters `/assessment`.
2. A fresh session completes all seven inputs and survives a refresh mid-funnel.
3. FREE `/result` exposes BMI/category but does not include protected calorie/date values in its JSON response.
4. The simulated payment dialog activates the session and the same `/result` endpoint returns the stored full snapshot.
5. Refresh keeps ACTIVE access.
6. The seeded paid session ID works with the documented `curl` request.

## Current external dependency

Repository-side deployment preparation is complete, but the final public host cannot be created without credentials/access to a hosting project and a production PostgreSQL database. Do not commit either credential to this repository.
