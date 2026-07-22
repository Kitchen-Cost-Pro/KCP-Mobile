import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scan: vi.fn(),
  lookup: vi.fn(),
  search: vi.fn(),
  post: vi.fn(),
  recoveryGet: vi.fn(),
  recoverySet: vi.fn(),
  recoveryClear: vi.fn()
}));

vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
vi.mock('./nativeBarcodeScanner', () => ({ scanBarcodeWithDevice: mocks.scan }));
vi.mock('./wastageApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./wastageApi')>();
  return {
    ...original,
    lookupBarcode: mocks.lookup,
    searchWastageItems: mocks.search,
    postWastage: mocks.post
  };
});
vi.mock('./wastageRecoveryStore', () => ({
  wastageRecoveryStore: {
    get: mocks.recoveryGet,
    set: mocks.recoverySet,
    clear: mocks.recoveryClear
  }
}));

import { WastageScreen } from './WastageScreen';

const location = { id: 'loc-1', locationId: 'loc-1', name: 'Main Kitchen', displayName: 'Main Kitchen', active: true };

describe('WastageScreen', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.recoveryGet.mockResolvedValue(null);
    mocks.recoverySet.mockResolvedValue(undefined);
    mocks.recoveryClear.mockResolvedValue(undefined);
    mocks.scan.mockResolvedValue('600123');
    mocks.lookup.mockResolvedValue({
      ok: true,
      matched: true,
      barcode: '600123',
      location: { id: 'loc-1', name: 'Main Kitchen' },
      item: { id: 'item-1', name: 'Burger Buns', sku: 'BUN-1', category: 'Bakery', baseUom: 'each', trackInventory: true },
      barcodeMatch: { type: 'CUSTOM_UOM', uomId: 'item-1:Crate', uomName: 'Crate', quantityInBase: 24 }
    });
    mocks.post.mockResolvedValue({
      ok: true,
      duplicate: false,
      transactionId: 'ADJ-20260720-0001',
      stockItemId: 'item-1',
      stockItemName: 'Burger Buns',
      locationId: 'loc-1',
      originalQuantity: 2,
      originalUom: 'Crate',
      baseUom: 'each',
      baseQuantity: 48,
      ratioUsed: 24,
      unitCost: 3,
      wastageValue: 144,
      currency: 'ZAR',
      wasteReason: 'Damaged',
      occurredAt: '2026-07-20T12:00:00.000Z',
      recordedAt: '2026-07-20T12:00:01.000Z'
    });
  });

  it('scans, reviews and submits one server-authoritative wastage movement', async () => {
    render(<WastageScreen workspaceId="ws-1" userId="user-1" location={location} canSearchItems onLocation={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Scan barcode/i }));
    expect(await screen.findByText('Burger Buns')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Wastage quantity' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Damaged' }));
    fireEvent.click(screen.getByRole('button', { name: /Review wastage/i }));

    expect(await screen.findByText('Confirm wastage')).toBeInTheDocument();
    expect(screen.getByText('48 each')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Record wastage in KCP/i }));

    expect(await screen.findByText('Wastage complete')).toBeInTheDocument();
    expect(screen.getByText('ADJ-20260720-0001')).toBeInTheDocument();
    expect(mocks.lookup).toHaveBeenCalledWith('ws-1', '600123', 'loc-1');
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.post).toHaveBeenCalledWith('ws-1', expect.objectContaining({
      stockItemId: 'item-1',
      locationId: 'loc-1',
      quantity: 2,
      uom: 'Crate',
      wasteReason: 'Damaged'
    }));
    await waitFor(() => expect(mocks.recoveryClear).toHaveBeenCalledWith('ws-1', 'user-1'));
  });

  it('surfaces unknown barcodes without creating a stock item', async () => {
    mocks.lookup.mockResolvedValue({ ok: true, matched: false, reason: 'not_found', barcode: '999' });
    render(<WastageScreen workspaceId="ws-1" userId="user-1" location={location} canSearchItems={false} onLocation={vi.fn()} />);

    fireEvent.change(await screen.findByPlaceholderText('Enter barcode manually'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No active KCP stock item matches that barcode');
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
