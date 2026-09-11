# Deployment and evaluator demo

## Goal

T21 requires one stable public deployment of the complete funnel, including the simulated payment transition. The production target is the existing Chengdu Aliyun host, reusing its Caddy edge and PostgreSQL process while keeping this challenge isolated as its own Compose project, database, database role, and container image.

## Production topology

```text
Internet
  -> assessment.bakersean.top
  -> existing Caddy on Aliyun :443
  -> health-assessment:3000
  -> existing PostgreSQL process
       -> dedicated database: health_assessment
       -> dedicated role: health_assessment_app
```

The challenge does not share MemoFlow tables or schema. It only joins the existing Docker network so Caddy can reach the app and the app can reach PostgreSQL by service DNS.

## Container release model

The Next.js application uses `output: "standalone"` and a multi-stage Dockerfile.

Two immutable release artifacts are produced after the full CI suite succeeds on `main`:

- `ghcr.io/bakersean168/health-assessment-challenge:sha-<commit>` — minimal Next.js runtime;
- `ghcr.io/bakersean168/health-assessment-challenge:migrate-sha-<commit>` — one-shot Prisma migration image.

`latest` / `migrate-latest` are convenience aliases only. Production Compose should pin the commit-SHA tags so rollback is explicit and reproducible.

The Aliyun host pulls images rather than building the application locally. This is intentional because the host is small and already runs MemoFlow workloads; CI absorbs build-time memory/CPU cost.

## Host layout

```text
/opt/health-assessment/
  compose.production.yaml
  .env                 # root-only, never committed
```

The app joins the external `memoflow_memoflow-network` network but remains a separate Compose project and lifecycle from MemoFlow.

The runtime container has a 384 MiB memory limit and a 256 MiB V8 old-space ceiling. The host should keep a small swap safety net for transient memory pressure; swap is not treated as normal runtime capacity.

## Required production configuration

The root-only `.env` contains:

```text
APP_IMAGE=ghcr.io/bakersean168/health-assessment-challenge:sha-<commit>
MIGRATOR_IMAGE=ghcr.io/bakersean168/health-assessment-challenge:migrate-sha-<commit>
DATABASE_URL=postgresql://health_assessment_app:<secret>@postgres:5432/health_assessment?schema=public
SHARED_DOCKER_NETWORK=memoflow_memoflow-network
```

The anonymous session cookie becomes `Secure` automatically when `NODE_ENV=production`, while remaining `HttpOnly`, `SameSite=Lax`, and scoped to `/`.

## Database migration

Production Compose runs the migration image before the application starts:

```bash
docker compose --env-file .env -f compose.production.yaml up -d
```

The `app` service depends on successful completion of the one-shot `migrate` service. `prisma migrate deploy` therefore remains an explicit release step rather than happening during the Next.js build.

## Caddy route

The existing production Caddy instance remains the only public listener on ports 80/443. Add one site block after DNS resolves to the host:

```caddy
assessment.bakersean.top {
    reverse_proxy health-assessment:3000

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }
}
```

Validate before graceful reload. Do not restart or replace the existing MemoFlow Caddy service just to add this route.

## Paid evaluator session

After migrations, seed one non-personal ACTIVE demo session using the same release source or a trusted operator environment:

```bash
DATABASE_URL='postgresql://...' pnpm seed:paid-demo
```

The command prints a generated `sessionId` and the exact cookie value. To make repeated deployments reuse a known UUID, set `DEMO_SESSION_ID` explicitly.

The seeded assessment contains only synthetic challenge data (male, 24, 175 cm, 75 kg, 68 kg target, moderate activity) and uses the same `demo-v1` domain calculation as normal submission. The script is retry-safe for the same session ID: it upserts the session, completed assessment/result snapshot, and one `seeded-paid-demo` payment event.

Once a public base URL exists, the evaluator can verify the ACTIVE projection without browser cookie tooling:

```bash
curl -sS 'https://assessment.bakersean.top/api/assessment/result' \
  -H 'Cookie: health_assessment_session=<paid-session-id>'
```

A normal fresh browser remains FREE until `/api/pay` succeeds, so the public UI demonstrates the pre-payment projection separately.

## Public smoke checklist

Before marking T21 complete, verify from the deployed hostname rather than localhost:

1. `/` renders the product landing page and enters `/assessment`.
2. A fresh session completes all seven inputs and survives a refresh mid-funnel.
3. FREE `/result` exposes BMI/category but does not include protected calorie/date values in its JSON response.
4. The simulated payment dialog activates the session and the same `/result` endpoint returns the stored full snapshot.
5. Refresh keeps ACTIVE access.
6. The seeded paid session ID works with the documented `curl` request.

## Remaining external dependency

Repository and host-side deployment can proceed without Vercel or Supabase. The only external DNS action still required for the preferred hostname is an `assessment.bakersean.top` record pointing/proxying to the Chengdu Aliyun origin. DNS credentials are intentionally not stored in this repository.
