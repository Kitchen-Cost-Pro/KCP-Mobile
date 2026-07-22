import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ bootstrap: vi.fn(), catalog: vi.fn(), preview: vi.fn(), post: vi.fn(), recoveryGet: vi.fn(), recoverySet: vi.fn(), recoveryClear: vi.fn() }));
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
vi.mock('./manufacturingApi', async (importOriginal) => {
  const original = await importOriginal<typeof import('./manufacturingApi')>();
  return { ...original, loadManufacturingBootstrap: mocks.bootstrap, loadManufacturingCatalog: mocks.catalog, previewManufacturingRun: mocks.preview, postManufacturingRun: mocks.post };
});
vi.mock('./manufacturingRecoveryStore', () => ({ manufacturingRecoveryStore: { get: mocks.recoveryGet, set: mocks.recoverySet, clear: mocks.recoveryClear } }));

import { ManufacturingScreen } from './ManufacturingScreen';

const location = { id: 'loc-1', locationId: 'loc-1', name: 'Main Kitchen', displayName: 'Main Kitchen', active: true };
const sauce = { id: 'mfg-1', name: 'Tomato Sauce', sku: 'SAUCE-1', category: 'Sauces', baseUom: 'litre', batchYield: 10, barcodes: [], uoms: [], hasBlueprint: true, blueprintIssue: null };
const patties = { id: 'mfg-2', name: 'Burger Patties', sku: 'PAT-1', category: 'Prep', baseUom: 'each', batchYield: 20, barcodes: [], uoms: [], hasBlueprint: true, blueprintIssue: null };
const missing = { id: 'mfg-3', name: 'House Dressing', sku: null, category: 'Sauces', baseUom: 'litre', batchYield: 5, barcodes: [], uoms: [], hasBlueprint: false, blueprintIssue: 'Blueprint required' };
const runPreview = { ok: true, location: { id: 'loc-1', name: 'Main Kitchen', kind: 'production' }, products: [{ item: sauce, batchCount: 2, expectedQuantity: 20, actualQuantity: 19, yieldVariance: -1, wastageQuantity: 1 }], components: [{ stockItemId: 'raw-1', name: 'Tomatoes', unit: 'kg', requiredQuantity: 12, onHand: 20, remainingQuantity: 8, available: true }], blockingErrors: [], previewToken: 'run-preview-1', previewedAt: '2026-07-20T08:00:00Z' };

describe('ManufacturingScreen Phase 7', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.bootstrap.mockResolvedValue({ ok: true, workspaceId: 'ws-1', canCreateBatch: true, locations: [{ id: 'loc-1', name: 'Main Kitchen', kind: 'production', isDefault: true }], recentBatches: [] });
    mocks.catalog.mockResolvedValue([sauce, patties, missing]);
    mocks.preview.mockResolvedValue(runPreview);
    mocks.post.mockResolvedValue({ ok: true, runId: 'mfg-run-1', duplicate: false, location: runPreview.location, productCount: 1, componentCount: 1, batches: [{ ok: true, duplicate: false, batchId: 'batch-1', transactionReference: 'MFG-0001', itemName: 'Tomato Sauce', locationName: 'Main Kitchen', expectedQuantity: 20, actualQuantity: 19, wastageQuantity: 1, unit: 'litre', componentCount: 1, postedAt: '2026-07-20T08:01:00Z' }], postedAt: '2026-07-20T08:01:00Z' });
    mocks.recoveryGet.mockResolvedValue(null); mocks.recoverySet.mockResolvedValue(undefined); mocks.recoveryClear.mockResolvedValue(undefined);
  });

  it('lists every manufactured item without discovery search and posts entered values', async () => {
    render(<ManufacturingScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Record production/i }));
    expect(await screen.findByText('Tomato Sauce')).toBeInTheDocument();
    expect(screen.getByText('Burger Patties')).toBeInTheDocument();
    expect(screen.getByText('House Dressing')).toBeInTheDocument();
    expect(screen.getByText('Blueprint required')).toBeInTheDocument();
    expect(mocks.catalog).toHaveBeenCalledWith('ws-1', 'loc-1');

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tomato Sauce batches run' }), { target: { value: '2' } });
    expect(screen.getByRole('spinbutton', { name: 'Tomato Sauce actual produced' })).toHaveValue(20);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tomato Sauce actual produced' }), { target: { value: '19' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Done & next/i })[0]);
    expect(screen.queryByText('Tomato Sauce')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Entered 1/i }));
    expect(screen.getByText('Tomato Sauce')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review 1 product/i }));
    expect(await screen.findByText('Combined blueprint usage')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Post production run/i }));
    expect(await screen.findByText('Run complete')).toBeInTheDocument();
    expect(screen.getByText('MFG-0001')).toBeInTheDocument();
    expect(mocks.preview).toHaveBeenCalledWith('ws-1', 'loc-1', [{ manufacturedItemId: 'mfg-1', batchCount: 2, actualQuantity: 19, note: '' }]);
    expect(mocks.post).toHaveBeenCalledWith('ws-1', expect.objectContaining({ previewToken: 'run-preview-1', confirm: true }));
  });

  it('aggregates shortages and submits a locked approval exception without changing stock', async () => {
    mocks.preview.mockResolvedValue({ ...runPreview, components: [{ ...runPreview.components[0], requiredQuantity: 24, remainingQuantity: -4, available: false }], blockingErrors: ['Not enough Tomatoes.'] });
    mocks.post.mockResolvedValue({ ok: true, approvalRequired: true, locked: true, requestId: 'approval-mfg-1', status: 'submitted', message: 'Submitted for approval.' });
    render(<ManufacturingScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Record production/i }));
    await screen.findByText('Tomato Sauce');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Tomato Sauce batches run' }), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Review 1 product/i }));
    expect(await screen.findByText('Component shortages')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Submit for approval/i }));
    expect(await screen.findByText(/approval-mfg-1/)).toHaveTextContent('Stock has not changed');
    expect(screen.queryByText('Run complete')).not.toBeInTheDocument();
  });

  it('filters locally while keeping the full catalogue loaded', async () => {
    render(<ManufacturingScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Record production/i }));
    await screen.findByText('Tomato Sauce');
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter manufactured items' }), { target: { value: 'patties' } });
    expect(screen.getByText('Burger Patties')).toBeInTheDocument();
    expect(screen.queryByText('Tomato Sauce')).not.toBeInTheDocument();
    expect(mocks.catalog).toHaveBeenCalledTimes(1);
  });

  it('restores a secure multi-item production run and catalogue', async () => {
    mocks.recoveryGet.mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', draft: { clientRunId: 'run-saved', locationId: 'loc-1', entries: { 'mfg-1': { batchCount: '1', actualQuantity: '9', note: 'Recovered', entered: true } }, occurredAt: '2026-07-20T07:00:00Z' }, catalog: [sauce, patties, missing], updatedAt: '2026-07-20T07:01:00Z' });
    render(<ManufacturingScreen workspaceId="ws-1" userId="user-1" location={location} onLocation={vi.fn()} />);
    expect(await screen.findByText('Recovered your unfinished production run.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue saved run/i }));
    await screen.findByText('Burger Patties');
    fireEvent.click(screen.getByRole('button', { name: /Entered 1/i }));
    const restoredBatches = await screen.findByRole('spinbutton', { name: 'Tomato Sauce batches run' });
    expect(restoredBatches).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'Tomato Sauce actual produced' })).toHaveValue(9);
  });
});
