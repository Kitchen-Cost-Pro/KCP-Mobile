# Mobile Security Decisions

## Sessions

- Android stores the KCP session through AES-GCM with a key held by Android Keystore.
- iOS stores the KCP session in Keychain with device-only, unlocked access.
- iCloud synchronisation is disabled.
- Android application backup is disabled.
- Browser development uses session storage and does not persist across browser sessions.
- Mobile access tokens are short-lived; refresh tokens rotate on every refresh and are bound to a registered device.
- Concurrent refreshes are coalesced so an older one-time token is not replayed.
- Logout revokes the current device token family and then clears local storage.
- An unrecoverable 401 clears the local mobile session.

## Network

- Production API traffic is HTTPS only.
- Android cleartext traffic is disabled.
- Requests time out after 30 seconds by default.
- API server errors are not replaced with local fallback data.
- Content Security Policy restricts scripts to the application and blocks third-party frames.
- Browser development uses a same-origin Vite proxy; production and native builds connect directly over HTTPS.

## Permissions

- Mobile capabilities derive from the same KCP role and custom-role definitions.
- Assigned user locations are intersected with role locations.
- Owners, admins and KCP superusers keep existing unrestricted-location behaviour.
- Unauthorised mobile routes fall back to Home.
- Future mutation endpoints must enforce the same permission and location checks server-side.

## Operational data

- Phase 2 keeps only the currently active count package and unsaved count lines in device-only Keychain/Keystore-backed storage for interruption recovery.
- Device recovery keys are scoped to both the authenticated user and workspace so another user on the same device cannot resume the count.
- Browser previews use session storage and discard recovery data when the browser session ends.
- The server remains authoritative for UOM ratios, expected quantities, costs, variances and ledger writes.
- Offline users may continue entering the active count, but they cannot start, reconcile or commit while disconnected.
- Draft updates use optimistic revisions; stale devices cannot silently overwrite newer server drafts.
- Commit requires a fresh server reconciliation token and uses the stable count session ID for idempotency.
- Phase 3 stores only the unfinished single-item wastage form in the same device-only, user-and-workspace-scoped recovery storage.
- Barcode resolution is exact and server-side. Unknown codes never create stock items, and ambiguous matches are not guessed. Twelve-digit numeric UPC scans are canonicalised to KCP's EAN-13 representation (one leading zero) in both KCP Main and mobile before lookup; all other barcode formats remain exact.
- A scanned custom UOM ratio is informational on the client; Wastage reloads and converts against the database configuration before posting.
- Wastage requires `nav-adjustments`, validates the selected location again, and delegates to the existing KCP adjustment engine.
- Each wastage entry keeps one stable client action ID so a retry cannot deduct stock twice.
- Native camera permission is used only when the user explicitly opens the barcode scanner.
- Phase 4 transfer drafts use the same device-only, user-and-workspace-scoped recovery storage and are removed only after an authoritative success or explicit discard.
- Transfer-only catalogue search requires `nav-transfers`, revalidates source-location access, and returns mobile-safe item/UOM/barcode/on-hand fields without cost data.
- Internal transfer requests carry one stable client action ID. The Worker reloads item and UOM data, validates both locations, and delegates the ID to the existing idempotent transfer engine.
- Incoming acceptance requires explicit confirmation and server-validates each received quantity against what was shipped. Rejection requires explicit confirmation and a non-empty audit reason.
- Offline transfer drafts remain editable, but searching, refreshing, accepting, rejecting and posting are blocked until KCP is reachable. There is no offline mutation queue.
- Manufacturing requires `nav-mfg-products` and revalidates the selected location on catalogue load, legacy search/barcode lookup, preview and commit.
- Phase 7 returns every active manufactured product. Items without a usable server-side blueprint remain visible but disabled; the Worker still rejects them if called directly.
- The client never calculates component deductions or trusts displayed balances for posting. Run preview expands each current KCP blueprint, reads current location balances and aggregates shared ingredients on the Worker.
- Confirmation requires the fresh SHA-256 run-preview token. A first commit rejects changed products, quantities, recipes or availability before any child batch is posted.
- Each unfinished multi-item production run and its catalogue snapshot are encrypted in device-only, user-and-workspace-scoped recovery storage. They are removed only after authoritative success or explicit discard.
- Child batch IDs are bound to the exact run ID, preview token, location, ordered entries, quantities and notes. The same request can resume after interruption without double consumption; altered retries cannot silently reuse a posted child.
- Each product is revalidated immediately before delegation to the existing atomic KCP Manufacturing engine. A grouped run is safely resumable, while every individual component/output ledger write remains atomic; the run does not claim one cross-product D1 transaction.
- Offline recovered Manufacturing runs remain editable, but catalogue refresh, preview and posting are blocked until KCP is reachable. There is no offline mutation queue.
- Goods Receiving requires `nav-grv`; the Worker revalidates workspace membership and the PO/header/line receiving locations on every load, preview and commit.
- Supplier, location, stock items, purchasing UOMs, pack sizes and costs are server-loaded from the PO. Mobile cannot add an off-order item or request a cost override.
- Barcode matches are exact and limited to outstanding lines on the selected PO. Unknown or ambiguous codes are not guessed.
- Preview reloads the current PO, blocks quantities above outstanding, detects an invoice already used for the supplier and binds the reviewed values to a SHA-256 token.
- Commit recalculates that preview, requires explicit confirmation, and delegates the stable receipt to KCP's existing atomic GRV engine. Stock, movement, audit and PO-state writes are not performed by the client.
- Stable client IDs, payload fingerprints and PO-state-bound receipt IDs protect ordinary retries and competing devices from duplicate stock receipts.
- The unfinished receipt and PO snapshot use device-only, user-and-workspace-scoped recovery storage. Offline entry may continue, but order refresh, barcode verification, preview and posting require KCP connectivity.
- Purchase Ordering requires `nav-purchase-orders`; active supplier and receiving-location access are revalidated for catalogue, preview, draft save and submission.
- The client cannot set PO costs, UOM conversion or pack size. The Worker reloads these fields from current KCP item and location data and delegates final persistence to the existing PO engine.
- Submitted mobile orders use deterministic workspace/client IDs and an exact-payload fingerprint. Another user cannot take over the draft, a submitted PO cannot be mutated, and an altered retry must obtain a fresh preview.
- Unfinished PO entry and its catalogue snapshot use device-only, user-and-workspace-scoped recovery. Offline entry may continue, but catalogue refresh, server draft save, preview and submission require connectivity; there is no offline order queue.
- Supplier selection never grants or removes item access. Every active stocked item can be ordered from any active supplier while KCP still reloads authoritative UOM, pack size and location cost.
- PO detail exposes only mobile-safe supplier, location, line, receiving-progress and audit fields after permission and location checks.
- Draft deletion is limited to `draft` status and the authenticated creator of that mobile draft. Submitted, partially received and completed orders remain immutable through mobile routes.
- PDF documents are generated on-device from already-authorised PO detail. Native files use the app cache and the operating-system share sheet; they are not uploaded to another service by KCP Lite.
- Phase 11 reads the selected workspace's existing KCP logo only from the authorised workspace settings response. The client accepts the same bounded base64 image MIME types as KCP desktop, rejects remote URLs and non-image data, and stores no duplicate branding record.
- Phase 12 requires `nav-dashboard` on the Worker and scopes every dashboard request to either the selected authorised location or the user's complete permitted-location set. Restricted users never receive global workspace data.
- Sales and food-cost metrics retain the existing `nav-reporting` check. Unavailable or unauthorised metric groups are omitted instead of being represented as false zeroes; attention links are interactive only when the corresponding mobile flag and operation permission are present.
- Phase 13 low-stock reads require both `nav-dashboard` and `nav-ingredients`, a single explicit location and successful server-side location revalidation. The Worker returns no supplier data and derives current quantity, configured threshold, par level, purchasing UOM, pack size and suggested quantity from KCP data.
- Starting an order additionally requires `nav-purchase-orders` in both the client and the existing PO Worker routes. The hand-off carries only stock-item IDs and suggested purchase quantities; PO setup reloads the complete supplier-independent catalogue and current KCP costs after the supplier is chosen.
- Low-stock snapshots are read-only and scoped to the authenticated user, workspace and location. Native snapshots use device-only secure storage; browser development uses session storage. Offline mode cannot create, save, preview or submit a PO.
- Phase 15 approval endpoints require `nav-approvals` and `action-approve-exceptions`; policy administration separately requires `action-manage-approval-policies`. Every request rechecks active workspace membership and relevant location access.
- Protected operations store the exact payload, a SHA-256 payload hash, current server-derived transaction detail and an immutable policy snapshot before returning HTTP 202. No stock or document mutation occurs on submission.
- Final execution requires an unguessable permit whose hash is stored server-side. The original operation handler revalidates the permit, payload, value and current transaction detail before delegating to the existing KCP mutation engine.
- Approval decisions and audit events are append-only, with database triggers rejecting updates and deletes. The separate outbox is intentionally mutable only for push-publication attempts and acknowledgement.
- Role/value limits, active approval level, decision quorum and creator exclusion are server-enforced. Conditional state transitions and stable operation idempotency keys prevent competing final approvals from executing the mutation twice.
- Manufacturing component shortages can be submitted as locked exceptions. Only an internally verified final approval can bypass the normal shortage block; direct batch routes keep rejecting shortage overrides.
- No fake counts or sample movement records are bundled.
- Non-sensitive workspace and location preferences may be stored locally.

## Production checklist

1. Review third-party dependency changes before upgrading.
2. Run `npm audit --omit=dev` and `npm run check`.
3. Confirm Worker CORS allows only intentional origins.
4. Confirm web Turnstile remains enforced and `/api/mobile/v1/session/login` retains credential and IP rate limiting.
5. Confirm `0005_mobile_devices.sql` is applied to the production central D1 database.
6. Confirm camera usage text and scanner behaviour on a real Android and iOS device.
7. Build Android and iOS only in controlled signing environments.
8. Never commit `.env`, signing keys, keystores or service secrets.
