# KCP Flow — Naming and Action Foundation

## Delivered

- The finished mobile and KCP main interfaces use **KCP Flow**, **Actions** and **Routines**.
- Visible development-phase labels were removed from operational screens.
- The shared Action contract includes workspace, location, Action type, source record, assignment, priority, due time, status, progress, required permission, financial impact, deep link, completion evidence and activity history.
- Supported statuses are Upcoming, Ready, In Progress, Waiting, Completed, Deferred and Cancelled.
- Existing `task_*` storage remains in place as compatibility storage. Additive `routine_metadata`, `action_metadata` and `action_idempotency` tables enrich those rows without deleting or rewriting Phase 14 records.
- Existing rows are backfilled into Action metadata with their original IDs, Routines, assignments, due dates, revisions, steps, evidence and audit events intact.
- Routine occurrence keys are deterministic and protected by workspace-scoped uniqueness, so repeating the same event cannot produce a duplicate Action or notification.
- `/actions` and `/routines` are the new public names. Earlier routes remain aliases for installed clients.
- KCP Flow performs no stock, cost, ledger, purchase-order or manufacturing mutation.

## Verification

Run:

```bash
npm run check
npm run release:verify
```

The client tests cover legacy-record projection, all seven statuses, Action routes, encrypted recovery compatibility and offline snapshots. The Worker patch tests cover status projection, recurrence and deterministic event idempotency.

## Completion gate

Deploy the Worker extension before distributing the v0.17 client. Sign in as an existing Phase 14 user and confirm that the same assigned records appear under KCP Flow with unchanged checklist progress, evidence and history. Re-run materialisation twice and confirm the Action count does not increase. Complete an Action and verify no stock ledger movement is created by KCP Flow.
