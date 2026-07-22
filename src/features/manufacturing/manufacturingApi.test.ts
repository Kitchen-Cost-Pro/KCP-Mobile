import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../core/api/client', () => ({ apiRequest: mocks.apiRequest }));

import {
  loadManufacturingBootstrap,
  loadManufacturingCatalog,
  lookupManufacturedBarcode,
  postManufacturingBatch,
  previewManufacturingBatch,
  searchManufacturedItems,
  previewManufacturingRun,
  postManufacturingRun
} from './manufacturingApi';

describe('manufacturingApi', () => {
  beforeEach(() => mocks.apiRequest.mockReset());

  it('uses only versioned manufacturing-permission-scoped endpoints', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, items: [] });
    await loadManufacturingBootstrap('workspace one');
    await searchManufacturedItems('workspace one', 'sauce', 'loc-1');
    await lookupManufacturedBarcode('workspace one', '600 123', 'loc-1');

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/workspace%20one/manufacturing/bootstrap');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/workspace%20one/manufacturing/items', { query: { search: 'sauce', locationId: 'loc-1' } });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, 'api/mobile/v1/workspaces/workspace%20one/manufacturing/barcodes/600%20123', { query: { locationId: 'loc-1' } });
  });

  it('loads the complete catalogue and uses grouped run endpoints', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, items: [] });
    await loadManufacturingCatalog('ws-1', 'loc-1');
    const entries = [{ manufacturedItemId: 'mfg-1', batchCount: 2, actualQuantity: 19 }];
    await previewManufacturingRun('ws-1', 'loc-1', entries);
    const payload = { idempotencyKey: 'run-1', locationId: 'loc-1', entries, previewToken: 'token-1', occurredAt: '2026-07-20T08:00:00Z', confirm: true as const };
    await postManufacturingRun('ws-1', payload);
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/ws-1/manufacturing/catalog', { query: { locationId: 'loc-1' } });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/ws-1/manufacturing/runs/preview', { method: 'POST', payload: { locationId: 'loc-1', entries } });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, 'api/mobile/v1/workspaces/ws-1/manufacturing/runs/commit', { method: 'POST', payload });
  });

  it('requests an authoritative preview without sending component quantities', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const payload = { manufacturedItemId: 'mfg-1', locationId: 'loc-1', batchCount: 2, actualQuantity: 19 };
    await previewManufacturingBatch('ws-1', payload);
    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws-1/manufacturing/preview', { method: 'POST', payload });
  });

  it('posts the stable batch ID, preview token and explicit confirmation', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const payload = {
      idempotencyKey: 'mfg-stable-1', manufacturedItemId: 'mfg-1', locationId: 'loc-1', batchCount: 2,
      actualQuantity: 19, previewToken: 'server-preview-1', note: 'Morning prep', occurredAt: '2026-07-20T08:00:00.000Z', confirm: true as const
    };
    await postManufacturingBatch('ws-1', payload);
    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws-1/manufacturing/batches', { method: 'POST', payload });
  });
});
