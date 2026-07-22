# KCP Lite Mobile

KCP Lite is the mobile operations client for Kitchen Cost Pro. It is a separate React and Capacitor application that uses the existing KCP Cloudflare API, identity, workspaces, locations, roles and tenant data.

KCP Lite includes the complete native operations foundation plus KCP Flow Actions and Routines:

- KCP email/password login through the existing versioned mobile API
- Registered-device sessions with short-lived access tokens and rotating refresh tokens
- Secure native session storage through Android Keystore and iOS Keychain
- Session restore, logout, reset request and forced first-login password change
- Single and multi-workspace selection
- Existing default and custom KCP role support
- User and role location intersection
- Mobile bootstrap feature flags, permissions and server-filtered locations
- Live Stock Take templates filtered by the selected authorised location
- Start, resume and revision-safe server drafts
- Fast item/SKU/category/barcode search with base and custom-UOM quantity entry
- Confirmed-zero counts kept distinct from uncounted items
- Secure user-scoped device recovery and automatic server draft saving
- Server-authoritative reconciliation, variance review and explicit confirmation
- Idempotent submission through the existing KCP stock ledger
- Recent posted Stock Take history and transaction references
- Separate **To Count** and **Counted** buckets so completed items leave the working list immediately
- Safe active-card retention while entering a count, **Done & next**, and one-tap return to uncounted
- Native Android/iOS barcode scanning with secure-browser support and manual fallback
- Exact server-side barcode matching, including custom-UOM barcodes and ambiguity rejection
- Permissioned item, SKU and category search with location-scoped on-hand lookup
- Location-scoped wastage capture with secure interruption recovery
- Server-authoritative wastage UOM conversion, costing and idempotent stock adjustment
- Wastage transaction receipt with authoritative base quantity and value
- Permissioned Transfers dashboard with awaiting, sent and received buckets
- Internal transfers between authorised KCP locations with multi-item, barcode and item-search entry
- Source-location on-hand visibility and server-verified UOM conversion
- Secure, user-and-workspace-scoped transfer draft recovery and stable idempotency keys
- Incoming external transfer detail with full or partial receipt and reason-required rejection
- Authoritative KCP transfer receipts and transaction references
- Mobile-first From/To selection cards with accessible KCP bottom-sheet location lists
- Destination filtering, long-list search and source-change protection for transfer routes
- Permissioned Manufacturing dashboard with recent production batches
- Complete active manufactured-item catalogue, with missing blueprints visible instead of silently hidden
- Inline batch-count and actual-output entry for every manufactured item; no discovery search is required
- Separate **To Record** and **Entered** buckets so the production list gets shorter as work is captured
- Local name, SKU and category filtering without replacing the full catalogue workflow
- Server-derived expected output, actual output, variance and yield-loss capture
- Server-authoritative blueprint expansion and combined component availability preview across the whole run
- Shortage-blocked grouped review, explicit confirmation and standard KCP Manufacturing ledger posting
- Secure multi-item draft recovery, payload-bound retry-safe batch IDs and authoritative run receipts
- Permissioned Goods Receiving dashboard with full awaiting and partially received PO cards
- Locked supplier, receiving location, PO items, purchasing UOMs, pack sizes and costs
- Invoice, delivery-note, received-date and optional receipt-note capture
- Full outstanding PO item list with barcode matching limited to the selected order
- Separate **To Receive** and **Entered** buckets so completed delivery lines leave the working list
- Authoritative outstanding-quantity and duplicate-invoice validation with server preview
- Explicitly confirmed, retry-safe posting through KCP's existing atomic GRV engine
- Secure unfinished-receipt recovery and authoritative GRV transaction receipt
- Permissioned Purchase Ordering dashboard with Draft, Sent, Partial and Completed buckets
- Supplier and receiving-location selection buttons with searchable mobile sheets instead of native dropdowns
- Full eligible stocked-item catalogue with local filtering, locked purchasing UOM, pack size and KCP cost
- Separate **To Order** and **Entered** buckets so completed order lines leave the working list
- Server-saved drafts plus secure user-and-workspace-scoped interruption recovery
- Fresh server preview, explicit confirmation and retry-safe delegation to KCP's existing purchase-order engine
- Supplier-independent purchasing: every active stocked item can be bought from every active supplier
- Full Draft, Sent, Partial and Completed PO detail with line-level receiving progress and audit timeline
- Mobile-owner-only draft editing and safe server draft deletion
- Branded PO PDF generation, native/web sharing and supplier email hand-off
- Main KCP workspace logo reused in the mobile greeting tile with a resilient workspace-initial fallback
- Work-first Today home with Resume, Now, Next, Waiting and recently completed Action sections
- Two-tap source workflow launch with location and operational record preselected
- Compact 2×2 operational summary with the full dashboard retained as permission-safe Insights
- Action cards with due time, priority, progress, operational reason and Role Set–controlled financial impact
- Automatic Waiting/Completed/Returned lifecycle outcomes after the real KCP workflow succeeds—no separate completion step
- Idempotent operational source bridge for approvals, counts/recounts, transfers, receiving, manufacturing, wastage, low stock, interrupted drafts and barcode exceptions
- Existing purchase-order deliveries, interrupted server drafts and approvals materialised into one active Action per source
- Offline lifecycle retry queue that cannot roll back or misreport a successful stock transaction
- Full location-scoped low-stock intelligence opened directly from the Phase 12 alert
- Out-of-stock and below-par buckets with item, SKU, barcode and category search
- Current quantity, low-stock threshold, par level and server-derived suggested purchase quantity
- Direct item hand-off into Stock Lookup without rediscovery
- Multi-item hand-off into Purchase Ordering with the selected location and suggested quantities preloaded
- Supplier selection deferred to PO setup; every eligible stocked item remains available from every active supplier
- Secure user/workspace/location-scoped read-only offline low-stock snapshots
- KCP Flow dashboard with Upcoming, Ready, In Progress, Waiting, Completed, Deferred and Cancelled Actions
- User, Role Set and location assignments enforced again by the Worker
- Daily, weekly, monthly and one-off Routines administered in KCP main
- Shared Action contract covering source records, permission, priority, progress, financial impact, deep links, evidence and activity
- Revision-safe progress, idempotent event generation, retry-safe completion and secure user/workspace recovery
- Location-scoped read-only offline Action snapshots and authoritative completion history
- Additive metadata migration that preserves every existing operational record and does not touch stock behavior
- Ten built-in, extensible KCP Flow Role Sets with compact searchable administration
- Role-specific Home focus, Action priority, default navigation shortcuts and financial visibility
- Permission-safe Role Set location narrowing, assignment rules, reassignment, defer and escalation policies
- Awaiting My Approval dashboard with Submitted, Approved and Rejected buckets
- Server-authoritative thresholds for stock-take variance, wastage, transfers, purchase orders, manual adjustments and manufacturing exceptions
- Required decision reasons, role/value limits, optional creator exclusion and multi-level approval routes
- Exact locked payloads, execution permits, immutable audit history and push-ready event outbox
- Original KCP stock or document mutation deferred until final authorised approval
- KCP main approval-policy administration with workspace and location enforcement
- Android/iOS operational push registration, user preferences and revocable device tokens
- Exact authorised deep links for Actions, approvals, transfers, purchase orders and low stock
- Action/approval/low-stock/transfer/PO notification outbox with dedupe and retry state
- Foreground session refresh, broader read-only snapshots and safe checklist-only offline completion queueing
- Privacy-filtered crash/performance monitoring plus accessibility and long-list hardening
- Credential-gated, signature-verifying Android and iOS production build workflow with rollback guidance
- Visual system aligned with KCP main: graphite surfaces, labelled dashboard filters and restrained mint/amber/rose accents
- Permission-aware Home and operational navigation
- Workspace theme and background reuse
- Offline, timeout, 401, 403 and API error states
- Native Android and iOS projects with branded icons and splash screens
- No mock operational counts and no duplicate mobile database

Stock Takes, Wastage, Transfers, Manufacturing, Goods Receiving and Purchase Ordering are live and use the existing KCP services. The Worker remains authoritative for recipes, purchase orders, quantities, balances, costing and ledger writes; no parallel operational database or client-calculated stock mutation is introduced.

## Requirements

- Node.js 22 or 24
- npm 10 or newer
- Android Studio with Android SDK 36 and the JDK required by Capacitor 8
- macOS and Xcode for iOS builds

## Start locally

```bash
cp .env.example .env
npm install
npm run dev
```

Localhost development calls the configured Worker directly, so KCP Flow requests do not depend on a stale Vite proxy. Previews opened from a phone on a LAN address still proxy `/kcp-api` through Vite, avoiding a Worker CORS dependency. Production and native builds call `VITE_KCP_API_BASE_URL` directly.

Camera scanning works in the installed native app and secure browser contexts such as `https://` or desktop `localhost`. Plain `http://192.168.x.x` LAN previews retain manual barcode and item-search fallbacks because browsers do not grant camera access to insecure origins.

KCP Lite does not load Turnstile. It signs in through the existing `kcp-api-v2` route at `/api/mobile/v1/session/login`, registers the device, and securely stores the rotating mobile session. Password recovery remains in the secure KCP web application.

Confirm that the correct Worker is live without sending credentials or changing data:

```bash
npm run api:verify
```

This project targets `kcp-api-v2`. A separate Worker named `kcpmobile` is not used by the app.

When `KCP-Mobile` and the current `KCP-Live` are sibling folders, the full backend check, central D1 migration, deployment and live verification can be run from `KCP-Mobile`:

```bash
npm run worker:deploy
```

The command refuses to deploy a Worker whose Wrangler name is not `kcp-api-v2`. It validates the current `/api/mobile/v1` source and idempotently installs the mobile adapters, KCP Flow schema, compatibility migration, notification lifecycle and protected routes. KCP main administrator components and integration notes are in `kcp-main-patches`.

## Quality checks

```bash
npm run check
```

This runs strict TypeScript validation, unit/component tests and the production web build.

## Native projects

```bash
npm run cap:sync
npm run cap:android
npm run cap:ios
```

`cap:android` opens the generated Android Studio project. `cap:ios` requires macOS and opens the Xcode project.

Production signing is intentionally credential-gated. See [docs/PRODUCTION_RELEASE.md](docs/PRODUCTION_RELEASE.md), then run `npm run release:build` on the approved signing runner.

## Project map

```text
src/app                 Application shell and navigation
src/components          Shared mobile UI components
src/core/api            KCP API client and workspace bootstrap
src/core/auth           Existing KCP authentication state machine
src/core/permissions    Default/custom roles and location scoping
src/core/session        Native secure bearer-token storage
src/core/theme          Existing KCP theme/background mapping
src/features            Mobile feature screens and operational adapters
android                 Native Android project
ios                     Native iOS project
docs                    Integration, security and release notes
```

## Important deployment prerequisite

The Worker must include the `/api/mobile/v1` routes, have migration `0005_mobile_devices.sql` applied to the central D1 database, and allow the Capacitor WebView origins before real-device login can work. Follow [docs/KCP_API_MOBILE_READINESS.md](docs/KCP_API_MOBILE_READINESS.md) before distributing an APK.

## Release scope

See [docs/PHASE_18_ACCEPTANCE.md](docs/PHASE_18_ACCEPTANCE.md) for Role Sets, [docs/PHASE_17_ACCEPTANCE.md](docs/PHASE_17_ACCEPTANCE.md) for the KCP Flow migration and [docs/PRODUCTION_RELEASE.md](docs/PRODUCTION_RELEASE.md) for deployment and rollback.
