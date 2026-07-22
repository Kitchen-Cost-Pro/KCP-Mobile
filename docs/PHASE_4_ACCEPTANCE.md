# Phase 4 Acceptance Record — Faster Stock Counts and Transfers

## Implemented

### Stock Take working list

- [x] Separate **To Count** and **Counted** buckets with live totals
- [x] Counted items leave the working list after entry so the remaining list steadily shrinks
- [x] The active item stays visible while its quantity input has focus
- [x] **Done & next** advances to the next remaining item
- [x] Confirmed zero remains a counted value
- [x] Counted values stay editable and can be marked uncounted to return them to **To Count**
- [x] Search and pagination apply to the selected bucket
- [x] Existing server draft, reconciliation, revision and commit behaviour remains unchanged

### Transfers

- [x] Transfers requires both the `transfers` feature flag and `nav-transfers`
- [x] Transfer-only users can search mobile-safe stock fields without `nav-ingredients`
- [x] Dashboard buckets for awaiting acceptance, recently sent and recently received
- [x] Internal transfer creation between two different authorised KCP locations
- [x] Multi-item entry through native barcode scanning, manual barcode or text/SKU/category search
- [x] Source-location on-hand visibility with base and custom UOM selection
- [x] Secure user-and-workspace-scoped draft recovery
- [x] Stable client action ID retained across retry or app interruption
- [x] Explicit final review before posting live stock movement
- [x] Server-authoritative location, item and UOM validation through the existing transfer engine
- [x] Transaction reference receipt, including safe duplicate-response handling
- [x] Incoming transfer detail with editable full/partial received quantities
- [x] Explicit confirmation for accept and mandatory reason plus confirmation for reject
- [x] Offline mutation blocking with editable local draft and no offline mutation queue
- [x] Unit/component coverage for routing, permissions, idempotency, creation, partial acceptance and rejection
- [x] Idempotent Worker source extender integrated into the guarded `kcp-api-v2` deployment command

## Automated verification

Run from `KCP-Mobile`:

```bash
npm ci
npm run check
npm run cap:sync
```

Before the first live Phase 4 transfer test, deploy the current Worker from the same folder:

```bash
npm run worker:deploy
```

The deploy command updates only the adjacent current `KCP-Live/cloudflare-v2` source, refuses any Worker not named `kcp-api-v2`, runs its checks, applies pending central migrations, deploys, and performs a read-only API verification.

## Live-data and real-device acceptance

- [ ] A user without `nav-transfers` cannot see Transfers and receives 403 from every transfer route
- [ ] A transfer-only role without `nav-ingredients` can search only through the transfer item endpoint
- [ ] Restricted users see only assigned source/destination locations and cannot bypass them by request editing
- [ ] Source on-hand agrees with KCP desktop for each permitted location
- [ ] Base and custom-UOM internal transfers create exactly one transfer-out and one transfer-in movement
- [ ] Retrying the same stable client action ID creates no duplicate transfer
- [ ] Force-closing during internal entry restores only the same user's workspace-scoped draft
- [ ] Unknown and duplicated barcodes do not silently select a wrong item
- [ ] A full incoming receipt posts the shipped quantity once
- [ ] A partial incoming receipt posts only entered received quantities and handles shortfall through the existing KCP lifecycle
- [ ] A rejection without a reason is blocked; a confirmed rejection restores stock through the existing reversal flow
- [ ] Returned transaction references appear in KCP reporting/audit history
- [ ] **To Count** shrinks after non-zero and confirmed-zero entries on a physical phone
- [ ] Counted-to-uncounted movement and **Done & next** behave correctly with the native keyboard
- [ ] Validate 360px, 390px, 412px and tablet layouts

## Explicit Phase 4 non-goals

- No external transfer sending from mobile; inbound external acceptance/rejection is included
- No offline transfer posting or background mutation queue
- No client-calculated costs, inventory ledger writes or trusted UOM ratios
- No catalogue creation, barcode correction or stock-item editing
- No editing or reversing a posted transfer from mobile
- No Manufacturing stock movement
- No store release, push notification or biometric unlock
