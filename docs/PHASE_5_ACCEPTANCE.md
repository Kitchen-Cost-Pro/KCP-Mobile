# Phase 5 Acceptance Record — Mobile Manufacturing

## Delivered scope

- Live, `nav-mfg-products`-protected Manufacturing dashboard and recent batch history.
- Authorised-location selection using the same KCP user and role location intersection.
- Manufactured-product name, SKU, category and exact barcode lookup.
- Native camera scanning with secure-browser and manual search fallbacks.
- Batch count and actual-output entry with expected output derived from the stored batch yield.
- Server-side blueprint expansion, component aggregation and current location-balance preview.
- Clear available/shortage component states and confirmation blocking when any component is unavailable.
- Fresh preview-token validation immediately before an explicit confirmed post.
- Stable client batch IDs for safe retry and duplicate protection.
- Atomic posting through the existing KCP Manufacturing engine, including component deductions, finished-stock receipt, movements, cost handling and transaction reference.
- Secure, user-and-workspace-scoped recovery for an interrupted Manufacturing form.
- Finished receipt with item, location, expected output, actual output and yield loss.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
```

The test suite covers API route construction, preview payloads, explicit/idempotent posting, a successful screen flow, shortage blocking, ambiguous barcode handling, secure recovery restoration and Home permission routing.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run from `KCP-Mobile`:

```bash
npm run worker:deploy
```

The guarded command patches only the current `kcp-api-v2` source, runs its typecheck/tests/dry deploy, applies any already-pending central migrations, deploys, and performs the existing live mobile API check. Phase 5 introduces no new D1 migration. Do not deploy or point the app at the unused `kcpmobile` Worker.

## Live-data acceptance checks

Use a non-production test workspace or carefully selected low-risk stock:

1. Sign in as a user with `nav-mfg-products` and access to one production location.
2. Verify Manufacturing appears on Home and only permitted locations are listed.
3. Search or scan a manufactured product with a valid blueprint.
4. Enter one batch and confirm expected output and component requirements agree with desktop KCP.
5. Verify an intentionally insufficient component prevents confirmation without changing stock.
6. Restore sufficient stock, refresh the preview, confirm once, and verify the receipt/reference.
7. Confirm component balances decreased and finished-stock balance increased exactly once in desktop KCP.
8. Retry the same request or revisit the receipt and confirm the batch is not duplicated.
9. Start another form, terminate and reopen the app, and confirm only the same user/workspace can resume it.
10. Remove `nav-mfg-products` or location access and confirm both the mobile UI and direct API calls are denied after access refresh.

## Phase boundary

Phase 5 covers single-location production from an existing KCP manufactured-product blueprint. It does not create or edit recipes, permit negative component stock, queue offline mutations, schedule production, handle approvals, or replace the full desktop Manufacturing administration screens.
