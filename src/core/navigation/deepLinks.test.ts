import { describe, expect, it } from 'vitest';
import { deepLinkFor, parseDeepLink } from './deepLinks';

describe('Phase 16 deep links', () => {
  it.each([
    ['tasks', 'task-1'],
    ['approvals', 'approval-1'],
    ['transfers', 'transfer-1'],
    ['purchase-orders', 'po-1'],
    ['low-stock', 'location-1']
  ] as const)('round-trips %s links', (route, recordId) => {
    const intent = { workspaceId: 'workspace a', route, recordId };
    expect(parseDeepLink(deepLinkFor(intent))).toEqual(intent);
  });

  it('rejects links without a workspace and record', () => {
    expect(parseDeepLink('kcplite://tasks/1')).toBeNull();
    expect(parseDeepLink('not a url')).toBeNull();
  });

  it('opens KCP Flow Action links through the preserved internal route', () => {
    expect(parseDeepLink('kcplite://workspace/ws-1/actions/action-1')).toEqual({ workspaceId: 'ws-1', route: 'tasks', recordId: 'action-1' });
  });
});
