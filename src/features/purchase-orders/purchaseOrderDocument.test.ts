import { describe, expect, it } from 'vitest';
import { buildPurchaseOrderPdf } from './purchaseOrderDocument';
import type { PurchaseOrderSummary } from './purchaseOrderApi';

const order: PurchaseOrderSummary = {
  id: 'po-1', clientOrderId: 'client-1', poNumber: 'PO-1001', supplierId: 'sup-1', supplierName: 'Fresh Foods', supplierEmail: 'orders@fresh.test', supplierPhone: '',
  location: { id: 'loc-1', name: 'Main Store', kind: 'storage' }, status: 'sent', statusBucket: 'sent', orderedAt: '2026-07-20', expectedAt: '2026-07-24', note: 'Morning delivery',
  totalEx: 300, totalVat: 45, totalInc: 345, lineCount: 1, receivedLineCount: 0, remainingLineCount: 1, receivingProgress: 0,
  items: [{ id: 'line-1', stockItemId: 'stock-1', name: 'Tomatoes', sku: 'TOM-1', category: 'Produce', quantity: 3, orderedQuantity: 3, receivedQuantity: 0, remainingQuantity: 3, lineStatus: 'awaiting', purchaseUom: 'case', baseUom: 'kg', packSize: 5, unitCost: 20, lineTotalEx: 300, note: '' }],
  createdBy: 'user-1', editable: false, createdAt: '2026-07-20T08:00:00Z', submittedAt: '2026-07-20T08:05:00Z', partiallyReceivedAt: '', receivedAt: '', updatedAt: '2026-07-20T08:05:00Z'
};

describe('purchase-order document', () => {
  it('creates a real PDF from authoritative order detail', async () => {
    const pdf = await buildPurchaseOrderPdf(order, 'Test Kitchen');
    expect(pdf.type).toBe('application/pdf');
    expect(pdf.size).toBeGreaterThan(1000);
  });
});
