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
  compose.yaml          # deployed copy of repository compose.production.yaml
  deploy.sh             # deployed copy of scripts/deploy-aliyun.sh
  .env                  # root-only, never committed
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
DATABASE_POOL_MAX=4
```

The anonymous session cookie becomes `Secure` automatically when `NODE_ENV=production`, while remaining `HttpOnly`, `SameSite=Lax`, and scoped to `/`.

## Database migration

Production Compose runs the migration image before the application starts:

```bash
scp scripts/deploy-aliyun.sh <ssh-host>:/opt/health-assessment/deploy.sh
ssh <ssh-host> 'chmod 700 /opt/health-assessment/deploy.sh && /opt/health-assessment/deploy.sh'
```

The deployment helper validates the Compose configuration, pulls the immutable images, removes any stale one-shot migration container, runs the bounded migration step, and only then replaces/starts the application. A failed migration therefore leaves any already-running application untouched. The script waits for the application healthcheck before reporting success. `prisma migrate deploy` remains an explicit release step rather than happening during the Next.js build.

## Caddy route

The existing production Caddy instance remains the only public listener on ports 80/443. The active production site block is:

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

Configuration changes are validated before reload. In normal operation a graceful reload is sufficient; during the initial cutover the Caddy container was recreated once because its bind mount still referenced an older Caddyfile inode. MemoFlow application containers were not replaced.

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

## Verified production state

As of 2026-09-11, the Chengdu Aliyun host has:

- an isolated `health_assessment` PostgreSQL database owned by the dedicated `health_assessment_app` role;
- all six committed Prisma migrations applied successfully;
- the immutable GHCR application image running as a healthy Next.js standalone container;
- a 384 MiB application memory limit, 256 MiB V8 old-space ceiling, and a 1 GiB host swap safety net;
- one synthetic ACTIVE evaluator session seeded out-of-band for review;
- a public HTTPS endpoint at `https://assessment.bakersean.top` with a Caddy-managed certificate behind Cloudflare;
- both FREE and paid Playwright flows passing against the public deployment.

The first deployment attempt exposed a production-only packaging defect: the migration image started via `pnpm`, so Corepack attempted to download pnpm from `registry.npmjs.org` at container startup. On the mainland host that request stalled, while Docker healthchecks across the machine began timing out. Previous-boot kernel logs contain no OOM kill evidence. The corrected image invokes the checked-in Prisma CLI directly and bounds migration memory. The migrator dependency set is now also isolated from the full application/test dependency graph; local image size drops from about 1.65 GB to about 675 MB (roughly 59% smaller) while still applying the same committed migrations.

A `sslip.io` hostname was tested only as a temporary DNS-free probe, but the mainland origin returned an Alibaba `403` before Caddy could serve it, so that route was removed rather than retained as a brittle workaround.

## Public verification

The production Compose file connects the app/migrator to the existing MemoFlow Docker network, while the application keeps its own Compose project and lifecycle. DNS credentials remain outside this repository.

On the small Chengdu host, migration is deliberately bounded to 256 MiB and executes the checked-in Prisma CLI directly from `node_modules`; it does not invoke Corepack/pnpm at container startup. This avoids an unnecessary package-manager bootstrap/network dependency and limits transient pressure on the existing production workloads.

The first public Playwright run exposed a second production-only defect: `getPrismaClient()` created a fresh Prisma client in `NODE_ENV=production`. With the `@prisma/adapter-pg` adapter, each client owns a `pg` pool, so concurrent browser flows exhausted the dedicated database role's 10-connection limit and the height-step PATCH returned `P2037 TooManyConnections`. A regression test now launches the database module under a real production environment and asserts that repeated application lookups reuse the same client. Production also caps that shared pool at four connections (`DATABASE_POOL_MAX=4`). After the fix, 62 unit/component tests, 35 PostgreSQL integration tests, normal CI browser tests, and both public FREE/paid Playwright flows are green.

Remote browser verification can be repeated through the public product surface. It creates ordinary synthetic anonymous sessions/payment events through the same HTTP flow; it does not manipulate the production database directly:

```bash
E2E_BASE_URL=https://assessment.bakersean.top pnpm test:e2e
```
