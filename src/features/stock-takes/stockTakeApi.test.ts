import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  workspaceRequest: vi.fn()
}));

vi.mock('../../core/api/client', () => ({
  apiRequest: mocks.apiRequest,
  workspaceRequest: mocks.workspaceRequest
}));

import {
  commitStockCount,
  createStockCount,
  listStockCountDrafts,
  listStockCountTemplates,
  loadStockCountPackage,
  reconcileStockCount,
  saveStockCount
} from './stockTakeApi';

describe('stockTakeApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.workspaceRequest.mockReset();
  });

  it('uses the versioned permission-scoped mobile count endpoints', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({ ok: true, templates: [{ id: 'tpl-1' }] })
      .mockResolvedValueOnce({ template: { id: 'tpl-1' }, items: [] });

    await listStockCountTemplates('workspace one');
    await loadStockCountPackage('workspace one', 'tpl-1', 'loc-1');

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      'api/mobile/v1/workspaces/workspace%20one/counts/bootstrap'
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      'api/mobile/v1/workspaces/workspace%20one/counts/bootstrap',
      { query: { templateId: 'tpl-1', locationId: 'loc-1' } }
    );
  });

  it('preserves revision and confirmation controls through save, reconcile and commit', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const payload = {
      templateId: 'tpl-1',
      templateVersion: 'v1',
      locationId: 'loc-1',
      lines: [{ stockItemId: 'item-1', baseQuantity: 0, uoms: [], counted: true }],
      expectedRevision: 4
    };

    await createStockCount('ws-1', payload);
    await saveStockCount('ws-1', 'draft-1', payload);
    await reconcileStockCount('ws-1', 'draft-1');
    await commitStockCount('ws-1', 'draft-1', 'reconcile-1');

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/ws-1/counts/draft-1', {
      method: 'PATCH',
      payload
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(4, 'api/mobile/v1/workspaces/ws-1/counts/draft-1/commit', {
      method: 'POST',
      payload: { reconciliationVersion: 'reconcile-1', idempotencyKey: 'draft-1', confirm: true }
    });
  });

  it('keeps only active drafts returned by the authenticated workspace route', async () => {
    mocks.workspaceRequest.mockResolvedValue({
      drafts: [
        { id: 'active', status: 'server_draft' },
        { id: 'posted', status: 'committed' }
      ]
    });

    const drafts = await listStockCountDrafts('ws-1');

    expect(drafts.map((draft) => draft.id)).toEqual(['active']);
    expect(mocks.workspaceRequest).toHaveBeenCalledWith('ws-1', 'stock-take-drafts');
  });
});
