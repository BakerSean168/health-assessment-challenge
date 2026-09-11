#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR=${DEPLOY_DIR:-/opt/health-assessment}
COMPOSE_FILE=${COMPOSE_FILE:-compose.yaml}
ENV_FILE=${ENV_FILE:-.env}
HEALTH_TIMEOUT_SECONDS=${HEALTH_TIMEOUT_SECONDS:-90}

cd "$DEPLOY_DIR"
compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

"${compose[@]}" config -q
"${compose[@]}" pull migrate app

# Never let a stale one-shot migration container hold the release open.
"${compose[@]}" rm -sf migrate >/dev/null 2>&1 || true

# Run migrations as an explicit bounded release step. Existing app traffic is
# untouched if this fails.
"${compose[@]}" run --rm migrate

# Only replace/start the application after the schema step has succeeded.
"${compose[@]}" up -d --no-deps app

container_id=$("${compose[@]}" ps -q app)
if [[ -z "$container_id" ]]; then
  echo "Application container was not created." >&2
  exit 1
fi

deadline=$((SECONDS + HEALTH_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")
  case "$health" in
    healthy)
      "${compose[@]}" ps
      exit 0
      ;;
    unhealthy|exited|dead)
      echo "Application failed health verification: $health" >&2
      "${compose[@]}" logs --no-color --tail=120 app >&2 || true
      exit 1
      ;;
  esac
  sleep 2
done

echo "Timed out waiting for application health." >&2
"${compose[@]}" logs --no-color --tail=120 app >&2 || true
exit 1
