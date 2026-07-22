# Phase 9 Acceptance Record — Mobile Purchase Ordering

## Delivered scope

- `nav-purchase-orders`-protected Purchase Ordering action and dashboard with **Drafts**, **Sent**, **Partial** and **Completed** buckets.
- Searchable supplier and receiving-location selection buttons using mobile bottom sheets; no native dropdown styling.
- Complete eligible active stocked-item catalogue after supplier/location selection, with local name, SKU and category filtering.
- Full eligible stocked-item catalogue. Phase 10 makes the business rule explicit: supplier never restricts item availability.
- Server-supplied purchasing UOM, pack size and location cost. The client cannot override authoritative line economics.
- Separate **To Order** and **Entered** buckets, **Done & move to Entered**, progress counts and one-tap correction.
- Expected-delivery date plus order and line notes.
- Secure device-only, user-and-workspace-scoped unfinished-order recovery and server-saved KCP drafts.
- Fresh server preview of supplier, location, item eligibility, current costs and ZAR totals before explicit confirmation.
- Stable client IDs, deterministic PO IDs, exact-payload fingerprints and preview tokens for retry-safe submission.
- Final persistence delegated to KCP's existing purchase-order and audit engine; no parallel database and no D1 migration.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The suite covers endpoint construction, permission/feature routing, supplier/location sheets, full-catalogue entry, decreasing **To Order**, separate **Entered**, server preview, explicit submission and secure recovery. The current guarded Worker patch applies idempotently and includes the Phase 10 supplier-independent catalogue rule.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run from `KCP-Mobile`:

```bash
npm run worker:deploy
```

The command updates only `kcp-api-v2`, installs the Phase 9 adapter, runs the Worker's checks and dry deployment, applies only migrations already pending in KCP, deploys and verifies the live mobile API. Phase 9 itself adds no migration. The unused `kcpmobile` Worker remains outside this workflow.

## Live-data acceptance checks

1. Sign in as a user with `nav-purchase-orders` and limited location access; confirm only permitted destinations appear.
2. Remove the permission and confirm both the Home action and direct Phase 9 routes are denied after refresh.
3. Choose a supplier and receiving location using the sheets; confirm the catalogue matches current KCP stock.
4. Change the supplier and confirm the same active stocked-item catalogue remains available.
5. Compare displayed purchasing UOM, pack size and location cost to desktop KCP.
6. Enter a line, choose **Done & move to Entered**, and confirm it leaves **To Order** and remains editable in **Entered**.
7. Save a server draft, reopen it and confirm supplier, destination, expected date, notes and quantities are retained.
8. Start a separate unfinished order, terminate/reopen the app and confirm only the same user/workspace can resume it.
9. Preview a valid order and compare subtotal, VAT and total to desktop KCP.
10. Change a relevant server cost or supplier/item state after preview; confirm submission requires a refreshed preview.
11. Submit once and confirm the PO header, lines, status and audit event appear in desktop KCP.
12. Retry the exact submit and confirm the existing PO is returned rather than a duplicate being created.
13. Attempt to change a submitted order through the mobile endpoint and confirm it remains read-only.
14. Disconnect during entry and confirm device recovery continues while catalogue refresh, server draft saving, preview and submission are blocked.

## Phase boundary

Phase 9 creates and submits purchase orders. It does not send supplier email, add approvals, override prices, edit a submitted PO, maintain a new supplier-item master, import catalogues, attach files, or queue offline PO mutations. VAT follows the existing KCP purchase-order engine's current 15% behavior.
