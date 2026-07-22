import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../core/api/client', () => ({ apiRequest: mocks.apiRequest }));

import {
  commitReceiving, loadReceivingBootstrap, loadReceivingOrder, lookupReceivingBarcode, previewReceiving
} from './receivingApi';

describe('receivingApi', () => {
  beforeEach(() => mocks.apiRequest.mockReset());

  it('uses versioned permission-scoped receiving routes', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, order: { id: 'po-1' } });
    await loadReceivingBootstrap('workspace one');
    await loadReceivingOrder('workspace one', 'po / 1');
    await lookupReceivingBarcode('workspace one', 'po / 1', '600 123');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/workspace%20one/receiving/bootstrap');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/workspace%20one/receiving/orders/po%20%2F%201');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, 'api/mobile/v1/workspaces/workspace%20one/receiving/orders/po%20%2F%201/barcodes/600%20123');
  });

  it('previews then commits with a stable receipt ID and explicit confirmation', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const delivery = {
      purchaseOrderId: 'po-1', invoiceNumber: 'INV-7', deliveryNote: 'DN-7', receivedAt: '2026-07-20', note: '',
      evidence: { clientId: 'photo-1', fileName: 'delivery.jpg', mimeType: 'image/jpeg', dataUrl: 'data:image/jpeg;base64,YQ==' },
      entries: [{ lineId: 'line-1', receivedQuantity: 4, note: '' }]
    };
    await previewReceiving('ws-1', delivery);
    const commit = { ...delivery, idempotencyKey: 'grv-stable-1', previewToken: 'preview-1', confirm: true as const };
    await commitReceiving('ws-1', commit);
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/ws-1/receiving/preview', { method: 'POST', payload: delivery });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/ws-1/receiving/commit', { method: 'POST', payload: commit });
  });
});
