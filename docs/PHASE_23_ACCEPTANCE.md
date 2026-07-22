# Phase 23 — Operations Control acceptance

## Manager visibility

- A manager can switch between all Actions, location, Role Set, user, overdue, waiting, blocked, completed, high-financial-impact and unassigned views.
- Only locations authorised for that manager are returned by the Worker.
- Each Action exposes its completion progress, permitted financial impact, evidence metadata, source deep link and immutable Activity history.

## Interventions

- Reassigning accepts only an active workspace user or Role Set; user reassignment also respects location authorisation where that membership table is present.
- Escalate, defer, change priority and resolve blocker require a non-empty manager reason.
- Every intervention is recorded in `action_management_events`; original Activity history is never overwritten.
- Completed Actions cannot be deferred.

## Measurements

- Operations Control returns completion rate, average completion time, overdue rate, deferred and rejected submission counts, resolved financial impact, location readiness and workload by user/Role Set.
- The measurement period for completed, deferred, rejected and financial-impact metrics is the trailing 30 days.
- Approval turnaround intentionally returns `null` until an approved/rejected event pair is emitted by the Phase 15 approval engine; no guessed metric is shown.

## Deployment

1. Apply Phases 20–22 first.
2. Run `node scripts/ensure-phase23-operations-control-worker.mjs /path/to/kcp-api-worker`.
3. Typecheck and deploy the Worker, then mount the KCP Main Operations Control component behind the existing manager/KCP Flow access route.
