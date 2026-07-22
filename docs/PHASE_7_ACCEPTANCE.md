# Phase 7 Acceptance Record — Production Runs

## Delivered scope

- Full active manufactured-item catalogue for the selected authorised location; operators do not need to know what to search for.
- Items without a valid KCP blueprint remain visible with a clear disabled reason.
- Mobile-first inline batch-count, actual-output and optional-note entry on each list item.
- Automatic expected-output fill from KCP batch yield, with visible variance and loss.
- Separate **To Record** and **Entered** buckets, progress count, **Done & next**, and one-tap return for correction.
- Optional local name, SKU and category filter that does not make search part of the production workflow.
- One grouped review for every entered product and combined shared-component availability.
- Whole-run shortage blocking and explicit confirmation before any posting attempt.
- Standard KCP Manufacturing posting for each product, preserving its atomic component deduction, finished-output receipt, costing, movement and transaction reference.
- Exact-payload child IDs, immediate per-product balance revalidation, duplicate protection and safe continuation after an interrupted grouped run.
- Secure, user-and-workspace-scoped recovery of the complete unfinished run and catalogue snapshot.
- Group receipt with the run ID and every authoritative KCP Manufacturing transaction reference.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The suite covers the complete catalogue contract, grouped preview and commit routes, list entry and bucketing, expected-output fill, local filtering, visible blueprint errors, combined shortage blocking, explicit posting, grouped receipt, secure recovery, permissions and prior Stock Take, Wastage and Transfer regressions.

The guarded Worker deployment also runs the current `kcp-api-v2` typecheck, tests and dry-deploy check before Cloudflare deployment.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run from `KCP-Mobile`:

```bash
npm run worker:deploy
```

The command updates only the current Worker named `kcp-api-v2`, installs the latest mobile Manufacturing catalogue/run handlers, runs its checks, applies any already-pending central migrations, deploys and performs the live mobile API check. Phase 7 introduces no new D1 migration. Do not deploy or point the app at the unused `kcpmobile` Worker.

## Live-data acceptance checks

Use a non-production test workspace or carefully selected low-risk stock:

1. Sign in as a user with `nav-mfg-products` and access to one production location.
2. Open Manufacturing and confirm every active manufactured item is listed without entering a search term.
3. Confirm an item with no blueprint is still visible and cannot be entered.
4. Enter two products that share a component; mark each **Done & next** and confirm both move into **Entered**.
5. Review the run and compare combined component usage, expected output and balances with desktop KCP.
6. Make the shared component insufficient and confirm the whole run is blocked without a stock change.
7. Restore sufficient stock, refresh the review, confirm once and verify every product receipt/reference.
8. Confirm component balances decreased and finished-product balances increased exactly once in desktop KCP.
9. Retry the exact commit and confirm every existing child is returned as a duplicate without another stock movement.
10. Interrupt a separate multi-product post after one successful child, retry the exact run and confirm it continues without duplicating the completed child.
11. Start another run, terminate and reopen the app, and confirm only the same user/workspace can resume it.
12. Remove `nav-mfg-products` or location access and confirm both the UI and direct API routes are denied after access refresh.

## Phase boundary

Phase 7 records multiple existing KCP manufactured products at one location. It does not create or edit products or blueprints, schedule or approve production, permit negative component stock, or queue offline mutations. Each product posts through KCP's existing atomic Manufacturing batch transaction; the grouped run is prevalidated and retry-safe but is not represented as one cross-product all-or-nothing D1 transaction.
