# Group 2 — Work-First Mobile Experience

## Phase 19 — Today

- Home is the personalised Today view, ordered as Resume, Now, Next, Quick Tools, 2×2 operational summary, Waiting and recent completed Actions.
- Action cards show responsibility, location, due time, priority, progress, operational reason, permitted financial impact and Start/Resume controls.
- Start/Resume opens the source workflow directly; Action details remain one secondary tap away.
- The previous dashboard is now Insights. Today contains only a compact operational snapshot.
- Role Set ordering and financial visibility remain effective; server permissions and location scope remain authoritative.

## Phase 20 — Existing Operations

- Stock counts/recounts, transfers, receiving, purchase ordering, manufacturing, wastage and approvals accept source preselection and report outcomes only after the actual operation succeeds.
- Successful operations complete their linked Action automatically. Approval-required operations move it to Waiting. Rejections return it with the recorded reason.
- Failed lifecycle delivery is queued locally and retried idempotently; it never changes or rolls back a successful stock transaction.
- The Worker source bridge supports deterministic source creation, status updates and cancellation with one active Action per workspace/source pair.
- The registered adapters cover approvals, scheduled counts/recounts, incoming transfers, expected POs/receiving, wastage exceptions, manufacturing requirements, low-stock interventions, interrupted drafts and unknown barcodes.
- Every Action access and lifecycle mutation rechecks workspace membership, required permission, location access, Role Set scope and assignment.
- Source adapters can call `applyOperationalSourceEvent` from the same authoritative Worker transaction path. The protected HTTP ingress exists for current KCP modules that cannot import the adapter directly.

## Completion-gate checks

1. Open Today as two users with different Role Sets and confirm ordering, tools and financial visibility differ without access widening.
2. Start each source Action and confirm its location and source record open preselected within two taps.
3. Complete the real workflow and confirm the Action closes without a second completion step.
4. Submit an approval-protected workflow and confirm Waiting; reject it and confirm the recorded reason returns with the source Action.
5. Repeat source creation and lifecycle events and confirm no duplicate active Action or duplicate stock mutation.
6. Attempt direct links from a user outside the location or permission and confirm the Worker rejects access.
