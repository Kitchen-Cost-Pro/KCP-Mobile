# Phase 6 Acceptance Record — Transfer Route Experience

## Delivered scope

- Replaced the browser/operating-system From and To dropdowns with KCP-styled mobile selection cards.
- Added a reusable operational location bottom sheet with large touch targets, location type, default-location context and selected-state checkmark.
- Destination selection excludes the current source, making an invalid same-location route impossible in the UI.
- Source selection retains the existing current/default-location preference.
- Changing source with existing items requires confirmation because availability is source-specific.
- Cancelling the warning preserves the source, destination and every draft item.
- Confirming the source change clears source-specific items and clears the destination only when it matches the new source.
- Long permitted-location lists receive in-sheet name/type search.
- Bottom-sheet interaction supports Escape, focus restoration, focus containment, backdrop dismissal, body-scroll lock and reduced-motion settings.
- Secure recovered transfer drafts display their saved From and To selections without changing KCP permission or posting rules.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
```

The suite covers selection and exclusion, long-list filtering, focus and Escape behaviour, cancelled and confirmed source changes, secure route recovery, and the complete reviewed/idempotent transfer submission.

## Real-device checks

1. Open a new internal transfer and confirm From defaults to the current or default permitted location.
2. Open each route card and verify the bottom sheet fits above Android/iOS safe areas.
3. Confirm To never lists the selected From location.
4. With seven or more permitted locations, search by both location name and location type.
5. Add a stock item, attempt to change From, cancel, and verify the entire draft remains unchanged.
6. Repeat and confirm the change; verify source-specific lines clear before searching stock again.
7. Terminate and reopen the app with a saved transfer and verify both route cards restore correctly.
8. Complete a transfer and verify the same authoritative KCP receipt and transaction reference as Phase 4.

## Deployment boundary

Phase 6 is a KCP Lite client release only. It adds no Worker route, database migration, permission, transfer payload or ledger change. Distribute a new Android/iOS build after `npm run cap:sync`; deploying `kcp-api-v2` is not required specifically for Phase 6.
