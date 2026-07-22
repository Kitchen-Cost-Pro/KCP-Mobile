import { apiRequest } from '../../core/api/client';

export type LowStockUom = {
  id: string;
  name: string;
  quantityInBase: number;
  isBase: boolean;
  barcode?: string | null;
};

export type LowStockItem = {
  id: string;
  name: string;
  sku: string | null;
  category: string;
  baseUom: string;
  purchaseUom: string;
  packSize: number;
  barcodes: string[];
  uoms: LowStockUom[];
  currentQuantity: number;
  threshold: number;
  parLevel: number;
  shortageQuantity: number;
  suggestedOrderQuantity: number;
  status: 'out_of_stock' | 'below_par';
};

export type LowStockResponse = {
  ok: boolean;
  generatedAt: string;
  workspaceId: string;
  location: { id: string; name: string };
  canCreatePurchaseOrder: boolean;
  counts: { total: number; outOfStock: number; belowPar: number };
  items: LowStockItem[];
};

export function loadLowStock(workspaceId: string, locationId: string, signal?: AbortSignal) {
  const id = String(workspaceId || '').trim();
  const location = String(locationId || '').trim();
  if (!id) return Promise.reject(new Error('Workspace is required.'));
  if (!location) return Promise.reject(new Error('Choose a location before loading low stock.'));
  return apiRequest<LowStockResponse>(`api/mobile/v1/workspaces/${encodeURIComponent(id)}/low-stock`, {
    query: { locationId: location },
    signal
  });
}
