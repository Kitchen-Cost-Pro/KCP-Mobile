import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(), buckets: vi.fn(), search: vi.fn(), create: vi.fn(), accept: vi.fn(), reject: vi.fn(),
  recoveryGet: vi.fn(), recoverySet: vi.fn(), recoveryClear: vi.fn(), scan: vi.fn()
}));

vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
vi.mock('../wastage/nativeBarcodeScanner', () => ({ scanBarcodeWithDevice: mocks.scan }));
vi.mock('./transferApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./transferApi')>();
  return { ...original, loadTransferBootstrap: mocks.bootstrap, loadTransferBuckets: mocks.buckets, searchTransferItems: mocks.search, createInternalTransfer: mocks.create, acceptIncomingTransfer: mocks.accept, rejectIncomingTransfer: mocks.reject };
});
vi.mock('./transferRecoveryStore', () => ({ transferRecoveryStore: { get: mocks.recoveryGet, set: mocks.recoverySet, clear: mocks.recoveryClear } }));

import { TransfersScreen } from './TransfersScreen';

const location = { id: 'loc-1', locationId: 'loc-1', name: 'Main Kitchen', displayName: 'Main Kitchen', active: true };
const item = {
  id: 'item-1', name: 'Burger Buns', sku: 'BUN-1', category: 'Bakery', baseUom: 'each', onHand: 48,
  barcodes: ['600123'], uoms: [{ id: 'item-1:base', name: 'each', quantityInBase: 1, isBase: true }, { id: 'item-1:Crate', name: 'Crate', quantityInBase: 24, isBase: false, barcode: '600123' }]
};
const incoming = {
  id: 'external-1', transactionReference: 'TRF-20260720-0001', type: 'external', direction: 'inbound', status: 'pending_receipt',
  fromLocationName: 'Central Store', toLocationName: 'Main Kitchen', fromSiteName: '', toSiteName: '', note: 'Morning delivery', createdByName: 'Store User',
  requestedAt: '2026-07-20T08:00:00.000Z', acceptedAt: '', lineCount: 1, shippedQty: 10, receivedQty: 0,
  items: [{ stockItemId: 'item-1', name: 'Burger Buns', quantity: 10, unit: 'each', receivedQty: 0 }]
};

describe('TransfersScreen', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', canCreateInternal: true, locations: [{ id: 'loc-1', name: 'Main Kitchen', kind: 'selling', isDefault: true }, { id: 'loc-2', name: 'Prep Kitchen', kind: 'production', isDefault: false }] });
    mocks.buckets.mockResolvedValue({ ok: true, awaitingMyAcceptance: [incoming], recentlySent: [], recentlyReceived: [], needsAttention: [incoming], counts: { awaitingMyAcceptance: 1, recentlySent: 0, recentlyReceived: 0 } });
    mocks.search.mockResolvedValue([item]);
    mocks.create.mockResolvedValue({ ok: true, duplicate: false, transferId: 'transfer-1', transactionReference: 'TRF-20260720-0002', status: 'posted', fromLocationId: 'loc-1', toLocationId: 'loc-2', lineCount: 1, lines: [], postedAt: '2026-07-20T09:00:00.000Z' });
    mocks.accept.mockResolvedValue({ ok: true, transferId: 'external-1', status: 'accepted' });
    mocks.reject.mockResolvedValue({ ok: true, transferId: 'external-1', status: 'rejected' });
    mocks.recoveryGet.mockResolvedValue(null);
    mocks.recoverySet.mockResolvedValue(undefined);
    mocks.recoveryClear.mockResolvedValue(undefined);
  });

  it('creates one reviewed, idempotent internal transfer and shows its receipt', async () => {
    render(<TransfersScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /New internal transfer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Select destination location' }));
    expect(screen.queryByRole('button', { name: 'Select Main Kitchen' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select Prep Kitchen' }));
    fireEvent.change(screen.getByPlaceholderText('Search source stock'), { target: { value: 'bun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: /Burger Buns/i }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Burger Buns quantity' }), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Burger Buns unit' }), { target: { value: 'Crate' } });
    fireEvent.click(screen.getByRole('button', { name: /Review transfer/i }));

    expect(await screen.findByText('Confirm transfer')).toBeInTheDocument();
    expect(screen.getByText('48 each')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Post transfer in KCP/i }));

    expect(await screen.findByText('Transfer complete')).toBeInTheDocument();
    expect(screen.getByText('TRF-20260720-0002')).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith('ws-1', expect.objectContaining({ fromLocationId: 'loc-1', toLocationId: 'loc-2', lines: [{ stockItemId: 'item-1', quantity: 2, uom: 'Crate' }] }));
    await waitFor(() => expect(mocks.recoveryClear).toHaveBeenCalledWith('ws-1', 'user-1'));
  });

  it('supports a checked partial receipt without trusting the client for posting logic', async () => {
    render(<TransfersScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Central Store.*Main Kitchen/i }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Burger Buns received quantity' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Accept quantities/i }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('ws-1', 'external-1', [{ stockItemId: 'item-1', receivedQty: 8 }]));
  });

  it('requires both a reason and explicit confirmation before rejection', async () => {
    render(<TransfersScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Central Store.*Main Kitchen/i }));
    const reject = screen.getByRole('button', { name: 'Reject transfer' });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Explain why this delivery is being rejected'), { target: { value: 'Packaging damaged' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(reject);
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith('ws-1', 'external-1', 'Packaging damaged'));
  });

  it('blocks an ambiguous transfer barcode without selecting an item', async () => {
    mocks.search.mockResolvedValue([item, { ...item, id: 'item-2', name: 'Other Buns' }]);
    render(<TransfersScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /New internal transfer/i }));
    fireEvent.change(screen.getByPlaceholderText('Enter barcode manually'), { target: { value: '600123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('belongs to more than one stock item');
    expect(screen.queryByRole('spinbutton', { name: /quantity/i })).not.toBeInTheDocument();
  });

  it('keeps route items when a source change is cancelled and clears them when confirmed', async () => {
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', canCreateInternal: true, locations: [
      { id: 'loc-1', name: 'Main Kitchen', kind: 'selling', isDefault: true },
      { id: 'loc-2', name: 'Prep Kitchen', kind: 'production', isDefault: false },
      { id: 'loc-3', name: 'Central Store', kind: 'storage', isDefault: false }
    ] });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<TransfersScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /New internal transfer/i }));
    fireEvent.change(screen.getByPlaceholderText('Search source stock'), { target: { value: 'bun' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(await screen.findByRole('button', { name: /Burger Buns/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Select source location' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select Central Store' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('spinbutton', { name: 'Burger Buns quantity' })).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Select source location' })).getByText('Main Kitchen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Central Store' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('spinbutton', { name: 'Burger Buns quantity' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Select source location' })).getByText('Central Store')).toBeInTheDocument();
  });

  it('restores source and destination selections from the secure transfer draft', async () => {
    mocks.recoveryGet.mockResolvedValue({
      workspaceId: 'ws-1', userId: 'user-1', clientActionId: 'transfer-saved', fromLocationId: 'loc-2', toLocationId: 'loc-1',
      lines: [{ item, quantity: '3', selectedUomName: 'each' }], note: 'Recovered route', occurredAt: '2026-07-20T10:00:00.000Z', updatedAt: '2026-07-20T10:01:00.000Z'
    });
    render(<TransfersScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /New internal transfer/i }));
    expect(within(screen.getByRole('button', { name: 'Select source location' })).getByText('Prep Kitchen')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'Select destination location' })).getByText('Main Kitchen')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Burger Buns quantity' })).toHaveValue(3);
  });
});
