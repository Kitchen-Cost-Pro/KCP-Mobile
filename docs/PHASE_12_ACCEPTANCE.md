# Phase 12 Acceptance Record — Live Operations Dashboard

## Delivered scope

- Live Home dashboard backed by KCP's existing mobile dashboard and reporting services.
- Selected-location scope when a location is active; otherwise the Worker aggregates only the user's permitted locations.
- Available metrics for gross and net sales, theoretical food cost, food-cost percentage, wastage value, low-stock count, pending transfers and active stock-count drafts.
- Financial/reporting metrics remain unavailable without `nav-reporting` and are omitted rather than displayed as zero.
- Prioritised attention for low stock, incoming transfers, resumable counts and degraded source data.
- Attention cards open only when the effective permission allows the target action. Phase 13 upgrades the original low-stock Stock Lookup link to the dedicated Stock Intelligence screen.
- Five most recent location-scoped operational events with KCP's reporting timezone labels.
- Manual refresh, location-change reload, connection-aware error handling and last-loaded offline snapshot state.
- Explicit Worker-side `nav-dashboard` enforcement added by the guarded deployment.
- No Tasks/Approvals schema, parallel reporting store or D1 migration.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The suite verifies endpoint scope, live metric rendering, Rand/percentage formatting, unavailable-metric handling, permission-aware attention actions, offline behavior, Home integration and all earlier mobile regressions. The Worker hardening installer applies idempotently and the patched dashboard module transpiles cleanly.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run:

```bash
npm run worker:deploy
```

The command adds the `nav-dashboard` assertion, runs the current Worker checks and dry deployment, applies only already-pending KCP migrations, deploys `kcp-api-v2` and verifies the mobile API. Phase 12 itself adds no migration.

## Live-data acceptance checks

1. Select one location and compare every available dashboard metric with the same KCP location and trading day.
2. Clear the selected location and confirm a restricted user sees **All Permitted Locations**, never the whole workspace.
3. Sign in without `nav-reporting` and confirm sales/food-cost cards are absent while permitted operational cards remain.
4. Remove `nav-dashboard` and confirm the direct endpoint is denied after Worker deployment.
5. Confirm low-stock, incoming-transfer and count-draft attention cards only navigate when their operation permission is assigned.
6. Post wastage, a transfer, manufacturing or a stock count and confirm Recent Activity refreshes with the correct location.
7. Disable connectivity after a successful load and confirm the last snapshot remains visibly marked offline.
8. Change location from the header and confirm the dashboard reloads for that location.

## Phase boundary

Phase 12 is a read-only operational summary. It does not add arbitrary report building, historical date selection, charts, push notifications, Tasks/Approvals workflows or client-side stock calculations.
