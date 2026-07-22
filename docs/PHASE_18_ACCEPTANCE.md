# KCP Flow — Role Sets

## Delivered

- Ten built-in Role Sets, including the six requested operating experiences, plus support for additional custom Role Sets.
- Compact searchable Role Set administration under **User Management → KCP User Actions → Role Sets**.
- Role Set user assignment, preferred Action types, priority order, default mobile shortcuts, financial visibility, location narrowing, assignment rules, reassignment, defer and escalation policy.
- Existing KCP permissions and user location access remain authoritative. A Role Set can prioritise, hide or further narrow; it cannot grant a route, operation or location.
- Role-specific Home focus, quick-action ordering, bottom-navigation defaults, KCP Flow ordering and financial presentation.
- Team Members receive an assigned-Action-first experience with Start/Resume language and no operations dashboard.
- Defer and reassign endpoints check both KCP permission/location authority and Role Set capability.
- Routine assignments can target the user's existing role or assigned Role Set.
- Existing KCP roles receive safe fallback Role Sets until explicitly assigned.
- Role Set escalation is deterministic from due time, Action priority and material financial threshold.

## Worker integration

The Phase 18 installer adds the Role Set schema and routes after reinstalling the latest KCP Flow module. It does not alter stock balances, costs, ledger services or operational mutation ownership.

Routes:

- `GET /api/mobile/v1/workspaces/:workspaceId/role-sets/current`
- `GET|POST /api/workspaces/:workspaceId/role-sets`
- `PUT /api/workspaces/:workspaceId/role-sets/:roleSetId`
- `PUT /api/workspaces/:workspaceId/role-set-assignments/:userId`
- `POST /api/mobile/v1/workspaces/:workspaceId/actions/:actionId/defer`
- `POST /api/mobile/v1/workspaces/:workspaceId/actions/:actionId/reassign`

## Completion gate

Assign two users with the same underlying permissions and locations to different Role Sets. Confirm that their Home focus, default shortcuts, Action order, financial detail and available defer/reassign controls differ. Then remove a permission and a location from one user and verify the Role Set does not restore either one.
