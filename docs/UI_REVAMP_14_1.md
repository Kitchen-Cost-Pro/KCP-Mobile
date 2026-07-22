# Phase 14.1 UI Revamp — KCP Main Alignment

## Design plan

1. Preserve the existing KCP theme, permissions, data and operational routes; change presentation only.
2. Match the supplied main-dashboard reference with a near-black canvas, graphite surfaces, cool-grey borders, uppercase labels and restrained mint, amber and rose status colour.
3. Make the Home dashboard the visual anchor: labelled location/date controls, a compact scope row and full-width numeric metric cards.
4. Propagate the system through shared buttons, fields, cards, status tabs, sheets, operation headers, task checklists and fixed action/navigation bars.
5. Keep controls at least 40 pixels tall, retain semantic headings and labels, expose visible focus states and preserve reduced-motion support.
6. Validate every existing workflow with the full automated suite, production build and Capacitor synchronization.

## Implemented system

- `#0d1117` page canvas with solid `#171c23` cards and `#202631` interactive controls.
- Thin `#303844` borders and minimal shadow use replace decorative gradients and glass-heavy panels.
- Mint is reserved for primary actions, active navigation and positive state; amber and rose communicate attention and risk.
- Dashboard filters mirror KCP main. The date control truthfully remains **Today**, matching the current server-supported period.
- Dashboard metrics are vertically stacked, use tracked uppercase labels, large values and explicit prior-period availability copy.
- Quick actions use compact full-width rows; mobile sheets, search fields, checklists and operational cards share the same geometry.
- Bottom navigation is edge-aligned and uses a subtle active indicator rather than a floating glass pill.
- Existing workspace logos and background images remain supported but are visually subdued behind the main-app surface system.

## Acceptance checks

1. At 320, 390, 430, 600 and 700 pixel viewport widths, no primary text, cards, filters or bottom navigation overflow horizontally.
2. Location opens the existing picker and continues to drive the location-scoped dashboard request.
3. Date range displays Today without pretending that unsupported ranges are selectable.
4. Unavailable metrics remain omitted rather than rendered as zero.
5. All operational flows, permission guards, recovery stores, offline states and completion actions behave exactly as before.
6. Keyboard focus, touch target size and reduced-motion behaviour remain intact.
