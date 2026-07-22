import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROLE_SETS } from '../role-sets/roleSetModel';
import type { KcpAction } from '../flow/actionModel';
import { rankAction, rankActions } from './actionPriority';

const role = BUILT_IN_ROLE_SETS[6];
function action(id: string, extra: Partial<KcpAction> = {}): KcpAction { return { id, workspaceId: 'ws', location: null, actionType: 'routine_checklist', sourceRecord: { type: 'routine', id }, assignment: { type: 'role_set', id: role.id, label: role.name }, title: id, priority: 'normal', dueAt: '2026-07-21T12:00:00Z', status: 'ready', progress: { completed: 0, total: 1, percent: 0 }, requiredPermission: 'nav-tasks', financialImpact: null, deepLink: '', steps: [], notes: '', evidence: [], revision: 1, updatedAt: '2026-07-21T07:00:00Z', ...extra }; }
describe('deterministic Action priority', () => {
  it('places an overdue blocking Role Set Action ahead of later work and explains why', () => {
    const clock = new Date('2026-07-21T10:00:00Z');
    const urgent = action('urgent', { dueAt: '2026-07-21T08:30:00Z', routing: { blockingActionIds: ['receive-1'] } });
    const later = action('later', { dueAt: '2026-07-21T15:00:00Z', priority: 'high' });
    expect(rankActions([later, urgent], role, clock)[0].id).toBe('urgent');
    expect(rankAction(urgent, role, clock).explanation).toContain('overdue');
  });
});
