import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), workspaceRequest: vi.fn() }));

vi.mock('../../core/api/client', () => ({
  apiRequest: mocks.apiRequest,
  workspaceRequest: mocks.workspaceRequest
}));

import { lookupBarcode, postWastage, searchWastageItems } from './wastageApi';

describe('wastageApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.workspaceRequest.mockReset();
  });

  it('uses the exact versioned barcode resolver with location scope', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, matched: false, barcode: '600 123' });

    await lookupBarcode('workspace one', '600 123', 'loc-1');

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'api/mobile/v1/workspaces/workspace%20one/barcodes/600123',
      { query: { locationId: 'loc-1' } }
    );
  });

  it('uses the same UPC-to-EAN representation as KCP main', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, matched: false, barcode: '0012345678905' });

    await lookupBarcode('ws-1', '012345678905', 'loc-1');

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'api/mobile/v1/workspaces/ws-1/barcodes/0012345678905',
      { query: { locationId: 'loc-1' } }
    );
  });

  it('normalizes permissioned stock search UOMs without trusting them for posting', async () => {
    mocks.workspaceRequest.mockResolvedValue({
      stockItems: [{
        id: 'item-1',
        name: 'Burger Buns',
        category: 'Bakery',
        unit: 'each',
        is_stocked: 1,
        on_hand: 42,
        raw_json: JSON.stringify({
          sku: 'BUN-1',
          uomConfigurations: [{ customUom: 'Crate', ratio: 24, barcode: '600123' }]
        })
      }]
    });

    const items = await searchWastageItems('ws-1', 'bun', 'loc-1');

    expect(mocks.workspaceRequest).toHaveBeenCalledWith('ws-1', 'stock-items', {
      query: { search: 'bun', locationId: 'loc-1', limit: 30 }
    });
    expect(items).toEqual([expect.objectContaining({
      id: 'item-1',
      sku: 'BUN-1',
      onHand: 42,
      uoms: [
        expect.objectContaining({ name: 'each', quantityInBase: 1, isBase: true }),
        expect.objectContaining({ name: 'Crate', quantityInBase: 24, isBase: false })
      ]
    })]);
  });

  it('sends one stable idempotency key to the authoritative wastage adapter', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const payload = {
      idempotencyKey: 'waste-stable-1',
      stockItemId: 'item-1',
      locationId: 'loc-1',
      quantity: 2,
      uom: 'Crate',
      wasteReason: 'Damaged',
      note: 'Wet packaging',
      occurredAt: '2026-07-20T12:00:00.000Z'
    };

    await postWastage('ws-1', payload);

    expect(mocks.apiRequest).toHaveBeenCalledWith('api/mobile/v1/workspaces/ws-1/wastage', {
      method: 'POST',
      payload
    });
  });
});
