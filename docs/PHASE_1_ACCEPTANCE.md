# Phase 1 Acceptance Record

## Implemented

- [x] Clean independent `KCP-Mobile` Git repository
- [x] React 19, TypeScript, Vite and Capacitor 8 foundation
- [x] Android and iOS native projects
- [x] KCP-branded adaptive icons and light/dark splash assets
- [x] Existing KCP API base URL configuration
- [x] Dedicated mobile login UI with no Turnstile dependency
- [x] Versioned `/api/mobile/v1` login, device registration and rotating session integration
- [x] Native Keychain/Keystore bearer-token storage
- [x] Web development fallback limited to session storage
- [x] Session validation using `/api/auth/me`
- [x] Invitation claim and profile refresh
- [x] Forced first-login password change
- [x] Password recovery handoff to the existing secure KCP web flow
- [x] Single, remembered and multi-workspace selection
- [x] Existing default-role permissions
- [x] Custom-role permissions
- [x] Role and member location intersection
- [x] Permission-aware navigation and deep-screen guards
- [x] Workspace theme/background loading
- [x] Mobile Home, Stock Take, Manufacturing and Profile layouts
- [x] Offline, timeout and server error surfaces
- [x] Safe-area, small-phone and tablet-responsive styling
- [x] No mock operational data
- [x] Unit and component test coverage for the Phase 1 security-sensitive rules

## Automated verification

Run:

```bash
npm ci
npm run check
npm run cap:sync
```

Expected:

- TypeScript passes
- Phase 1 unit and component tests pass
- Vite production build succeeds
- Android and iOS plugins sync

## Requires the deployment environment

These checks cannot be completed by a source-only build:

- [ ] Add mobile origins to the Worker `ALLOWED_ORIGINS`
- [ ] Apply `0005_mobile_devices.sql` to production `kcp_central`
- [ ] Deploy and verify the current `/api/mobile/v1` Worker routes
- [ ] Sign in with a real KCP user on a physical Android device
- [ ] Confirm Stock Taker, Prep and one custom role against production access data
- [ ] Confirm a multi-workspace account
- [ ] Confirm a location-restricted account
- [ ] Confirm session restore after force-closing the app
- [ ] Confirm logout invalidates the server session
- [ ] Confirm Android back navigation
- [ ] Confirm the app at 360px, 390px, 412px and tablet widths on devices/emulators
- [ ] Produce the signed release APK/AAB through the normal signing environment

## Explicit Phase 1 non-goals

- No Stock Take draft or submission writes
- No Manufacturing stock movements
- No offline mutation queue
- No push notifications
- No biometric unlock
- No production store release

The Stock Take and Manufacturing controls that could mutate inventory are intentionally disabled until their full API and ledger workflows are implemented.
