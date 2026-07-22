# Phase 3 Acceptance Record — Barcode Lookup and Wastage

## Implemented

- [x] Stock Lookup requires both `scan=true` and `nav-ingredients`
- [x] Wastage requires both `wastage=true` and `nav-adjustments`
- [x] Selected locations come from the authenticated, server-filtered mobile bootstrap
- [x] Native Android/iOS camera scanner through the Capacitor 8 scanner plugin
- [x] Secure-browser camera support and manual barcode fallback
- [x] Exact server barcode lookup; no client substring resolution
- [x] Base-UOM and custom-UOM barcode matches
- [x] Unknown barcode controlled state without catalogue creation
- [x] Ambiguous duplicate barcode blocking state without guessing
- [x] Permissioned item-name, SKU and category search fallback
- [x] Read-only stock result with location on-hand, SKU, category, base UOM and matched UOM
- [x] Single-item wastage entry with positive quantity validation
- [x] Base/custom-UOM selection where available
- [x] Required reason presets, custom reason and optional audit note
- [x] User-and-workspace-scoped secure interruption recovery
- [x] Server-authoritative UOM conversion and location costing
- [x] Explicit review and confirmation before live stock mutation
- [x] Stable client action ID and idempotent KCP adjustment posting
- [x] Authoritative base quantity, value and transaction reference receipt
- [x] Lazy-loaded scanner bundle to protect launch performance
- [x] Android camera permission, API 26 minimum and iOS camera usage description
- [x] Unit/component coverage for endpoint routing, UOM normalization, permission gating, unknown barcodes and one commit

## Automated verification

Run:

```bash
npm ci
npm run check
npm run cap:sync
```

Expected:

- Strict TypeScript passes
- Phase 1–3 tests pass
- Vite production build succeeds with the scanner in an on-demand chunk
- Android and iOS projects include the barcode scanner plugin

## Live-data and real-device acceptance

- [ ] A role without `nav-adjustments` cannot see or call Wastage
- [ ] A role without `nav-ingredients` cannot see Stock Lookup or use catalogue search
- [ ] A restricted user sees and posts only at assigned locations
- [ ] Camera denial gives a recoverable state; manual entry remains usable
- [ ] EAN/UPC, Code 128 and a KCP custom-UOM barcode resolve correctly
- [ ] An unknown barcode creates no item and no stock movement
- [ ] An intentionally duplicated barcode is blocked as ambiguous
- [ ] Base quantity and one custom-UOM quantity match KCP desktop conversion
- [ ] Wastage value matches the selected location cost
- [ ] Force-closing during entry restores the unfinished form for the same user only
- [ ] Retrying the same submission creates exactly one adjustment and stock deduction
- [ ] The returned transaction reference appears in KCP reporting
- [ ] Validate 360px, 390px, 412px and tablet layouts

## Explicit Phase 3 non-goals

- No item creation or barcode correction from mobile
- No offline catalogue lookup or offline stock mutation queue
- No multi-item wastage basket
- No editing or reversing a posted adjustment
- No transfer lifecycle UI
- No Manufacturing stock movements
- No store release, biometrics or push notifications
