# Phase 16 Acceptance — Notifications, Deep Links and Production Release

## Implemented

- Capacitor push registration for Android and iOS, including permission state, token rotation and foreground registration refresh.
- Per-user preferences for task assigned/overdue, approval requested/completed, low stock, incoming transfers and PO delivery reminders.
- Server-side token ownership checks, active-token filtering, device revocation and refresh-session revocation.
- A tenant notification outbox with dedupe keys, retry state and a configurable push-gateway boundary.
- Task assignment, overdue task, approval request/completion, low-stock, incoming-transfer and PO-due event generation.
- `kcplite://workspace/:workspace/:route/:record` links for tasks, approvals, transfers, purchase orders and location low stock.
- Authorisation is re-evaluated after a link opens. Cross-workspace links switch only to a workspace already returned for that user.
- Foreground access-token refresh; user/workspace-scoped read snapshots for operational reads.
- Secure, deduplicated offline queueing only for checklist completion without new photo evidence. Stock-changing operations remain online-only.
- Optional privacy-filtered Sentry crash/performance telemetry configured through environment variables.
- Keyboard focus, 44 px target minimums, live error/status semantics, reduced-motion support and long-list rendering containment.
- Android/iOS version 0.16.0, push/deep-link native configuration and credential-gated release build verification.

## Completion-gate scenario

1. Create a task or protected exception for a second authorised user.
2. Run the scheduled/administrative notification dispatcher.
3. Confirm the target device receives one enabled notification.
4. Tap it while signed out, signed in to the same workspace and signed in to another authorised workspace.
5. Confirm login/session recovery completes, the correct workspace is selected and the exact record opens.
6. Complete the task or approval and confirm the result appears in KCP main after refresh.
7. Revoke the device and confirm its refresh session and notification tokens cannot be reused.

This scenario requires deployed Worker changes, real APNs/FCM credentials, a configured push gateway and two real devices. It cannot be certified from the source archive alone.

## Security invariants

- A push payload is navigation metadata, never authorisation.
- Every opened record is loaded again through an authenticated, permission- and location-scoped endpoint.
- Revoked and inactive device tokens are excluded by the server.
- Notification delivery failure never changes a protected transaction outcome.
- Offline stock takes, waste, transfers, receiving, manufacturing, PO mutations and approval decisions are not queued.
- A queued task completion preserves the last known task revision so the Worker can reject stale work.

## Evidence commands

```bash
npm run check
npm run release:verify
npm run cap:sync
npm run api:verify
```

Use `npm run release:build` only on an approved signing runner with the production files described in `PRODUCTION_RELEASE.md`.
