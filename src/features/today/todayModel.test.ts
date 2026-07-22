import { describe, expect, it } from 'vitest';
import { BUILT_IN_ROLE_SETS } from '../role-sets/roleSetModel';
import type { KcpAction } from '../flow/actionModel';
import { bucketTodayActions } from './todayModel';
import { routeForAction } from './actionRouting';

const role = BUILT_IN_ROLE_SETS[1];
function action(id: string, status: KcpAction['status'], dueAt: string, extra: Partial<KcpAction> = {}): KcpAction { return { id, workspaceId: 'ws', location: { id: 'loc', name: 'Kitchen' }, actionType: 'stock_count', sourceRecord: { type: 'stock_count', id }, assignment: { type: 'user', id: 'u', label: 'User' }, title: id, priority: 'normal', dueAt, status, progress: { completed: status === 'in_progress' ? 1 : 0, total: 2, percent: status === 'in_progress' ? 50 : 0 }, requiredPermission: 'nav-stock-count', financialImpact: null, deepLink: '', steps: [], notes: '', evidence: [], revision: 1, updatedAt: dueAt, ...extra }; }

describe('Today Action orchestration', () => {
  it('places one current Action first and separates urgent, later, waiting and recent work', () => {
    const clock = new Date('2026-07-21T08:00:00Z');
    const result = bucketTodayActions([
      action('resume', 'in_progress', '2026-07-21T10:00:00Z'),
      action('urgent', 'ready', '2026-07-21T12:00:00Z', { priority: 'urgent' }),
      action('later', 'ready', '2026-07-21T16:00:00Z'),
      action('wait', 'waiting', '2026-07-21T09:00:00Z'),
      action('done', 'completed', '2026-07-21T07:00:00Z', { completedAt: '2026-07-21T07:30:00Z' })
    ], role, clock);
    expect(result.resume?.id).toBe('resume'); expect(result.now.map((item) => item.id)).toContain('urgent'); expect(result.next.map((item) => item.id)).toContain('later'); expect(result.waiting).toHaveLength(1); expect(result.completed).toHaveLength(1);
  });
  it('routes a source Action directly to its operational workflow', () => {
    expect(routeForAction(action('po', 'ready', '2026-07-21T10:00:00Z', { actionType: 'expected_delivery', sourceRecord: { type: 'purchase_order', id: 'po-1' } }))).toBe('receiving');
    expect(routeForAction(action('approval', 'ready', '2026-07-21T10:00:00Z', { deepLink: 'kcplite://workspace/ws/approvals/ap-1' }))).toBe('approvals');
  });
});
