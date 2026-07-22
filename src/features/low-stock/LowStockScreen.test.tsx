import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connected: true, load: vi.fn(), snapshotGet: vi.fn(), snapshotSet: vi.fn() }));
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => mocks.connected }));
vi.mock('./lowStockApi', async (importOriginal) => ({ ...(await importOriginal<typeof import('./lowStockApi')>()), loadLowStock: mocks.load }));
vi.mock('./lowStockSnapshotStore', () => ({ lowStockSnapshotStore: { get: mocks.snapshotGet, set: mocks.snapshotSet } }));
import { LowStockScreen } from './LowStockScreen';

const location = { id: 'loc-1', locationId: 'loc-1', name: 'Main Store', displayName: 'Main Store' };
const response = {
  ok: true, generatedAt: '2026-07-20T10:00:00Z', workspaceId: 'ws-1', location: { id: 'loc-1', name: 'Main Store' }, canCreatePurchaseOrder: true,
  counts: { total: 2, outOfStock: 1, belowPar: 1 },
  items: [
    { id: 'flour', name: 'Flour', sku: 'FL-1', category: 'Dry Goods', baseUom: 'kg', purchaseUom: 'bag', packSize: 10, barcodes: ['600001'], uoms: [{ id: 'flour:base', name: 'kg', quantityInBase: 1, isBase: true }], currentQuantity: 0, threshold: 5, parLevel: 20, shortageQuantity: 20, suggestedOrderQuantity: 2, status: 'out_of_stock' as const },
    { id: 'milk', name: 'Milk', sku: 'ML-1', category: 'Dairy', baseUom: 'l', purchaseUom: 'case', packSize: 6, barcodes: ['600002'], uoms: [{ id: 'milk:base', name: 'l', quantityInBase: 1, isBase: true }], currentQuantity: 3, threshold: 4, parLevel: 12, shortageQuantity: 9, suggestedOrderQuantity: 2, status: 'below_par' as const }
  ]
};

describe('LowStockScreen Phase 13', () => {
  beforeEach(() => {
    mocks.connected = true;
    mocks.load.mockReset().mockResolvedValue(response);
    mocks.snapshotGet.mockReset().mockResolvedValue(null);
    mocks.snapshotSet.mockReset().mockResolvedValue(undefined);
  });

  it('searches all stock identifiers, opens lookup and creates a preloaded PO intent', async () => {
    const onLookup = vi.fn();
    const onCreate = vi.fn();
    render(<LowStockScreen workspaceId="ws-1" userId="user-1" location={location} canCreatePurchaseOrder onLocation={vi.fn()} onLookup={onLookup} onCreatePurchaseOrder={onCreate} />);
    expect(await screen.findByText('Flour')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Item, SKU, barcode or category'), { target: { value: '600001' } });
    expect(screen.getByText('Flour')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open Stock Lookup/i }));
    expect(onLookup).toHaveBeenCalledWith(expect.objectContaining({ id: 'flour', onHand: 0 }));
    fireEvent.click(screen.getByRole('button', { name: /Select Flour/i }));
    fireEvent.click(screen.getByRole('button', { name: /Start purchase order/i }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ locationId: 'loc-1', items: [{ stockItemId: 'flour', name: 'Flour', suggestedOrderQuantity: 2 }] }));
    expect(mocks.snapshotSet).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', userId: 'user-1', locationId: 'loc-1' }));
  });

  it('loads a scoped read-only snapshot while offline and blocks PO creation', async () => {
    mocks.connected = false;
    mocks.snapshotGet.mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', locationId: 'loc-1', response, savedAt: '2026-07-20T09:00:00Z' });
    render(<LowStockScreen workspaceId="ws-1" userId="user-1" location={location} canCreatePurchaseOrder onLocation={vi.fn()} onLookup={vi.fn()} onCreatePurchaseOrder={vi.fn()} />);
    expect(await screen.findByText(/Read-only offline snapshot/i)).toBeInTheDocument();
    expect(screen.getByText('Flour')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Select Flour/i }));
    expect(screen.getByRole('button', { name: /Start purchase order/i })).toBeDisabled();
    await waitFor(() => expect(mocks.load).not.toHaveBeenCalled());
  });

  it('keeps a 5,000-item workspace incrementally renderable without hiding search results', async () => {
    const items = Array.from({ length: 5000 }, (_, index) => ({ ...response.items[0], id: `item-${index}`, name: `Stock item ${index}`, sku: `SKU-${index}` }));
    mocks.load.mockResolvedValue({ ...response, counts: { total: 5000, outOfStock: 5000, belowPar: 0 }, items });
    const { container } = render(<LowStockScreen workspaceId="ws-1" userId="user-1" location={location} canCreatePurchaseOrder onLocation={vi.fn()} onLookup={vi.fn()} onCreatePurchaseOrder={vi.fn()} />);
    expect(await screen.findByText('Stock item 0')).toBeInTheDocument();
    expect(container.querySelectorAll('.low-stock-card')).toHaveLength(100);
    fireEvent.click(screen.getByRole('button', { name: /Show 100 more/i }));
    expect(container.querySelectorAll('.low-stock-card')).toHaveLength(200);
    fireEvent.change(screen.getByPlaceholderText('Item, SKU, barcode or category'), { target: { value: 'SKU-4999' } });
    expect(await screen.findByText('Stock item 4999')).toBeInTheDocument();
  });
});
