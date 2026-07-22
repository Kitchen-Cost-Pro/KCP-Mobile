# Phase 11 Acceptance Record — Workspace Branding

## Delivered scope

- The Home greeting tile now displays the selected workspace logo configured in the main KCP app.
- The client reads KCP's canonical `restaurantLogoDataUrl` setting and supports its legacy `logoDataUrl` and `customerLogoDataUrl` aliases.
- Logo sources are limited to KCP's bounded base64 PNG, JPEG, WebP, GIF and SVG image formats.
- Remote URLs, non-image data and oversized values are rejected before rendering.
- Missing or failed images fall back to the selected workspace's initials instead of the previous sparkle ornament.
- The logo remains contained on narrow screens without cropping the artwork.
- No duplicate logo upload, branding database or unauthorised public image route was added.

## Automated acceptance

Run from `KCP-Mobile`:

```bash
npm run check
npm run cap:sync
npm audit --omit=dev
```

The suite verifies canonical and legacy KCP logo fields, unsafe-source rejection, Home rendering, image-error recovery and every earlier mobile regression.

## Live-data acceptance checks

1. In the main KCP app, upload or change the workspace logo in Settings.
2. Open or refresh KCP Lite in the same workspace and confirm the greeting tile shows that exact logo.
3. Switch to a second workspace and confirm its own logo or initials are shown.
4. Remove a workspace logo in the main app and confirm KCP Lite displays the workspace initials after refresh.
5. Confirm long, portrait and transparent logos remain fully contained on a narrow phone screen.
6. Confirm changing the logo does not alter the workspace background, theme, permissions or selected location.

## Deployment

Phase 11 is a client-only release. It requires a rebuilt web/native app but no Worker deployment and no D1 migration.

## Phase boundary

Phase 11 reuses workspace branding already managed by the main KCP app. KCP Lite does not upload, edit or independently store logos.
