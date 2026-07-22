import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../hooks/useConnectivity', () => ({ useConnectivity: () => true }));
import { StockLookupScreen } from './StockLookupScreen';

describe('StockLookupScreen Phase 13 hand-off', () => {
  it('opens an authorised low-stock item directly without another search', async () => {
    render(<StockLookupScreen
      workspaceId="ws-1"
      location={{ id: 'loc-1', locationId: 'loc-1', name: 'Main Store', displayName: 'Main Store' }}
      onLocation={vi.fn()}
      initialItem={{ id: 'flour', name: 'Flour', sku: 'FL-1', category: 'Dry Goods', baseUom: 'kg', trackInventory: true, onHand: 2, barcodes: ['600001'], uoms: [{ id: 'flour:base', name: 'kg', quantityInBase: 1, isBase: true }] }}
    />);
    expect(await screen.findByRole('heading', { name: 'Flour' })).toBeInTheDocument();
    expect(screen.getByText('2 kg')).toBeInTheDocument();
    expect(screen.getByText(/opened from low-stock intelligence/i)).toBeInTheDocument();
  });
});
