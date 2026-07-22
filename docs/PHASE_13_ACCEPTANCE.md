# Phase 13 Acceptance Record — Stock Intelligence and Low-Stock Action

## Delivered scope

- Phase 12 `LOW_STOCK` attention cards now open the dedicated Stock Intelligence screen instead of generic catalogue search.
- One authorised KCP location is selected through the existing mobile location picker.
- Full location list separated into **Out of stock** and **Below par** buckets.
- Local search across item name, SKU, every base/custom-UOM barcode and category.
- Current base-UOM quantity, configured low-stock threshold and par level shown per item.
- Worker-derived shortage and suggested purchasing-UOM quantity, rounded up to the current KCP pack size.
- Direct Stock Lookup opening with the selected item's full authorised details already visible.
- Multi-select and select-visible controls for preparing one purchase order from the shortage list.
- Selected location, stock-item IDs and suggested quantities preload a new PO; supplier remains intentionally unselected until PO setup.
- Changing supplier does not clear selected items or restrict the eligible catalogue.
- `nav-dashboard` plus `nav-ingredients` required for the list; `nav-purchase-orders` additionally required for the hand-off and every PO operation.
- User/workspace/location-scoped device-only offline snapshot. Offline data remains read-only.
- Existing KCP balances, item settings, UOMs, costs and PO engine remain authoritative. No supplier-item relationship or parallel stock store was introduced.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The client suite covers the versioned location route, item/SKU/barcode/category filtering, bucket display, direct Stock Lookup, permission-aware PO action, offline snapshots and the low-stock-to-PO preload. The guarded Worker installer adds its adapter and Worker unit coverage idempotently.

## Worker deployment

Keep `KCP-Mobile` and the current `KCP-Live` as sibling directories, then run:

```bash
npm run worker:deploy
```

The command installs `GET /api/mobile/v1/workspaces/:workspaceId/low-stock`, updates only the `kcp-api-v2` dispatcher, runs the current Worker checks and dry deployment, applies only already-pending KCP migrations, deploys and verifies the mobile API. Phase 13 adds no migration.

## Live-data acceptance checks

1. Choose a permitted location and compare current quantities with KCP Stock Items for that location.
2. Confirm configured low-stock thresholds and par levels match KCP item/location settings.
3. Confirm items at or above par are absent, zero/negative items are in **Out of stock**, and positive shortages are in **Below par**.
4. Search using an item name, SKU, base barcode, custom-UOM barcode and category.
5. Open an item in Stock Lookup and confirm its identity and on-hand quantity without another search.
6. Select several items and start a PO. Confirm the same receiving location and suggested quantities are preloaded while supplier is blank.
7. Select two different suppliers and confirm the selected lines remain available for both.
8. Review the PO and confirm KCP reloads current purchase UOMs, pack sizes and costs before allowing submission.
9. Remove `nav-purchase-orders`; confirm the low-stock list stays readable but the PO action is unavailable and direct PO routes are denied.
10. Remove `nav-dashboard` or `nav-ingredients`; confirm the alert cannot open the screen and the direct low-stock route is denied.
11. Restrict location access and confirm another location cannot be requested directly.
12. Load a location online, disconnect and confirm its marked snapshot remains searchable but cannot start a PO.

## Completion gate

A Phase 12 low-stock alert opens the full authorised shortage list and selected items become a supplier-independent purchase-order draft without manually finding them again.

## Phase boundary

Phase 13 does not edit thresholds or par levels, auto-select a supplier, auto-submit a purchase order, add supplier-stock relationships, reserve stock, forecast demand, schedule replenishment, queue offline mutations or calculate costs on the client.
