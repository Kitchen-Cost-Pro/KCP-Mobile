# Phase 24 — KCP User Actions acceptance

- User Management contains **KCP User Actions** after Users and Roles & Permissions.
- Users are searchable and show Role Sets, Action Groups, current Actions, overdue count and next Action.
- A manager can configure a primary Role Set, additional/location-specific Role Sets, preferences and direct responsibilities without altering permissions or location access.
- Action Groups have members, operational locations, associated Role Sets, assignment behaviour, a manager and escalation contact. A group can have multiple members.
- Existing user access and permissions are checked before a responsibility can route to the user. Inactive users, unauthorised locations, self-backups and duplicate direct routes are rejected with a clear correction.
- A seven-day preview explains what will be received and by which route before activation.
- Bulk changes show an eligibility impact preview and cannot apply invalid users.
- Every profile, group, responsibility and bulk change is appended to immutable audit history. Removing group membership never deletes historical Actions.
- No Phase 24 route grants, changes or stores a user's location access. KCP Mobile only consumes the resulting permission-safe Actions in Today.
