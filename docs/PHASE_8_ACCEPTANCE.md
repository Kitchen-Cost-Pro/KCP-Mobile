# Phase 8 Acceptance Record — PO-linked Goods Receiving

## Delivered scope

- `nav-grv`-protected mobile dashboard containing every receivable PO in the user's authorised locations, separated into **Awaiting** and **Partial**.
- PO selection cards instead of native dropdowns, with supplier, location, expected date and outstanding-line count.
- Locked PO supplier, receiving location, items, purchasing UOM, pack size and unit cost.
- Supplier invoice, delivery note, received date and optional receipt/line notes.
- Complete outstanding PO line list with local filtering and an optional confirmed **Receive all outstanding** action.
- Exact barcode matching against only the selected PO; unknown and ambiguous matches are rejected.
- Separate **To Receive** and **Entered** buckets, progress, **Done & move to Entered**, and one-tap return for correction.
- Server-authoritative preview of outstanding quantities, PO state, invoice reuse, totals and post-receipt PO status.
- Explicit confirmation followed by KCP's existing atomic GRV engine, including stock balances, movements, audit history, PO partial/completed state and transaction reference.
- Stable client receipt IDs, payload fingerprints, PO-state-bound receipt IDs and fresh preview tokens for safe retries and competing devices.
- Device-only, user-and-workspace-scoped recovery for an unfinished receipt and its PO snapshot.
- No new operational database, cost override, offline mutation queue or D1 migration.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The suite covers receiving endpoint construction, full dashboard-to-GRV posting, the decreasing **To Receive** list, barcode-to-selected-PO matching, secure recovery, feature/permission routing and all prior mobile regressions. The guarded Worker patch is idempotent and adds pure tests for receivable status, remaining quantities and line normalization.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run from `KCP-Mobile`:

```bash
npm run worker:deploy
```

The command updates only `kcp-api-v2`, installs the Goods Receiving adapter, runs the Worker's typecheck/tests/dry deploy, applies any already-pending central migrations, deploys and runs the live mobile API check. Phase 8 introduces no D1 migration. Do not deploy or point the app at the unused `kcpmobile` Worker.

## Live-data acceptance checks

Use a test workspace or a carefully selected low-risk purchase order:

1. Sign in as a user with `nav-grv` and access to the PO's receiving location.
2. Confirm an awaiting PO and a partially received PO appear in their respective buckets.
3. Open a PO and confirm supplier, location, items, outstanding quantities, UOMs, pack sizes and costs match desktop KCP.
4. Scan an item on the PO and confirm the matching line is highlighted. Scan an item not on the PO and confirm it is rejected.
5. Enter a quantity, choose **Done & move to Entered**, and confirm the item disappears from **To Receive** and appears in **Entered**.
6. Enter a quantity above outstanding and confirm both client and server prevent review/posting.
7. Enter an invoice already used for that supplier and confirm posting is blocked with the existing GRV reference.
8. Review a valid partial receipt, confirm totals, post once, and compare the GRV reference, balances, stock movements and PO remaining quantities in desktop KCP.
9. Retry the exact commit and confirm the same receipt is returned without another stock movement.
10. Load the same PO on two devices, preview both, post the first, and confirm the second must refresh rather than double-receive.
11. Complete a PO and confirm it leaves the open dashboard and shows `completed` in KCP.
12. Start a receipt, terminate/reopen the app and confirm only the same user/workspace can resume it.
13. Remove `nav-grv` or location access and confirm the Home action and direct API routes are denied after access refresh.

## Phase boundary

Phase 8 receives existing KCP purchase orders. It does not create/edit/approve POs, add off-order items, alter supplier or location, override costs, attach document images, record supplier credits, or queue offline stock mutations. VAT continues to follow the existing KCP GRV engine's current 15% behavior.
