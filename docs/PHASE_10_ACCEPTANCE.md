# Phase 10 Acceptance Record — Complete Purchase Ordering

## Delivered scope

- Supplier-independent catalogue: every eligible active stocked item is returned for every active supplier.
- Full mobile detail for Draft, Sent, Partially Received and Completed purchase orders.
- Line-level ordered, received and remaining quantities plus aggregate receiving progress.
- Supplier contact, receiving location, expected date, notes, totals and KCP audit timeline.
- Mobile-created draft resume/edit and authenticated-creator-only discard.
- Submitted, partially received and completed orders remain read-only.
- Branded KCP PDF document generated locally from the authorised PO detail.
- Native Android/iOS share sheet, browser file sharing/download and supplier email hand-off.
- iOS required-reason privacy manifest for temporary document file access.
- No supplier-item master, external document service, parallel database or D1 migration.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The suite covers endpoint construction, unrestricted catalogue behavior, receiving-progress derivation, all-status order detail, PDF creation, draft deletion, share/email actions and all earlier mobile regressions. The Worker installer applies the latest cumulative Purchase Ordering module and routes idempotently.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run:

```bash
npm run worker:deploy
```

This updates only `kcp-api-v2`, runs its checks and dry deployment, applies only migrations already pending in KCP, deploys and verifies the live mobile API. Phase 10 itself adds no migration.

## Live-data acceptance checks

1. Select two different suppliers and confirm both return the same complete active stocked-item catalogue for the same location.
2. Create and save a mobile draft; confirm it opens in detail and resumes with all values intact.
3. Sign in as another permitted user and confirm that user can view the draft but cannot edit or discard it.
4. Discard the creator's mobile draft and confirm its header and lines are removed while the deletion audit record remains.
5. Confirm a submitted PO exposes no edit or discard action.
6. Open Sent, Partial and Completed orders and compare item quantities, UOMs, pack sizes, costs and totals to desktop KCP.
7. Partially receive a PO through Phase 8, reopen it in Phase 10 and confirm line and aggregate progress update.
8. Complete receiving and confirm the PO moves to Completed with zero remaining lines.
9. Generate/share a PDF and compare supplier, location, dates, items and totals to desktop KCP.
10. Confirm supplier email is disabled when KCP has no email and opens a pre-addressed draft when one is present.
11. Remove `nav-purchase-orders` or location access and confirm Home navigation and direct detail/delete routes are denied.

## Phase boundary

Phase 10 completes mobile PO visibility, draft management and document sharing. It does not restrict items by supplier, automatically send email, attach the PDF to a mail client without user action, add approvals, override KCP costs, edit submitted POs or queue offline order mutations.
