import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../../core/api/client', () => ({ apiRequest: mocks.apiRequest }));
import { deletePurchaseOrderDraft, loadPurchaseOrder, loadPurchaseOrderBootstrap, loadPurchaseOrderCatalog, previewPurchaseOrder, savePurchaseOrderDraft, submitPurchaseOrder } from './purchaseOrderApi';

describe('purchaseOrderApi', () => {
  beforeEach(() => mocks.apiRequest.mockReset());
  it('uses versioned permission-scoped purchase-order routes', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true, items: [] });
    await loadPurchaseOrderBootstrap('workspace one');
    await loadPurchaseOrderCatalog('workspace one', 'supplier / 1', 'main store');
    await loadPurchaseOrder('workspace one', 'po / 1');
    await deletePurchaseOrderDraft('workspace one', 'po / 1');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/workspace%20one/purchase-orders/bootstrap');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/workspace%20one/purchase-orders/catalog?supplierId=supplier%20%2F%201&locationId=main%20store');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, 'api/mobile/v1/workspaces/workspace%20one/purchase-orders/po%20%2F%201');
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(4, 'api/mobile/v1/workspaces/workspace%20one/purchase-orders/po%20%2F%201', { method: 'DELETE' });
  });
  it('previews, saves a draft and submits with explicit confirmation', async () => {
    mocks.apiRequest.mockResolvedValue({ ok: true });
    const order = { clientOrderId: 'po-stable-1', supplierId: 's-1', locationId: 'l-1', expectedAt: '2026-07-24', note: '', entries: [{ stockItemId: 'i-1', quantity: 3, note: '' }] };
    await previewPurchaseOrder('ws-1', order); await savePurchaseOrderDraft('ws-1', order);
    await submitPurchaseOrder('ws-1', { ...order, previewToken: 'preview-1', confirm: true });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, 'api/mobile/v1/workspaces/ws-1/purchase-orders/preview', { method: 'POST', payload: order });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, 'api/mobile/v1/workspaces/ws-1/purchase-orders/drafts', { method: 'POST', payload: order });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, 'api/mobile/v1/workspaces/ws-1/purchase-orders/submit', { method: 'POST', payload: { ...order, previewToken: 'preview-1', confirm: true } });
  });
});
