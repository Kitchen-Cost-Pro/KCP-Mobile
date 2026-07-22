import { apiRequest } from '../../core/api/client';
import type { ApprovalPending } from '../approvals/approvalSubmission';

export type ManufacturingLocation = {
  id: string;
  name: string;
  kind: string;
  isDefault: boolean;
};

export type ManufacturingUom = {
  id: string;
  name: string;
  quantityInBase: number;
  isBase: boolean;
  barcode?: string | null;
};

export type ManufacturedItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  baseUom: string;
  batchYield: number;
  uoms: ManufacturingUom[];
  barcodes: string[];
};

export type ManufacturingCatalogItem = ManufacturedItem & {
  hasBlueprint: boolean;
  blueprintIssue: string | null;
};

export type ManufacturingHistoryItem = {
  id: string;
  transactionReference: string;
  itemId: string;
  itemName: string;
  locationId: string;
  locationName: string;
  expectedQuantity: number;
  actualQuantity: number;
  wastageQuantity: number;
  unit: string;
  note: string;
  postedAt: string;
  createdByName: string;
};

export type ManufacturingBootstrap = {
  ok: boolean;
  workspaceId: string;
  locations: ManufacturingLocation[];
  canCreateBatch: boolean;
  recentBatches: ManufacturingHistoryItem[];
};

export type ManufacturingComponentPreview = {
  stockItemId: string;
  name: string;
  unit: string;
  requiredQuantity: number;
  onHand: number;
  remainingQuantity: number;
  available: boolean;
};

export type ManufacturingPreview = {
  ok: boolean;
  item: ManufacturedItem;
  location: Pick<ManufacturingLocation, 'id' | 'name' | 'kind'>;
  batchCount: number;
  expectedQuantity: number;
  actualQuantity: number;
  yieldVariance: number;
  wastageQuantity: number;
  components: ManufacturingComponentPreview[];
  blockingErrors: string[];
  previewToken: string;
  previewedAt: string;
};

export type ManufacturingResult = {
  ok: boolean;
  duplicate: boolean;
  batchId: string;
  transactionReference: string;
  itemName: string;
  locationName: string;
  expectedQuantity: number;
  actualQuantity: number;
  wastageQuantity: number;
  unit: string;
  componentCount: number;
  postedAt: string;
};

export type ManufacturingDraft = {
  clientBatchId: string;
  locationId: string;
  item: ManufacturedItem | null;
  batchCount: string;
  actualQuantity: string;
  note: string;
  occurredAt: string;
};

export type ManufacturingRunEntry = {
  manufacturedItemId: string;
  batchCount: number;
  actualQuantity: number;
  note?: string;
};

export type ManufacturingRunPreview = {
  ok: boolean;
  location: Pick<ManufacturingLocation, 'id' | 'name' | 'kind'>;
  products: Array<{
    item: ManufacturedItem;
    batchCount: number;
    expectedQuantity: number;
    actualQuantity: number;
    yieldVariance: number;
    wastageQuantity: number;
  }>;
  components: ManufacturingComponentPreview[];
  blockingErrors: string[];
  previewToken: string;
  previewedAt: string;
};

export type ManufacturingRunResult = {
  ok: boolean;
  runId: string;
  duplicate: boolean;
  location: Pick<ManufacturingLocation, 'id' | 'name' | 'kind'>;
  productCount: number;
  componentCount: number;
  batches: ManufacturingResult[];
  postedAt: string;
};

export type ManufacturingRunDraft = {
  clientRunId: string;
  locationId: string;
  entries: Record<string, { batchCount: string; actualQuantity: string; note: string; entered: boolean }>;
  occurredAt: string;
};

function mobilePath(workspaceId: string, suffix: string) {
  return `api/mobile/v1/workspaces/${encodeURIComponent(String(workspaceId || '').trim())}/${suffix}`;
}

export function loadManufacturingBootstrap(workspaceId: string) {
  return apiRequest<ManufacturingBootstrap>(mobilePath(workspaceId, 'manufacturing/bootstrap'));
}

export function loadManufacturingCatalog(workspaceId: string, locationId: string) {
  return apiRequest<{ ok: boolean; items: ManufacturingCatalogItem[] }>(mobilePath(workspaceId, 'manufacturing/catalog'), {
    query: { locationId }
  }).then((result) => Array.isArray(result.items) ? result.items : []);
}

export function previewManufacturingRun(workspaceId: string, locationId: string, entries: ManufacturingRunEntry[]) {
  return apiRequest<ManufacturingRunPreview>(mobilePath(workspaceId, 'manufacturing/runs/preview'), {
    method: 'POST', payload: { locationId, entries }
  });
}

export function postManufacturingRun(workspaceId: string, payload: {
  idempotencyKey: string;
  locationId: string;
  entries: ManufacturingRunEntry[];
  previewToken: string;
  occurredAt: string;
  confirm: true;
}) {
  return apiRequest<ManufacturingRunResult | ApprovalPending>(mobilePath(workspaceId, 'manufacturing/runs/commit'), { method: 'POST', payload });
}

export function searchManufacturedItems(workspaceId: string, search: string, locationId: string) {
  return apiRequest<{ ok: boolean; items: ManufacturedItem[] }>(mobilePath(workspaceId, 'manufacturing/items'), {
    query: { search, locationId }
  }).then((result) => Array.isArray(result.items) ? result.items : []);
}

export function lookupManufacturedBarcode(workspaceId: string, barcode: string, locationId: string) {
  return apiRequest<{ ok: boolean; matched: boolean; reason?: 'not_found' | 'ambiguous'; barcode: string; item?: ManufacturedItem; candidates?: Array<{ id: string; name: string }> }>(
    mobilePath(workspaceId, `manufacturing/barcodes/${encodeURIComponent(String(barcode || '').trim())}`),
    { query: { locationId } }
  );
}

export function previewManufacturingBatch(workspaceId: string, payload: {
  manufacturedItemId: string;
  locationId: string;
  batchCount: number;
  actualQuantity: number;
}) {
  return apiRequest<ManufacturingPreview>(mobilePath(workspaceId, 'manufacturing/preview'), { method: 'POST', payload });
}

export function postManufacturingBatch(workspaceId: string, payload: {
  idempotencyKey: string;
  manufacturedItemId: string;
  locationId: string;
  batchCount: number;
  actualQuantity: number;
  previewToken: string;
  note: string;
  occurredAt: string;
  confirm: true;
}) {
  return apiRequest<ManufacturingResult>(mobilePath(workspaceId, 'manufacturing/batches'), { method: 'POST', payload });
}
