# KCP API Mobile Readiness

KCP Lite reuses the current API. It does not create a second authentication or permission model.

## Existing routes consumed

### Identity

| Method | Route | Use |
| --- | --- | --- |
| POST | `/api/mobile/v1/session/login` | Validate existing KCP credentials and issue a short-lived access token |
| POST | `/api/mobile/v1/devices/register` | Register the device and issue its first refresh token |
| POST | `/api/mobile/v1/session/refresh` | Rotate the refresh token and issue a new access token |
| POST | `/api/mobile/v1/session/logout` | Revoke the current device token family |
| GET | `/api/mobile/v1/devices` | List the signed-in user's registered devices |
| DELETE | `/api/mobile/v1/devices/:deviceId` | Revoke a device owned by the signed-in user |
| GET | `/api/mobile/v1/bootstrap` | Mobile API version, feature flags, workspaces, permissions and optional locations |
| GET | `/api/auth/me` | Session validation and profile |
| GET | `/api/auth/invitations` | Pending invitation lookup |
| POST | `/api/auth/invitations/claim` | Claim an invited membership |
| POST | `/api/auth/change-password` | Forced first-login password |

Password recovery is handed to the existing KCP web application. The mobile client does not call the Turnstile-protected web login or security-config routes.

### Phase 2 Stock Take

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/counts/bootstrap` | Permission-filtered templates; selected template items, UOM snapshots and location |
| POST | `/api/mobile/v1/workspaces/:id/counts` | Create the authenticated user's server draft |
| GET | `/api/mobile/v1/workspaces/:id/counts/:sessionId` | Resume the authenticated user's draft |
| PATCH | `/api/mobile/v1/workspaces/:id/counts/:sessionId` | Revision-safe draft update |
| POST | `/api/mobile/v1/workspaces/:id/counts/:sessionId/reconcile` | Authoritative expected quantity, cost and variance preview |
| POST | `/api/mobile/v1/workspaces/:id/counts/:sessionId/commit` | Freshly reconciled, explicitly confirmed, idempotent ledger commit |

The overview also reads the existing authenticated `stock-take-drafts` and `stock-takes` workspace routes for active-draft discovery and recent posted history. All routes derive user identity and location scope from the bearer session.

### Phase 3 Barcode Lookup and Wastage

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/barcodes/:barcode?locationId=...` | Exact server-authoritative base/custom-UOM barcode resolution with location validation |
| POST | `/api/mobile/v1/workspaces/:id/wastage` | Permissioned, location-scoped, idempotent wastage adjustment |
| GET | `/api/workspaces/:id/stock-items?search=...&locationId=...` | Existing `nav-ingredients`-protected item/SKU/category search fallback |

Unknown barcodes never create catalogue records. Ambiguous duplicate barcodes are rejected. The client displays a provisional conversion only; the Wastage adapter reloads the stock item, applies the database UOM ratio, resolves location cost, and delegates the stable action ID to the existing KCP adjustment ledger.

### Phase 4 Transfers

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/transfers/bootstrap` | `nav-transfers`-protected authorised source/destination locations |
| GET | `/api/mobile/v1/workspaces/:id/transfers` | Awaiting-acceptance, recently-sent and recently-received transfer buckets |
| GET | `/api/mobile/v1/workspaces/:id/transfers/items?search=...&sourceLocationId=...` | Transfer-scoped active-item/UOM/barcode search with source-location on-hand |
| POST | `/api/mobile/v1/workspaces/:id/transfers` | Idempotent internal transfer delegated to the existing KCP transfer ledger |
| POST | `/api/mobile/v1/workspaces/:id/transfers/:transferId/accept` | Explicit full or partial incoming external receipt |
| POST | `/api/mobile/v1/workspaces/:id/transfers/:transferId/reject` | Explicit reason-required incoming rejection and reversal |

All Phase 4 routes require `nav-transfers`. The item endpoint deliberately does not require `nav-ingredients`, allowing a transfer-only role to choose stock while still returning only mobile-safe fields and no costs. Source and destination access are revalidated on the Worker. Client UOM ratios and on-hand values are informational; the Worker reloads stored UOM configuration and delegates all ledger writes to the existing transfer lifecycle.

### Phase 5 Manufacturing

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/manufacturing/bootstrap` | Authorised production locations and safe recent-batch history |
| GET | `/api/mobile/v1/workspaces/:id/manufacturing/items?search=...&locationId=...` | Manufactured products with a valid blueprint, UOMs and barcodes |
| GET | `/api/mobile/v1/workspaces/:id/manufacturing/barcodes/:barcode?locationId=...` | Exact manufactured-product barcode resolution with ambiguity rejection |
| POST | `/api/mobile/v1/workspaces/:id/manufacturing/preview` | Server-derived expected output, component requirements, current balances and signed preview token |
| POST | `/api/mobile/v1/workspaces/:id/manufacturing/batches` | Explicitly confirmed, idempotent atomic Manufacturing ledger commit |

Every route requires `nav-mfg-products`, and every location is revalidated against the signed-in user's effective location scope. Search returns no costs. Preview reloads the current blueprint and balances, derives expected output from the stored batch yield, and blocks shortages. Commit recomputes that preview, rejects a stale token or changed availability, then delegates the stable client batch ID to KCP's existing atomic Manufacturing engine.

### Phase 7 Production Runs

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/manufacturing/catalog?locationId=...` | Complete active manufactured-item catalogue, including visible blueprint readiness |
| POST | `/api/mobile/v1/workspaces/:id/manufacturing/runs/preview` | Combined product yields and shared-component availability for up to 200 entered products |
| POST | `/api/mobile/v1/workspaces/:id/manufacturing/runs/commit` | Explicitly confirmed, payload-bound and safely resumable grouped production run |

These routes retain `nav-mfg-products` and effective-location enforcement. The catalogue deliberately includes active manufactured items that do not yet have a usable blueprint so operators can see why they cannot be recorded. The client supplies only product IDs, batch counts, actual output and notes; the Worker reloads every blueprint, yield and balance.

Run preview aggregates shared ingredients before confirmation. Commit binds deterministic child IDs to the exact run ID, reviewed token, location, ordered products, quantities and notes. Each child is revalidated immediately before being delegated to the existing atomic KCP Manufacturing batch engine. If an interruption occurs after one product posts, the exact same request can resume without consuming that product twice; changed retry values are rejected or receive different child IDs. This is retry-safe grouped orchestration over KCP's existing atomic per-product batches, not a new all-or-nothing database transaction spanning every product.

### Phase 8 Goods Receiving

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/receiving/bootstrap` | Authorised awaiting/partial POs and safe recent GRV history |
| GET | `/api/mobile/v1/workspaces/:id/receiving/orders/:orderId` | Fresh outstanding PO lines, locked UOM/pack/cost and location data |
| GET | `/api/mobile/v1/workspaces/:id/receiving/orders/:orderId/barcodes/:barcode` | Exact barcode match restricted to the selected PO |
| POST | `/api/mobile/v1/workspaces/:id/receiving/preview` | Outstanding-quantity, invoice-reuse, total and PO-state validation |
| POST | `/api/mobile/v1/workspaces/:id/receiving/commit` | Explicitly confirmed, retry-safe existing KCP GRV transaction |

Every route requires `nav-grv`; PO and line locations are revalidated against effective user access. The client sends only existing PO line IDs, received purchasing-unit quantities and document metadata. Preview reloads the PO and rejects over-receipt or duplicate supplier invoices. Commit requires the fresh preview token and delegates the receipt to the existing atomic KCP GRV engine with cost overrides disabled.

A stable mobile receipt ID and exact-payload fingerprint make ordinary retries idempotent. The final GRV ID is also bound to the current PO state, so competing devices cannot silently post two different receipts against the same reviewed state. A stale device must reload the remaining PO quantities before it can post.

### Phase 9–10 Purchase Ordering

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/mobile/v1/workspaces/:id/purchase-orders/bootstrap` | Active suppliers, authorised locations and recent PO status buckets |
| GET | `/api/mobile/v1/workspaces/:id/purchase-orders/catalog?supplierId=...&locationId=...` | Full eligible stocked-item catalogue with current location cost and purchase UOM |
| GET | `/api/mobile/v1/workspaces/:id/purchase-orders/:orderId` | Location-authorised PO detail, receiving progress and audit timeline |
| DELETE | `/api/mobile/v1/workspaces/:id/purchase-orders/:orderId` | Discard only the authenticated user's own mobile-created draft |
| POST | `/api/mobile/v1/workspaces/:id/purchase-orders/preview` | Fresh supplier, location, catalogue, cost and total validation |
| POST | `/api/mobile/v1/workspaces/:id/purchase-orders/drafts` | Save or update the current user's deterministic mobile draft |
| POST | `/api/mobile/v1/workspaces/:id/purchase-orders/submit` | Explicitly confirmed, preview-bound submission to KCP's existing PO engine |

Every route requires `nav-purchase-orders`; receiving-location access is checked again by the Worker. The client supplies item IDs, order quantities and notes only. KCP reloads supplier status, item eligibility, purchasing UOM, pack size and current location cost before preview and submission. Supplier identifies the vendor but never filters catalogue eligibility: every active stocked item may be purchased from every active supplier.

A stable client order ID maps to one deterministic KCP PO ID. Drafts created by another user cannot be overwritten or deleted, submitted orders are immutable, exact submission retries return the existing order, and changed data requires a fresh preview token. Phase 10 returns line-level receiving progress and tenant audit history without exposing raw operational records. It reuses the existing `purchase_orders`, `purchase_order_lines` and `audit_events` writes and adds no migration.

### Workspace bootstrap

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/workspaces/:id/access-management` | Current role, custom roles, team assignment and role locations |
| GET | `/api/workspaces/:id/settings` | Workspace name and theme |
| GET | `/api/workspaces/:id/user-preferences` | User theme/background preference |
| GET | `/api/workspaces/:id/locations` | Active KCP locations |

The API remains authoritative. Hiding a mobile button is usability, not security. Stock Take requires `nav-stock-count`; Wastage requires `nav-adjustments`; general Stock Lookup requires `nav-ingredients`; Transfers requires `nav-transfers`; Manufacturing requires `nav-mfg-products`; Goods Receiving requires `nav-grv`; Purchase Ordering requires `nav-purchase-orders`; and every operational route rechecks location access.

## Required Worker origin configuration

The current KCP Worker reads `ALLOWED_ORIGINS` from `cloudflare-v2/wrangler.toml`. Capacitor 8 uses a secure local Android origin and a custom iOS origin.

Retain all existing origins and add:

```text
https://localhost,capacitor://localhost
```

Example production value based on the Phase 1 KCP source:

```toml
ALLOWED_ORIGINS = "http://localhost:*,http://127.0.0.1:*,https://localhost,capacitor://localhost,https://kcp-live.pages.dev,https://*.kcp-live.pages.dev"
```

Deploy this change through the existing KCP Worker release process. Do not replace or remove current origins.

## Mobile database migration

The current KCP Worker source includes `migrations/0005_mobile_devices.sql`. Apply it to the same central D1 database used by `kcp-api-v2` before testing a real login:

```bash
cd "/path/to/KCP-Live/cloudflare-v2"
npx wrangler d1 migrations apply kcp_central --remote --config ./wrangler.toml
```

Then deploy the current Worker through its normal release checks:

```bash
npm run typecheck
npm test
npm run deploy:dry
npx wrangler deploy --config ./wrangler.toml
```

Do not apply the old KCP-Mobile auth patch. The versioned routes are already part of the current `src/index.ts` and use `CENTRAL_DB`, the existing identity store, and the existing access-control services.

From `KCP-Mobile`, verify the deployed route without credentials:

```bash
npm run api:verify
```

If `KCP-Mobile` and the current `KCP-Live` are sibling directories, the complete guarded workflow is:

```bash
npm run worker:deploy
```

It validates that the target Wrangler project is named `kcp-api-v2`, idempotently adds the Phase 4 transfer search and the latest Manufacturing, Goods Receiving, Purchase Ordering and Phase 13 low-stock routes when missing, adds the two Capacitor origins when missing, runs the current Worker checks, applies pending central D1 migrations, deploys that Worker, and runs the read-only verification. It never targets a Worker named `kcpmobile`. Phases 10 and 13 use existing KCP tables and add no migration.

Phase 11 consumes `restaurantLogoDataUrl` from the existing authorised workspace settings response already loaded by the client. It adds no endpoint, binding, secret or migration and does not require a Worker deployment.

Phase 12 consumes the existing authenticated route `GET /api/mobile/v1/workspaces/:workspaceId/dashboard`. The guarded deployment adds an explicit `nav-dashboard` assertion to that route; location scope and `nav-reporting` checks remain server-authoritative. It adds no binding, secret, table or migration.

Phase 13 adds `GET /api/mobile/v1/workspaces/:workspaceId/low-stock?locationId=...`. The Worker requires `nav-dashboard` and `nav-ingredients`, revalidates the requested location, reads KCP stock balances and configured item/location stock levels, and derives purchase-pack suggestions from the current purchasing UOM and pack size. The response reports whether `nav-purchase-orders` is also present; every PO route independently enforces that permission again. No supplier-item relationship, binding, secret, table or migration is added.

## Password reset links

KCP Lite opens the configured KCP web application for password recovery. Reset requests and completion remain in the existing web flow.

If reset completion must return directly to KCP Lite, add a verified Android App Link and iOS Universal Link in a later auth hardening change. Do not replace the existing working web reset link until both mobile platforms are verified.

## Worker identity

The mobile client is configured for the Worker named `kcp-api-v2` at `https://kcp-api-v2.adminkitchencostpro.workers.dev`. Do not redirect it to a separate `kcpmobile` Worker unless that Worker is deliberately adopted and contains the complete API, bindings, migrations and access controls.

Before removing an unexpected Worker, first inspect its routes, recent deployments and request traffic in Cloudflare. It may be safely retired only after confirming no Pages domain, custom route, cron, queue or client still references it.
