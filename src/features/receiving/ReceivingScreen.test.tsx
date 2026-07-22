import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(), order: vi.fn(), barcode: vi.fn(), preview: vi.fn(), commit: vi.fn(),
  recoveryGet: vi.fn(), recoverySet: vi.fn(), recoveryClear: vi.fn(), scanner: vi.fn()
}));
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
vi.mock('../wastage/nativeBarcodeScanner', () => ({ scanBarcodeWithDevice: mocks.scanner }));
vi.mock('./receivingApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./receivingApi')>();
  return { ...original, loadReceivingBootstrap: mocks.bootstrap, loadReceivingOrder: mocks.order, lookupReceivingBarcode: mocks.barcode, previewReceiving: mocks.preview, commitReceiving: mocks.commit };
});
vi.mock('./receivingRecoveryStore', () => ({ receivingRecoveryStore: { get: mocks.recoveryGet, set: mocks.recoverySet, clear: mocks.recoveryClear } }));

import { ReceivingScreen } from './ReceivingScreen';

const summary = {
  id: 'po-1', poNumber: 'PO-1001', supplierId: 'supplier-1', supplierName: 'Fresh Foods',
  location: { id: 'loc-1', name: 'Main Store', kind: 'storage' }, status: 'ordered', statusBucket: 'awaiting' as const,
  orderedAt: '2026-07-18T08:00:00Z', expectedAt: '2026-07-20T08:00:00Z', totalEx: 100, totalInc: 115,
  lineCount: 2, outstandingLineCount: 2, receivedLineCount: 0, updatedAt: '2026-07-20T08:00:00Z'
};
const tomato = { id: 'line-1', stockItemId: 'stock-1', name: 'Tomatoes', sku: 'TOM-1', category: 'Produce', baseUom: 'kg', receivingUom: 'case', packSize: 5, unitCost: 20, orderedQuantity: 10, previouslyReceivedQuantity: 0, outstandingQuantity: 10, locationId: 'loc-1', locationName: 'Main Store', barcodes: ['600123'], uoms: [] };
const onion = { id: 'line-2', stockItemId: 'stock-2', name: 'Onions', sku: 'ONI-1', category: 'Produce', baseUom: 'kg', receivingUom: 'bag', packSize: 2, unitCost: 15, orderedQuantity: 8, previouslyReceivedQuantity: 2, outstandingQuantity: 6, locationId: 'loc-1', locationName: 'Main Store', barcodes: [], uoms: [] };
const order = { ...summary, lines: [tomato, onion] };
const preview = {
  ok: true, order: { id: 'po-1', poNumber: 'PO-1001', supplierId: 'supplier-1', supplierName: 'Fresh Foods', location: summary.location, status: 'ordered' },
  entries: [{ ...tomato, receivedQuantity: 4, remainingAfter: 6, varianceQuantity: -6, matchStatus: 'short' as const, note: '', lineTotalEx: 400 }], invoiceNumber: 'INV-9', deliveryNote: '', note: '', receivedAt: '2026-07-20T00:00:00Z', totalEx: 400, totalVat: 60, totalInc: 460, remainingLineCount: 2, completionStatus: 'partially_received', blockingErrors: [], warnings: [], evidence: { fileName: 'delivery.jpg', mimeType: 'image/jpeg', byteSize: 5 }, orderStateToken: 'state-1', previewToken: 'preview-1', previewedAt: '2026-07-20T09:00:00Z'
};

describe('ReceivingScreen Phase 8', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', canReceive: true, orders: [summary], recentReceipts: [] });
    mocks.order.mockResolvedValue(order); mocks.preview.mockResolvedValue(preview);
    mocks.commit.mockResolvedValue({ ok: true, duplicate: false, receiptId: 'grv-1', transactionReference: 'GRV-0001', purchaseOrderId: 'po-1', poNumber: 'PO-1001', supplierName: 'Fresh Foods', locationName: 'Main Store', invoiceNumber: 'INV-9', deliveryNote: '', receivedAt: '2026-07-20T09:01:00Z', lineCount: 1, totalEx: 400, totalVat: 60, totalInc: 460, status: 'partially_received', items: [] });
    mocks.recoveryGet.mockResolvedValue(null); mocks.recoverySet.mockResolvedValue(undefined); mocks.recoveryClear.mockResolvedValue(undefined);
  });

  it('moves a counted delivery line into Entered and posts the server preview', async () => {
    render(<ReceivingScreen workspaceId="ws-1" userId="user-1" />);
    fireEvent.click((await screen.findByText('PO-1001')).closest('button')!);
    expect(await screen.findByText('Tomatoes')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Supplier invoice *'), { target: { value: 'INV-9' } });
    fireEvent.change(screen.getByLabelText('Tomatoes received now'), { target: { value: '4' } });
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Check line/i })[0]);
    expect(screen.queryByText('Tomatoes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Checked 1/i }));
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();
    const photoInput = screen.getByText('Take delivery photo *').closest('label')!.querySelector('input[type="file"]')!;
    fireEvent.change(photoInput, { target: { files: [new File(['photo'], 'delivery.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('Photo attached')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Compare and review GRV/i }));
    expect(await screen.findByText('Confirm delivery')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Post goods receipt/i }));
    expect(await screen.findByText('Delivery received')).toBeInTheDocument();
    expect(screen.getByText('GRV-0001')).toBeInTheDocument();
    expect(mocks.preview).toHaveBeenCalledWith('ws-1', expect.objectContaining({ purchaseOrderId: 'po-1', invoiceNumber: 'INV-9', entries: [{ lineId: 'line-1', receivedQuantity: 4, note: '' }] }));
    expect(mocks.commit).toHaveBeenCalledWith('ws-1', expect.objectContaining({ previewToken: 'preview-1', evidence: expect.objectContaining({ fileName: 'delivery.jpg' }), confirm: true }));
  });

  it('matches a scanned barcode only through the selected purchase order', async () => {
    mocks.scanner.mockResolvedValue('600123'); mocks.barcode.mockResolvedValue({ ok: true, matched: true, barcode: '600123', line: tomato });
    render(<ReceivingScreen workspaceId="ws-1" userId="user-1" />);
    fireEvent.click((await screen.findByText('PO-1001')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: /Open barcode scanner/i }));
    expect(await screen.findByText('Tomatoes found on PO-1001.')).toBeInTheDocument();
    expect(mocks.barcode).toHaveBeenCalledWith('ws-1', 'po-1', '600123');
  });

  it('restores a saved receipt without posting while offline storage remains local', async () => {
    mocks.recoveryGet.mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', draft: { clientReceiptId: 'saved-grv', purchaseOrderId: 'po-1', invoiceNumber: 'INV-SAVED', deliveryNote: '', receivedAt: '2026-07-20', note: '', entries: { 'line-1': { receivedQuantity: '3', note: '', entered: true } } }, order, updatedAt: '2026-07-20T08:30:00Z' });
    render(<ReceivingScreen workspaceId="ws-1" userId="user-1" />);
    expect(await screen.findByText('Your unfinished goods receipt is ready to continue.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue PO-1001/i }));
    fireEvent.click(screen.getByRole('button', { name: /Checked 1/i }));
    expect(screen.getByLabelText('Supplier invoice *')).toHaveValue('INV-SAVED');
    const restoredLine = await screen.findByText('Tomatoes');
    expect(restoredLine.closest('article')?.querySelector('input[type="number"]')).toHaveValue(3);
    await waitFor(() => expect(mocks.recoverySet).toHaveBeenCalled());
  });
});
