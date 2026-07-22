import { apiRequest } from '../../core/api/client';

export type ReceivingLocation = { id: string; name: string; kind: string };

export type ReceivingOrderSummary = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  location: ReceivingLocation;
  status: string;
  statusBucket: 'awaiting' | 'partial';
  orderedAt: string;
  expectedAt: string;
  totalEx: number;
  totalInc: number;
  lineCount: number;
  outstandingLineCount: number;
  receivedLineCount: number;
  updatedAt: string;
};

export type ReceivingOrderLine = {
  id: string;
  stockItemId: string;
  name: string;
  sku: string | null;
  category: string;
  baseUom: string;
  receivingUom: string;
  packSize: number;
  unitCost: number;
  orderedQuantity: number;
  previouslyReceivedQuantity: number;
  outstandingQuantity: number;
  locationId: string;
  locationName: string;
  barcodes: string[];
  uoms: Array<{ name: string; quantityInBase: number; barcode: string | null }>;
};

export type ReceivingOrder = ReceivingOrderSummary & { lines: ReceivingOrderLine[] };

export type ReceivingRecentReceipt = {
  id: string;
  transactionReference: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  locationId: string;
  locationName: string;
  invoiceNumber: string;
  receivedAt: string;
  lineCount: number;
  totalEx: number;
  evidenceCount: number;
};

export type ReceivingBootstrap = {
  ok: boolean;
  workspaceId: string;
  canReceive: boolean;
  orders: ReceivingOrderSummary[];
  recentReceipts: ReceivingRecentReceipt[];
  syncedAt: string;
};

export type ReceivingEntry = { lineId: string; receivedQuantity: number; note?: string };
export type ReceivingEvidence = { clientId: string; fileName: string; mimeType: string; dataUrl: string };

export type ReceivingDraft = {
  clientReceiptId: string;
  purchaseOrderId: string;
  invoiceNumber: string;
  deliveryNote: string;
  receivedAt: string;
  note: string;
  evidence: ReceivingEvidence[];
  entries: Record<string, { receivedQuantity: string; note: string; entered: boolean }>;
};

export type ReceivingPreview = {
  ok: boolean;
  order: Pick<ReceivingOrderSummary, 'id' | 'poNumber' | 'supplierId' | 'supplierName' | 'location' | 'status'>;
  entries: Array<ReceivingOrderLine & { receivedQuantity: number; remainingAfter: number; varianceQuantity: number; matchStatus: 'match' | 'short' | 'over'; note: string; lineTotalEx: number }>;
  invoiceNumber: string;
  deliveryNote: string;
  note: string;
  receivedAt: string;
  totalEx: number;
  totalVat: number;
  totalInc: number;
  remainingLineCount: number;
  completionStatus: string;
  blockingErrors: string[];
  warnings: string[];
  evidence: { fileName: string; mimeType: string; byteSize: number };
  previewToken: string;
  previewedAt: string;
};

export type ReceivingResult = {
  ok: boolean;
  duplicate: boolean;
  receiptId: string;
  transactionReference: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  invoiceNumber: string;
  deliveryNote: string;
  receivedAt: string;
  lineCount: number;
  totalEx: number;
  totalVat: number;
  totalInc: number;
  status: string;
  evidenceCount: number;
  items: Array<{ stockItemId: string; name: string; receivedQuantity: number; unit: string; baseQuantity: number; lineTotalEx: number }>;
};

function mobilePath(workspaceId: string, suffix: string) {
  return `api/mobile/v1/workspaces/${encodeURIComponent(String(workspaceId || '').trim())}/${suffix}`;
}

export function loadReceivingBootstrap(workspaceId: string) {
  return apiRequest<ReceivingBootstrap>(mobilePath(workspaceId, 'receiving/bootstrap'));
}

export function loadReceivingOrder(workspaceId: string, orderId: string) {
  return apiRequest<{ ok: boolean; order: ReceivingOrder }>(mobilePath(workspaceId, `receiving/orders/${encodeURIComponent(orderId)}`))
    .then((result) => result.order);
}

export function lookupReceivingBarcode(workspaceId: string, orderId: string, barcode: string) {
  return apiRequest<{ ok: boolean; matched: boolean; reason?: 'not_on_order' | 'ambiguous'; barcode: string; line?: ReceivingOrderLine; candidates?: Array<{ id: string; name: string }> }>(
    mobilePath(workspaceId, `receiving/orders/${encodeURIComponent(orderId)}/barcodes/${encodeURIComponent(String(barcode || '').trim())}`)
  );
}

// `evidence` remains the primary (first) photo so the existing Worker contract is
// unchanged. `evidencePhotos` is additive: it carries every attached photo so the
// backend can retain the full set for later AI receipt/invoice scanning once the
// Worker is updated to read it.
export function previewReceiving(workspaceId: string, payload: {
  purchaseOrderId: string;
  invoiceNumber: string;
  deliveryNote: string;
  receivedAt: string;
  note: string;
  evidence: ReceivingEvidence | null;
  evidencePhotos?: ReceivingEvidence[];
  entries: ReceivingEntry[];
}) {
  return apiRequest<ReceivingPreview>(mobilePath(workspaceId, 'receiving/preview'), { method: 'POST', payload });
}

export function commitReceiving(workspaceId: string, payload: {
  idempotencyKey: string;
  purchaseOrderId: string;
  invoiceNumber: string;
  deliveryNote: string;
  receivedAt: string;
  note: string;
  evidence: ReceivingEvidence | null;
  evidencePhotos?: ReceivingEvidence[];
  entries: ReceivingEntry[];
  previewToken: string;
  confirm: true;
}) {
  return apiRequest<ReceivingResult>(mobilePath(workspaceId, 'receiving/commit'), { method: 'POST', payload });
}
