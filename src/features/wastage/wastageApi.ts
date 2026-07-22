import { apiRequest, workspaceRequest } from '../../core/api/client';
import { normalizeKcpBarcode } from '../../core/barcodes/normalizeBarcode';
import type { ApprovalPending } from '../approvals/approvalSubmission';

export type WastageLocation = {
  id: string;
  name: string;
  kind?: string;
};

export type WastageItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  baseUom: string;
  trackInventory: boolean;
};

export type WastageUom = {
  id: string;
  name: string;
  quantityInBase: number;
  isBase: boolean;
  barcode?: string | null;
};

export type BarcodeLookupResult = {
  barcode: string;
  matched: boolean;
  reason?: 'not_found' | 'ambiguous';
  candidates?: Array<{ id: string; name: string }>;
  item?: WastageItem;
  barcodeMatch?: {
    type: 'BASE_UOM' | 'CUSTOM_UOM';
    uomId: string | null;
    uomName: string;
    quantityInBase: number;
  };
  location?: WastageLocation;
};

export type WastageSearchItem = WastageItem & {
  uoms: WastageUom[];
  onHand: number;
};

export type WastagePayload = {
  idempotencyKey: string;
  stockItemId: string;
  locationId: string;
  quantity: number;
  uom: string;
  wasteReason: string;
  note?: string;
  occurredAt: string;
};

export type WastageResult = {
  ok: boolean;
  duplicate: boolean;
  transactionId: string;
  stockItemId: string;
  stockItemName: string;
  locationId: string;
  originalQuantity: number;
  originalUom: string;
  baseUom: string;
  baseQuantity: number;
  ratioUsed: number;
  unitCost: number;
  wastageValue: number;
  currency: string;
  wasteReason: string;
  occurredAt: string;
  recordedAt: string;
};

function mobilePath(workspaceId: string, suffix: string) {
  return `api/mobile/v1/workspaces/${encodeURIComponent(String(workspaceId || '').trim())}/${suffix}`;
}

export function lookupBarcode(workspaceId: string, barcode: string, locationId?: string) {
  const normalizedBarcode = normalizeKcpBarcode(barcode);
  return apiRequest<BarcodeLookupResult>(
    mobilePath(workspaceId, `barcodes/${encodeURIComponent(normalizedBarcode)}`),
    { query: { locationId } }
  );
}

type RawStockItem = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  unit?: unknown;
  is_stocked?: unknown;
  on_hand?: unknown;
  raw_json?: unknown;
};

export async function searchWastageItems(workspaceId: string, search: string, locationId?: string) {
  const response = await workspaceRequest<{ stockItems?: RawStockItem[] }>(workspaceId, 'stock-items', {
    query: { search, locationId, limit: 30 }
  });
  return (Array.isArray(response.stockItems) ? response.stockItems : [])
    .map(normalizeSearchItem)
    .filter((item): item is WastageSearchItem => Boolean(item?.id && item.trackInventory));
}

export function postWastage(workspaceId: string, payload: WastagePayload) {
  return apiRequest<WastageResult | ApprovalPending>(mobilePath(workspaceId, 'wastage'), {
    method: 'POST',
    payload
  });
}

function normalizeSearchItem(source: RawStockItem): WastageSearchItem | null {
  const id = text(source.id);
  if (!id) return null;
  const raw = parseRecord(source.raw_json);
  const baseUom = text(source.unit) || 'ea';
  const customUoms = Array.isArray(raw.uomConfigurations) ? raw.uomConfigurations : [];
  const uoms: WastageUom[] = [{ id: `${id}:base`, name: baseUom, quantityInBase: 1, isBase: true }];
  customUoms.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const record = entry as Record<string, unknown>;
    const name = text(record.customUom || record.custom_uom || record.customUnit || record.orderingUom || record.name);
    const ratio = number(record.ratio ?? record.conversionRatio ?? record.unitsPerCustomUnit ?? record.units_per_custom_unit ?? record.quantityInBase);
    if (!name || ratio <= 0 || name.toLowerCase() === baseUom.toLowerCase()) return;
    uoms.push({
      id: `${id}:${text(record.id) || index}`,
      name,
      quantityInBase: ratio,
      isBase: false,
      barcode: text(record.barcode || record.customBarcode || record.customUomBarcode) || null
    });
  });
  return {
    id,
    name: text(source.name) || 'Stock item',
    sku: text(raw.sku || raw.customSku || raw.stockCode || raw.itemCode) || null,
    category: text(source.category),
    baseUom,
    trackInventory: Number(source.is_stocked ?? 1) !== 0,
    uoms,
    onHand: number(source.on_hand)
  };
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
