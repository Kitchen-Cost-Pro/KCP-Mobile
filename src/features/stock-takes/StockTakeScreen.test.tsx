import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  loadPackage: vi.fn(),
  listDrafts: vi.fn(),
  listHistory: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  get: vi.fn(),
  reconcile: vi.fn(),
  commit: vi.fn(),
  recoveryGet: vi.fn(),
  recoverySet: vi.fn(),
  recoveryClear: vi.fn()
}));

vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
vi.mock('./countRecoveryStore', () => ({
  countRecoveryStore: {
    get: mocks.recoveryGet,
    set: mocks.recoverySet,
    clear: mocks.recoveryClear
  }
}));
vi.mock('./stockTakeApi', () => ({
  listStockCountTemplates: mocks.listTemplates,
  loadStockCountPackage: mocks.loadPackage,
  listStockCountDrafts: mocks.listDrafts,
  listStockCountHistory: mocks.listHistory,
  createStockCount: mocks.create,
  saveStockCount: mocks.save,
  getStockCount: mocks.get,
  reconcileStockCount: mocks.reconcile,
  commitStockCount: mocks.commit
}));

import { StockTakeScreen } from './StockTakeScreen';

const location = {
  id: 'loc-1',
  locationId: 'loc-1',
  name: 'Main Kitchen',
  displayName: 'Main Kitchen',
  active: true
};

const template = {
  id: 'tpl-1',
  name: 'Weekly Kitchen Count',
  version: 'v1',
  scope: 'items',
  linkedLocations: [{ id: 'loc-1', name: 'Main Kitchen', kind: 'storage' }]
};

const item = {
  id: 'item-1',
  name: 'Burger Buns',
  sku: 'BUN-1',
  category: 'Bakery',
  baseUom: 'each',
  barcodes: ['600123'],
  uoms: [{ id: 'item-1:crate', name: 'Crate of 24', quantityInBase: 24, sortOrder: 0 }]
};

const secondItem = {
  id: 'item-2',
  name: 'Tomato Sauce',
  sku: 'SAUCE-1',
  category: 'Sauces',
  baseUom: 'bottle',
  barcodes: ['600456'],
  uoms: []
};

describe('StockTakeScreen', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.listTemplates.mockResolvedValue([template]);
    mocks.listDrafts.mockResolvedValue([]);
    mocks.listHistory.mockResolvedValue([]);
    mocks.recoveryGet.mockResolvedValue(null);
    mocks.recoverySet.mockResolvedValue(undefined);
    mocks.recoveryClear.mockResolvedValue(undefined);
    mocks.loadPackage.mockResolvedValue({
      template,
      location: template.linkedLocations[0],
      linkedLocations: template.linkedLocations,
      items: [item],
      itemCount: 1,
      dataVersion: 'v1'
    });
    mocks.create.mockResolvedValue({
      ok: true,
      sessionId: 'draft-1',
      revision: 1,
      status: 'server_draft',
      savedAt: '2026-07-20T10:00:00Z'
    });
    mocks.save.mockResolvedValue({
      ok: true,
      sessionId: 'draft-1',
      revision: 2,
      status: 'server_draft',
      savedAt: '2026-07-20T10:01:00Z'
    });
    mocks.reconcile.mockResolvedValue({
      sessionId: 'draft-1',
      reconciliationVersion: 'rec-1',
      reconciledAt: '2026-07-20T10:02:00Z',
      reconciliationExpiresAt: '2026-07-20T10:12:00Z',
      currency: 'ZAR',
      countedItemCount: 1,
      uncountedItemCount: 0,
      positiveVarianceValue: 0,
      negativeVarianceValue: -200,
      netVarianceValue: -200,
      lines: [{
        stockItemId: 'item-1',
        name: 'Burger Buns',
        baseUom: 'each',
        countedBaseQuantity: 0,
        expectedQuantity: 100,
        varianceQuantity: -100,
        unitCost: 2,
        varianceValue: -200,
        counted: true,
        warnings: []
      }],
      blockingErrors: [],
      warnings: []
    });
    mocks.commit.mockResolvedValue({
      ok: true,
      sessionId: 'draft-1',
      duplicate: false,
      transactionId: 'ST-20260720-0001',
      status: 'committed',
      committedAt: '2026-07-20T10:03:00Z',
      countedItemCount: 1,
      netVarianceValue: -200,
      currency: 'ZAR'
    });
  });

  it('starts only the template linked to the selected authorised location', async () => {
    render(<StockTakeScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);

    expect(await screen.findByText('Weekly Kitchen Count')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('Burger Buns')).toBeInTheDocument();
    expect(mocks.loadPackage).toHaveBeenCalledWith('ws-1', 'tpl-1', 'loc-1');
    expect(mocks.create).toHaveBeenCalledWith('ws-1', expect.objectContaining({
      locationId: 'loc-1',
      lines: [expect.objectContaining({ stockItemId: 'item-1', counted: false })]
    }));
  });

  it('treats confirmed zero as counted and reconciles before the one commit', async () => {
    render(<StockTakeScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const baseInput = await screen.findByRole('spinbutton', { name: 'each quantity' });

    fireEvent.change(baseInput, { target: { value: '0' } });
    expect(screen.getByText('1 of 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review count/i }));

    expect(await screen.findByText('Final review')).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledWith('ws-1', 'draft-1', expect.objectContaining({
      expectedRevision: 1,
      lines: [expect.objectContaining({ baseQuantity: 0, counted: true })]
    }));
    expect(mocks.reconcile).toHaveBeenCalledWith('ws-1', 'draft-1');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Submit to KCP/i }));

    expect(await screen.findByText('Stock take complete')).toBeInTheDocument();
    expect(screen.getByText('ST-20260720-0001')).toBeInTheDocument();
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(mocks.commit).toHaveBeenCalledWith('ws-1', 'draft-1', 'rec-1');
    await waitFor(() => expect(mocks.recoveryClear).toHaveBeenCalledWith('ws-1', 'user-1'));
  });

  it('can explicitly return a counted item to the uncounted state', async () => {
    render(<StockTakeScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const baseInput = await screen.findByRole('spinbutton', { name: 'each quantity' });

    fireEvent.change(baseInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as uncounted' }));

    expect(baseInput).toHaveValue(null);
    expect(screen.getByText('0 of 1')).toBeInTheDocument();
  });

  it('keeps the active card while typing, then moves it into the Counted bucket', async () => {
    mocks.loadPackage.mockResolvedValue({
      template,
      location: template.linkedLocations[0],
      linkedLocations: template.linkedLocations,
      items: [item, secondItem],
      itemCount: 2,
      dataVersion: 'v1'
    });
    render(<StockTakeScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    const bunInput = await screen.findByRole('spinbutton', { name: 'each quantity' });

    fireEvent.focus(bunInput);
    fireEvent.change(bunInput, { target: { value: '12' } });
    expect(screen.getByText('Burger Buns')).toBeInTheDocument();
    expect(screen.getByText('Tomato Sauce')).toBeInTheDocument();
    fireEvent.blur(bunInput);

    await waitFor(() => expect(screen.queryByText('Burger Buns')).not.toBeInTheDocument());
    expect(screen.getByText('Tomato Sauce')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Counted 1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Counted 1/i }));
    expect(await screen.findByText('Burger Buns')).toBeInTheDocument();
    expect(screen.queryByText('Tomato Sauce')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as uncounted' }));

    await waitFor(() => expect(screen.queryByText('Burger Buns')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('tab', { name: /To Count 2/i }));
    expect(await screen.findByText('Burger Buns')).toBeInTheDocument();
  });
});
