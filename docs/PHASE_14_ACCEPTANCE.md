# Phase 14 Acceptance Record — Operational Tasks and Checklists

## Delivered scope

- Permissioned **My Tasks** dashboard with Open, Due Today, Overdue and Completed buckets.
- Existing mobile location picker scopes list requests; the Worker independently validates workspace, `nav-tasks`, location and user/role/location assignment.
- KCP main administrator component for creating and updating one-off, daily, weekly and monthly templates.
- Template checklists, due date/time, priority, user/role/location assignment, notes and optional JPEG/PNG/WebP evidence.
- New workspace tables for templates, steps, assignments, materialised instances, instance steps, evidence and audit records.
- Deterministic recurring instances and unique constraints prevent duplicate daily/weekly/monthly work.
- Revision-safe progress saving, required-step validation, retry-safe completed responses and server completion history.
- Secure device-only interruption recovery scoped to user and workspace.
- Read-only, user/workspace/location-scoped offline list snapshot. Offline completion is intentionally unavailable.

## Installation

Keep `KCP-Mobile` beside the current `KCP-Live`, then run `npm run worker:deploy`. The guarded installer adds the Worker module, task routes, feature flag and tests without replacing unrelated KCP source.

Mount `kcp-main-patches/TaskTemplatesAdmin.tsx` in the KCP main workspace administration area using the existing authenticated workspace API adapter. Populate assignment choices from active users, roles and locations. Gate the page with `action-manage-task-templates`; the Worker enforces the same permission.

## Automated acceptance

Run `npm run check`. Coverage verifies versioned task routes, assignment permission mapping, checklist execution, secure recovery integration, offline snapshots, recurrence and bucket classification.

## Live completion gate

1. In KCP main, grant a manager `action-manage-task-templates` and create a daily checklist with two required items.
2. Assign it to an active location and choose a due time and priority.
3. Sign in to mobile as a user with `nav-tasks` and access to that location.
4. Confirm the task appears in the correct bucket and cannot be requested from an unauthorised location or user.
5. Tick the checklist, add notes and a photo, interrupt and reopen the app, then confirm the secure draft resumes.
6. Save progress, complete the task and confirm it moves to Completed.
7. In KCP main, confirm the completion actor, timestamp, checklist state, notes, evidence metadata and audit history.

## Completion gate

A manager can create a recurring checklist in KCP main, assign it to a location, and see an authorised mobile user resume and complete it with an auditable history.
