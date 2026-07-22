import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ bootstrap: vi.fn(), catalog: vi.fn(), detail: vi.fn(), preview: vi.fn(), save: vi.fn(), submit: vi.fn(), remove: vi.fn(), sharePdf: vi.fn(), email: vi.fn(), recoveryGet: vi.fn(), recoverySet: vi.fn(), recoveryClear: vi.fn() }));
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
vi.mock('./purchaseOrderApi', async (importOriginal) => { const original = await importOriginal<typeof import('./purchaseOrderApi')>(); return { ...original, loadPurchaseOrderBootstrap: mocks.bootstrap, loadPurchaseOrderCatalog: mocks.catalog, loadPurchaseOrder: mocks.detail, previewPurchaseOrder: mocks.preview, savePurchaseOrderDraft: mocks.save, submitPurchaseOrder: mocks.submit, deletePurchaseOrderDraft: mocks.remove }; });
vi.mock('./purchaseOrderDocument', () => ({ sharePurchaseOrderPdf: mocks.sharePdf, emailPurchaseOrder: mocks.email }));
vi.mock('./purchaseOrderRecoveryStore', () => ({ purchaseOrderRecoveryStore: { get: mocks.recoveryGet, set: mocks.recoverySet, clear: mocks.recoveryClear } }));
import { PurchaseOrdersScreen } from './PurchaseOrdersScreen';

const item = { id: 'stock-1', name: 'Tomatoes', sku: 'TOM-1', category: 'Produce', baseUom: 'kg', purchaseUom: 'case', packSize: 5, unitCost: 20, uoms: [] };
const preview = { ok: true, clientOrderId: 'po-1', supplier: { id: 'sup-1', name: 'Fresh Foods', email: '', phone: '', category: 'Produce' }, location: { id: 'loc-1', name: 'Main Store', kind: 'storage' }, expectedAt: '2026-07-24', note: '', lines: [{ ...item, quantity: 3, note: '', lineTotalEx: 300 }], totalEx: 300, totalVat: 45, totalInc: 345, warnings: [], blockingErrors: [], previewToken: 'preview-1', payloadFingerprint: 'fingerprint-1', previewedAt: '2026-07-20T10:00:00Z' };
const sentOrder = { id: 'po-kcp-1', clientOrderId: 'po-1', poNumber: 'PO-1001', supplierId: 'sup-1', supplierName: 'Fresh Foods', supplierEmail: 'orders@fresh.test', supplierPhone: '0110000000', location: preview.location, status: 'sent', statusBucket: 'sent' as const, orderedAt: '2026-07-20', expectedAt: '2026-07-24', note: 'Morning delivery', totalEx: 300, totalVat: 45, totalInc: 345, lineCount: 1, receivedLineCount: 0, remainingLineCount: 1, receivingProgress: 0, items: [{ ...item, quantity: 3, orderedQuantity: 3, receivedQuantity: 0, remainingQuantity: 3, lineStatus: 'awaiting' as const, note: '', lineTotalEx: 300 }], createdBy: 'user-1', editable: false, createdAt: '2026-07-20T08:00:00Z', submittedAt: '2026-07-20T08:05:00Z', partiallyReceivedAt: '', receivedAt: '', updatedAt: '2026-07-20T08:05:00Z', timeline: [{ type: 'purchase_order_saved', actorUid: 'user-1', occurredAt: '2026-07-20T08:05:00Z' }] };

describe('PurchaseOrdersScreen Phase 10', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', suppliers: [{ id: 'sup-1', name: 'Fresh Foods', email: 'orders@fresh.test', phone: '', category: 'Produce' }], locations: [{ id: 'loc-1', name: 'Main Store', kind: 'storage' }], orders: [] });
    mocks.catalog.mockResolvedValue([item]); mocks.preview.mockResolvedValue(preview);
    mocks.detail.mockResolvedValue(sentOrder); mocks.submit.mockResolvedValue({ ok: true, duplicate: false, order: sentOrder }); mocks.remove.mockResolvedValue({ ok: true, id: 'po-kcp-1' }); mocks.sharePdf.mockResolvedValue(undefined);
    mocks.recoveryGet.mockResolvedValue(null); mocks.recoverySet.mockResolvedValue(undefined); mocks.recoveryClear.mockResolvedValue(undefined);
  });
  it('uses selection sheets, moves entered items into a separate bucket and submits the preview', async () => {
    render(<PurchaseOrdersScreen workspaceId="ws-1" userId="user-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /New purchase order/i }));
    fireEvent.click(screen.getByRole('button', { name: /Choose supplier/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Fresh Foods/i }));
    fireEvent.click(screen.getByRole('button', { name: /Choose location/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Select Main Store/i }));
    fireEvent.click(screen.getByRole('button', { name: /Load order items/i }));
    expect(await screen.findByText('Tomatoes')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tomatoes quantity'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Done & move to Entered/i }));
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Entered 1/i }));
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review order/i }));
    expect(await screen.findByText('Confirm order')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Submit purchase order/i }));
    expect(await screen.findByText('Order ready')).toBeInTheDocument();
    expect(screen.getByText('PO-1001')).toBeInTheDocument();
    expect(mocks.preview).toHaveBeenCalledWith('ws-1', expect.objectContaining({ supplierId: 'sup-1', locationId: 'loc-1', entries: [{ stockItemId: 'stock-1', quantity: 3, note: '' }] }));
    expect(mocks.submit).toHaveBeenCalledWith('ws-1', expect.objectContaining({ previewToken: 'preview-1', confirm: true }));
  });
  it('persists an unfinished order only in scoped secure recovery', async () => {
    render(<PurchaseOrdersScreen workspaceId="ws-1" userId="user-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /New purchase order/i }));
    fireEvent.click(screen.getByRole('button', { name: /Choose supplier/i })); fireEvent.click(await screen.findByRole('button', { name: /Fresh Foods/i }));
    await waitFor(() => expect(mocks.recoverySet).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-1' })));
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it('keeps Phase 13 low-stock selections while the supplier is chosen afterwards', async () => {
    const consumed = vi.fn();
    render(<PurchaseOrdersScreen workspaceId="ws-1" userId="user-1" preload={{ requestId: 'low-1', locationId: 'loc-1', locationName: 'Main Store', items: [{ stockItemId: 'stock-1', name: 'Tomatoes', suggestedOrderQuantity: 2 }] }} onPreloadConsumed={consumed} />);
    expect(await screen.findByText('1 low-stock item ready')).toBeInTheDocument();
    expect(screen.getByText(/Choose a supplier to continue/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Choose supplier/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Fresh Foods/i }));
    fireEvent.click(screen.getByRole('button', { name: /Load order items/i }));
    expect(await screen.findByText('Tomatoes')).toBeInTheDocument();
    expect(screen.getByLabelText('Tomatoes quantity')).toHaveValue(2);
    expect(screen.getByLabelText('Tomatoes line note')).toHaveValue('Suggested from low-stock intelligence');
    expect(consumed).toHaveBeenCalled();
    expect(mocks.catalog).toHaveBeenCalledWith('ws-1', 'sup-1', 'loc-1');
  });
  it('opens submitted order detail and exposes PDF and supplier email actions', async () => {
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', suppliers: [], locations: [], orders: [sentOrder] });
    render(<PurchaseOrdersScreen workspaceId="ws-1" userId="user-1" workspaceName="Test Kitchen" />);
    fireEvent.click(await screen.findByRole('button', { name: /Sent 1/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Open PO-1001/i }));
    expect(await screen.findByText('Order timeline')).toBeInTheDocument();
    expect(screen.getByText('Morning delivery')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Share PDF/i }));
    fireEvent.click(screen.getByRole('button', { name: /Email supplier/i }));
    await waitFor(() => expect(mocks.sharePdf).toHaveBeenCalledWith(sentOrder, 'Test Kitchen'));
    expect(mocks.email).toHaveBeenCalledWith(sentOrder);
  });
  it('allows only an editable mobile draft to be discarded', async () => {
    const draftOrder = { ...sentOrder, status: 'draft', statusBucket: 'drafts' as const, editable: true, submittedAt: '' };
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', suppliers: [], locations: [], orders: [draftOrder] }); mocks.detail.mockResolvedValue(draftOrder);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PurchaseOrdersScreen workspaceId="ws-1" userId="user-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Open PO-1001/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Discard draft/i }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('ws-1', 'po-kcp-1'));
  });
});
