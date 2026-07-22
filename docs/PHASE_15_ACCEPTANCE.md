# Phase 15 Acceptance Record — Approvals and Exception Control

## Delivered scope

- Permissioned **Awaiting My Approval** dashboard with Submitted, Approved and Rejected buckets and optional location scope.
- Full locked transaction detail, approval levels, actor history, status and value.
- Required reason and explicit confirmation for both approval and rejection.
- Workspace policies for operation type, location, threshold, role/value limits, approvals required and self-approval prevention.
- Multi-level routing with an immutable policy snapshot on every submitted request.
- Immutable decision and audit tables protected by database triggers.
- Transactional approval event outbox ready for push-notification publication.
- Payload hash plus one-time execution permit binds final execution to the exact reviewed submission.
- Stock-take variance, high-value wastage, large/unusual transfers, purchase-order value, manual adjustments and manufacturing yield exceptions.
- The original KCP mutation route runs only after final approval; rejected and waiting submissions never update stock or document status.
- KCP main administrator component for policy creation, editing, location override, levels and role limits.

## Server-authority sequence

1. The original operation handler validates workspace, permission, location and current server data.
2. If no active policy threshold matches, the normal KCP mutation continues.
3. If a policy matches, the Worker stores the exact payload, its hash and a policy snapshot, returns HTTP 202, and performs no mutation.
4. Each approver is rechecked against current membership, location access, active level, role limit and self-approval policy.
5. Rejection permanently ends the request. Final approval issues a payload-bound execution permit internally.
6. The Worker calls the original mutation route with the locked payload. That handler verifies the permit before changing stock or document state.
7. Execution result, decisions and state changes append immutable audit and outbox events.

## Installation

Keep `KCP-Mobile` beside the current `KCP-Live`, then run `npm run worker:deploy`. The Phase 15 installer adds the approval engine, protected-operation route guard, routes, feature flag and Worker tests. It does not replace unrelated KCP source.

Mount `kcp-main-patches/ApprovalPoliciesAdmin.tsx` in workspace administration and merge `phase15-permissions.json`. Gate mobile approvals with `nav-approvals` and `action-approve-exceptions`; gate policy administration with `action-manage-approval-policies`.

## Automated acceptance

Run `npm run check`. Client coverage verifies approval routing, explicit reason payloads, permission mapping and locked-response recognition. The installed Worker test covers multi-level selection and removal of execution credentials from the payload hash.

## Live completion gate

1. Configure a low test threshold and self-approval prevention in KCP main.
2. Submit a protected operation as one user and confirm HTTP 202, a Submitted approval card, and unchanged stock/document status.
3. Confirm that the creator, an unauthorised role and a user outside the location cannot approve it.
4. Approve each configured level with a different authorised user and a reason.
5. Confirm that only final approval posts the original transaction once and moves the request to Approved/executed.
6. Repeat with rejection and confirm the operation remains unapplied.
7. Inspect decision, audit and outbox records; update/delete attempts against immutable decision or audit rows must fail.

## Completion gate

A protected transaction cannot affect stock or change document status until an authorised approver explicitly approves the exact locked payload.
