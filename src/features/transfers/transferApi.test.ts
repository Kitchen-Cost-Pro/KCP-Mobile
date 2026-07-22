import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../core/api/client', () => ({ apiRequest: mocks.apiRequest }));

import {
  acceptIncomingTransfer,
  createInternalTransfer,
  loadTransferBootstrap,
  loadTransferBuckets,
  rejectIncomingTransfer,
  searchTransferItems
} from './transferApi';

describe('transferApi', () => {
  beforeEach(() => mocks.apiRequest.mockReset());

  it('uses only versioned, transfer-permission-scoped mobile endpoints', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, items: [] });
    await loadTransferBootstrap('workspace one');
    await loadTransferBuckets('workspace one');
    await searchTransferItems('workspace one', 'bun', 'loc-1');

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/workspace%20one/transfers/bootstrap');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/workspace%20one/transfers');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, 'api/mobile/v1/workspaces/workspace%20one/transfers/items', {
      query: { search: 'bun', sourceLocationId: 'loc-1' }
    });
  });

  it('preserves the stable idempotency key for internal transfer creation', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const payload = {
      idempotencyKey: 'transfer-stable-1',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      note: 'Move stock',
      occurredAt: '2026-07-20T12:00:00.000Z',
      lines: [{ stockItemId: 'item-1', quantity: 2, uom: 'Crate' }]
    };
    await createInternalTransfer('ws-1', payload);
    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws-1/transfers', { method: 'POST', payload });
  });

  it('requires explicit server confirmations for both incoming decisions', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    await acceptIncomingTransfer('ws-1', 'transfer/1', [{ stockItemId: 'item-1', receivedQty: 4 }]);
    await rejectIncomingTransfer('ws-1', 'transfer/1', 'Damaged in transit');

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/ws-1/transfers/transfer%2F1/accept', {
      method: 'POST', payload: { confirm: true, lines: [{ stockItemId: 'item-1', receivedQty: 4 }] }
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/ws-1/transfers/transfer%2F1/reject', {
      method: 'POST', payload: { confirm: true, reason: 'Damaged in transit' }
    });
  });
});
