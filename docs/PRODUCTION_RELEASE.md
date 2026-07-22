# Production Deployment and Rollback

## Required secrets and external services

- Android release JKS and `android/keystore.properties` based on `docs/release/keystore.properties.example`.
- Firebase Android `google-services.json` and iOS `GoogleService-Info.plist` for the production bundle IDs.
- Apple distribution certificate/provisioning access, `KCP_IOS_TEAM_ID` and an approved export-options plist.
- `VITE_KCP_API_BASE_URL`, `VITE_SENTRY_DSN` and the approved trace sample rate.
- Worker secrets `PUSH_GATEWAY_URL` and `PUSH_GATEWAY_TOKEN`; the gateway must route Android messages to FCM and iOS messages to APNs.
- Sentry release/source-map credentials in CI if source maps are uploaded. No telemetry secret belongs in the repository.

## Release sequence

1. Freeze a tested commit and record the current Worker deployment/version, mobile store versions and database migration state.
2. Run `npm ci`, `npm run check`, `npm run release:verify` and `npm run cap:sync`.
3. Deploy the Group 2 Worker with `npm run worker:deploy`. It installs extensions through Phase 20 idempotently, type-checks/tests the Worker, applies central D1 migrations and verifies protected routes.
4. Configure a scheduled call to the authenticated `POST /notification-dispatch` route. Use an owner/admin service identity with `action-manage-notifications` and a cadence approved for overdue/due alerts.
5. Run the completion-gate scenario on production-like Android and iOS devices, including denied notification permission and a revoked device.
6. On the approved signing runner, run `npm run release:build`. The command refuses missing push/signing inputs and verifies the resulting signatures.
7. Upload the AAB and IPA, use staged rollout, and monitor authentication failures, notification delivery, deep-link denials, crash-free sessions and API latency.
8. Promote only after the observation window and an authorised release sign-off.

## Rollback

1. Pause store rollout and the notification-dispatch schedule. Do not delete the outbox; retained rows can be inspected or replayed safely by dedupe key.
2. Roll the Worker back to the recorded deployment using Cloudflare deployment history. The notification, Role Set and Action source tables are additive and can remain in place.
3. Restore the previous mobile store release. Revoke affected device tokens if credentials may be compromised.
4. If push delivery is faulty, remove or rotate `PUSH_GATEWAY_TOKEN` while leaving the operational API running.
5. Confirm stock-changing operations and approval execution remain authoritative before reopening rollout.
6. Preserve Sentry events, Worker logs and immutable approval/task audits for incident review.

Never roll back by deleting tenant data or approval audit records. Database removal is not part of routine rollback.
