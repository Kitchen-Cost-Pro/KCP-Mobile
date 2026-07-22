# Phase 2 Acceptance Record — Live Stock Takes

## Implemented

- [x] `/api/mobile/v1/bootstrap` feature flags, permissions and location scope integrated
- [x] Stock Take navigation requires both `stockCount=true` and `nav-stock-count`
- [x] Templates filtered by the selected server-authorised location
- [x] Server count package download with stock items, categories, SKUs, barcodes and custom UOM ratios
- [x] New count creates an authoritative server draft before entry begins
- [x] Active authenticated-user draft discovery and resume
- [x] Base and custom-UOM entry with provisional display totals
- [x] Confirmed zero remains distinct from an uncounted item
- [x] Item, category, SKU and barcode text search
- [x] Bounded rendering for large templates with progressive “show more” paging
- [x] Automatic server saving with optimistic draft revisions
- [x] User-and-workspace-scoped native secure recovery during interruption/offline entry
- [x] Server-authoritative UOM conversion, expected quantity, location cost and variance review
- [x] Blocking errors and server warnings surfaced before submission
- [x] Explicit confirmation before ledger commit
- [x] Fresh reconciliation token required for commit
- [x] Stable session idempotency prevents duplicate stock-take posting
- [x] Posted transaction reference, item count and net variance confirmation
- [x] Recent posted Stock Take history
- [x] Manufacturing hidden while the server feature flag remains disabled
- [x] Unit/component coverage for mobile routes, confirmed zero, reconciliation and single commit

## Automated verification

Run:

```bash
npm ci
npm run check
npm run cap:sync
```

Expected:

- Strict TypeScript passes
- Phase 1 and Phase 2 tests pass
- Vite production build succeeds
- Android and iOS projects synchronise

## Live-data and real-device acceptance

- [ ] Stock Taker sees only assigned locations and linked templates
- [ ] A role without `nav-stock-count` cannot open or call the count workflow
- [ ] Base quantity, confirmed zero and at least one custom UOM reconcile correctly
- [ ] Positive and negative variance values match KCP desktop
- [ ] An interrupted native count restores after force-closing the app
- [ ] Offline changes save after reconnection without losing the confirmed-zero state
- [ ] A stale second device receives a revision conflict instead of overwriting newer data
- [ ] Submission appears once in KCP desktop with the same transaction reference
- [ ] Retrying submission does not create a second session or ledger movement
- [ ] Posted stock balances match the reviewed server variance
- [ ] Validate 360px, 390px, 412px and tablet layouts with a large template

## Explicit Phase 2 non-goals

- No camera barcode scanning (text/barcode search is included)
- No offline server commit or background mutation queue
- No collaborative editing of one draft by multiple users
- No mobile editing or reversal of posted Stock Takes
- No Manufacturing stock movements
- No store release, biometrics or push notifications
