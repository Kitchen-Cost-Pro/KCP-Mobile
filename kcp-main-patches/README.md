# KCP main integrations

## KCP Flow

Mount `KcpFlowRoutinesAdmin.tsx` with `TaskTemplatesAdmin.css` in workspace administration. Pass the existing authenticated workspace API adapter and populate `assignmentOptions` from active users, Role Sets, Action Groups and locations. An Action Group assignment is resolved by the Worker against current active group membership, the user's existing permissions and their existing location access.

Use the existing permission identifiers `nav-tasks` and `action-manage-task-templates`; only their labels change to KCP Flow and Routines. This preserves every existing Role Set. Merge `phase17-permissions.json` into the permission catalogue to update those labels. The Worker remains the security boundary.

`TaskTemplatesAdmin.tsx` remains as a compatibility re-export for an existing mount. New mounts should use `KcpFlowRoutinesAdmin`.

The deployment flow adds `/actions` and `/routines` APIs while retaining the earlier `/tasks` and `/task-templates` aliases. Existing operational records, completion evidence and activity history are projected into the shared Action contract without moving or deleting Phase 14 data.

## Phase 21–22 — Routine policy and Action routing

Run `node scripts/ensure-phase21-22-routines-routing-worker.mjs /path/to/kcp-api-worker` after the Phase 20 worker extension. Mount the updated **Routines** component in KCP Main. It captures each routine’s timezone, duration, evidence and approval requirement, escalation, dependencies and active dates; mobile remains completion-first.

Generation is idempotent by routine, local-date occurrence, assignment and location. The Worker records immutable generation and routing history, excludes already-created instances, and derives due times in the workspace timezone. Assignment and location access remain permission-authoritative.

The mobile Today order uses deterministic KCP signals: overdue state, due time, operational risk, financial impact, role/user responsibility, location urgency, dependencies, approval state, confidence and estimated duration. Each Action carries a plain-language explanation. Managers must provide a reason for defer, reassignment or cancellation; AI recommendations are intentionally not part of this authority path.

## KCP User Actions — Role Sets

Add **Role Sets** below **Routines** in `User Management → KCP User Actions`. Mount `RoleSetsAdmin.tsx` with `RoleSetsAdmin.css`, passing active workspace users, locations and the authenticated workspace API adapter. Gate the page with the existing `action-manage-roles` permission.

The searchable selector ships with ten built-in Role Sets and supports custom additions through the same API. Role Set locations are intersected with the user's permission-authorised locations, and the Worker independently checks Action assignment, location access and required permissions. Never merge Role Set locations or shortcuts into the permission catalogue.

## Approval policies

Mount `ApprovalPoliciesAdmin.tsx` with its CSS in workspace administration and gate the route with `action-manage-approval-policies`. Pass active locations, available Role Set identifiers and the existing authenticated workspace API adapter. Merge `phase15-permissions.json` into the permission catalogue.

Policy changes are versioned. Submitted approval requests retain a locked payload and immutable policy snapshot, so editing a policy never changes an in-flight decision route.

## Notifications

Merge `phase16-permissions.json` into the permission catalogue and grant `action-manage-notifications` only to owner/admin automation identities. Configure the authenticated notification-dispatch schedule outside the public client.

Set `PUSH_GATEWAY_URL` and `PUSH_GATEWAY_TOKEN` as Worker secrets. Removing the gateway secret safely pauses delivery without affecting Actions, approvals or stock operations.
## Phase 23 — Operations Control

Add `KcpFlowOperationsControl.tsx` and `KcpFlowOperationsControl.css` to the KCP Main KCP Flow administration section. Supply the existing authenticated workspace API wrapper, permitted locations, and active eligible users/Role Sets as `assignmentOptions`. The manager-facing routes are:

- `GET actions/manager/control?view=overdue&locationId=...`
- `POST actions/manager/actions/:actionId/{reassign|escalate|defer|priority|resolve_blocker}`

The Worker requires a manager role, enforces location access, requires an intervention reason, validates active reassigned users and writes every intervention to immutable management history.

## Phase 24 — KCP User Actions

Add **KCP User Actions** as the final page in `User Management`, after Users and Roles & Permissions. Mount `KcpUserActionsAdmin.tsx` with `KcpUserActionsAdmin.css`, the existing authenticated workspace API adapter, active users, existing permitted operational locations and Role Sets. Gate it with `action-manage-user-actions` from `phase24-permissions.json`.

This page deliberately has no Location Access editor and no security-permission controls. It only displays those values as read-only context; managers must use the existing user profile to alter them. The Worker validates existing active membership, existing location access and workflow permission before it accepts a direct responsibility or group membership. It records all configuration and bulk changes in immutable KCP User Actions audit history.

Run `node scripts/ensure-phase24-user-actions-worker.mjs /path/to/kcp-api-worker` after Phases 20–23, then typecheck and deploy the Worker. The installer adds direct-responsibility expansion to routine generation, preserving existing idempotency keys and duplicate protection.
