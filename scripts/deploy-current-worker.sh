#!/usr/bin/env bash

set -Eeuo pipefail

MOBILE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_WORKER_DIR="$MOBILE_ROOT/../KCP-Live/cloudflare-v2"
WORKER_DIR="${KCP_WORKER_DIR:-$DEFAULT_WORKER_DIR}"
API_URL="${KCP_API_URL:-https://kcp-api-v2.adminkitchencostpro.workers.dev}"

step() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

if [[ ! -d "$WORKER_DIR" ]]; then
  fail "KCP Worker folder not found at: $WORKER_DIR

Keep KCP-Mobile and KCP-Live beside each other, or run:
KCP_WORKER_DIR=\"/full/path/to/KCP-Live/cloudflare-v2\" npm run worker:deploy"
fi

for required_file in src/index.ts migrations/0005_mobile_devices.sql wrangler.toml package.json; do
  [[ -f "$WORKER_DIR/$required_file" ]] || fail "Missing expected Worker file: $WORKER_DIR/$required_file"
done

grep -Eq '^[[:space:]]*name[[:space:]]*=[[:space:]]*"kcp-api-v2"' "$WORKER_DIR/wrangler.toml" || \
  fail "Refusing to deploy: wrangler.toml is not configured for the kcp-api-v2 Worker."
grep -Fq '/api/mobile/' "$WORKER_DIR/src/index.ts" || \
  fail "The current Worker source does not contain the versioned mobile dispatcher."
grep -Fq "session/login" "$WORKER_DIR/src/index.ts" || \
  fail "The current Worker source does not contain the mobile login route."

step "Using kcp-api-v2 at $WORKER_DIR"
step "Ensuring native Capacitor origins are allowed"
node "$MOBILE_ROOT/scripts/ensure-worker-cors.mjs" "$WORKER_DIR/wrangler.toml"
step "Ensuring the Phase 12 mobile Operations Dashboard is permission-hardened"
node "$MOBILE_ROOT/scripts/ensure-phase12-dashboard-worker.mjs" "$WORKER_DIR"
step "Ensuring the Phase 4 transfer item-search route is present"
node "$MOBILE_ROOT/scripts/ensure-phase4-transfer-worker.mjs" "$WORKER_DIR"
step "Ensuring the Phase 7 mobile manufacturing routes are present"
node "$MOBILE_ROOT/scripts/ensure-phase5-manufacturing-worker.mjs" "$WORKER_DIR"
step "Ensuring the Phase 8 mobile Goods Receiving routes are present"
node "$MOBILE_ROOT/scripts/ensure-phase8-receiving-worker.mjs" "$WORKER_DIR"
step "Ensuring the latest Phase 10 mobile Purchase Ordering routes are present"
node "$MOBILE_ROOT/scripts/ensure-phase9-purchase-orders-worker.mjs" "$WORKER_DIR"
step "Ensuring the Phase 13 location-scoped low-stock route is present"
node "$MOBILE_ROOT/scripts/ensure-phase13-low-stock-worker.mjs" "$WORKER_DIR"
step "Ensuring KCP Flow Action routes, Routine APIs and Phase 14 compatibility are present"
node "$MOBILE_ROOT/scripts/ensure-phase14-tasks-worker.mjs" "$WORKER_DIR"
step "Ensuring the Phase 15 approval engine and protected-operation guards are present"
node "$MOBILE_ROOT/scripts/ensure-phase15-approvals-worker.mjs" "$WORKER_DIR"
step "Ensuring the Phase 16 notification outbox, preferences and token lifecycle are present"
node "$MOBILE_ROOT/scripts/ensure-phase16-notifications-worker.mjs" "$WORKER_DIR"
step "Ensuring Phase 18 Role Sets, assignments and Action controls are present"
node "$MOBILE_ROOT/scripts/ensure-phase18-role-sets-worker.mjs" "$WORKER_DIR"
step "Ensuring Phases 19-20 Today lifecycle and operational Action source bridge are present"
node "$MOBILE_ROOT/scripts/ensure-phase20-action-sources-worker.mjs" "$WORKER_DIR"

cd "$WORKER_DIR"

if [[ ! -x node_modules/.bin/tsc ]]; then
  step "Installing Worker dependencies"
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
fi

step "Checking the Worker source"
git diff --check
npm run typecheck
npm test
npm run deploy:dry --if-present

step "Applying central D1 migrations"
npx wrangler d1 migrations apply kcp_central --remote --config ./wrangler.toml

step "Deploying kcp-api-v2"
npx wrangler deploy --config ./wrangler.toml

step "Verifying the live mobile API"
KCP_API_URL="$API_URL" node "$MOBILE_ROOT/scripts/verify-mobile-api.mjs"

step "kcp-api-v2 mobile deployment completed successfully"
