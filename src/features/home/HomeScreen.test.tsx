import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';
import type { AccessSnapshot } from '../../types/kcp';
import { BUILT_IN_ROLE_SETS } from '../role-sets/roleSetModel';

vi.mock('./OperationsDashboard', () => ({ OperationsDashboard: () => <section aria-label="Today’s operations dashboard" /> }));

const featureFlags = {
  stockCount: true,
  scan: false,
  wastage: false,
  transfers: false,
  manufacturing: false,
  receiving: false,
  purchaseOrders: false,
  tasks: false,
  approvals: false
};

function access(permissions: string[]): AccessSnapshot {
  return {
    currentRole: 'custom',
    currentIsSuperUser: false,
    currentIsKcpSuperUser: false,
    permissions,
    allowedSections: [],
    currentUserLocations: ['all'],
    accessibleLocations: [],
    roleDefinition: { name: 'custom', label: 'Custom', permissions, locations: ['all'] }
  };
}

describe('HomeScreen', () => {
  it('shows the existing KCP workspace logo in the greeting tile', () => {
    const logo = 'data:image/png;base64,a2Nw';
    render(<HomeScreen name="David User" workspaceName="Test Kitchen" workspaceLogo={logo} location={null} access={access(['nav-dashboard'])} featureFlags={{ ...featureFlags, stockCount: false }} onNavigate={vi.fn()} onLocation={vi.fn()} />);
    const mark = screen.getByLabelText('Test Kitchen workspace logo');
    expect(mark.querySelector('img')).toHaveAttribute('src', logo);
  });

  it('mounts the live dashboard for the selected workspace', () => {
    render(<HomeScreen name="David User" workspaceId="ws-1" workspaceName="Test Kitchen" location={null} access={access(['nav-dashboard'])} featureFlags={{ ...featureFlags, stockCount: false }} onNavigate={vi.fn()} onLocation={vi.fn()} />);
    expect(screen.getByLabelText('Today’s operations dashboard')).toBeInTheDocument();
  });

  it('puts work-first Quick Tools before compact operational insights', () => {
    render(<HomeScreen name="David User" workspaceId="ws-1" workspaceName="Test Kitchen" location={null} access={access(['nav-dashboard', 'nav-stock-count'])} featureFlags={featureFlags} onNavigate={vi.fn()} onLocation={vi.fn()} />);
    const actions = screen.getByText('Quick Tools').closest('section');
    const dashboard = screen.getByLabelText('Today’s operations dashboard');
    expect(actions).not.toBeNull();
    expect(actions!.compareDocumentPosition(dashboard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'David' })).toBeInTheDocument();
  });

  it('uses workspace initials when KCP has no uploaded logo or the image cannot render', () => {
    const props = { name: 'David User', workspaceName: 'Test Kitchen', location: null, access: access(['nav-dashboard']), featureFlags: { ...featureFlags, stockCount: false }, onNavigate: vi.fn(), onLocation: vi.fn() };
    const { rerender } = render(<HomeScreen {...props} />);
    expect(screen.getByLabelText('Test Kitchen workspace logo')).toHaveTextContent('TK');
    rerender(<HomeScreen {...props} workspaceLogo="data:image/png;base64,broken" />);
    const image = screen.getByLabelText('Test Kitchen workspace logo').querySelector('img');
    if (!image) throw new Error('Expected workspace logo image.');
    fireEvent.error(image);
    expect(screen.getByLabelText('Test Kitchen workspace logo')).toHaveTextContent('TK');
  });

  it('only renders actions allowed by the effective permissions', () => {
    render(<HomeScreen
      name="David User"
      workspaceName="Test Kitchen"
      location={null}
      access={access(['nav-dashboard', 'nav-stock-count'])}
      featureFlags={featureFlags}
      onNavigate={vi.fn()}
      onLocation={vi.fn()}
    />);
    expect(screen.getByText('Stock Take')).toBeInTheDocument();
    expect(screen.queryByText('Manufacturing')).not.toBeInTheDocument();
  });

  it('navigates to the stock take shell', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen
      name="David User"
      workspaceName="Test Kitchen"
      location={null}
      access={access(['nav-dashboard', 'nav-stock-count'])}
      featureFlags={featureFlags}
      onNavigate={onNavigate}
      onLocation={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Stock Take/i }));
    expect(onNavigate).toHaveBeenCalledWith('stock-takes');
  });

  it('shows and routes Phase 3 actions only when their flags and permissions agree', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen
      name="David User"
      workspaceName="Test Kitchen"
      location={null}
      access={access(['nav-dashboard', 'nav-adjustments', 'nav-ingredients'])}
      featureFlags={{ ...featureFlags, stockCount: false, scan: true, wastage: true }}
      onNavigate={onNavigate}
      onLocation={vi.fn()}
    />);

    fireEvent.click(screen.getByRole('button', { name: /Wastage/i }));
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'wastage');
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'scan');
  });

  it('routes transfers only when the feature and nav-transfers permission agree', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen
      name="David User"
      workspaceName="Test Kitchen"
      location={null}
      access={access(['nav-dashboard', 'nav-transfers'])}
      featureFlags={{ ...featureFlags, stockCount: false, transfers: true }}
      onNavigate={onNavigate}
      onLocation={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Transfers/i }));
    expect(onNavigate).toHaveBeenCalledWith('transfers');
  });

  it('routes Phase 5 manufacturing only when the feature and nav-mfg-products permission agree', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen
      name="Prep User"
      workspaceName="Test Kitchen"
      location={null}
      access={access(['nav-dashboard', 'nav-mfg-products'])}
      featureFlags={{ ...featureFlags, stockCount: false, manufacturing: true }}
      onNavigate={onNavigate}
      onLocation={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Manufacture/i }));
    expect(onNavigate).toHaveBeenCalledWith('manufacturing');
  });

  it('routes Phase 8 goods receiving only when nav-grv and the feature flag agree', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen
      name="Store User"
      workspaceName="Test Kitchen"
      location={null}
      access={access(['nav-dashboard', 'nav-grv'])}
      featureFlags={{ ...featureFlags, stockCount: false, receiving: true }}
      onNavigate={onNavigate}
      onLocation={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Receive/i }));
    expect(onNavigate).toHaveBeenCalledWith('receiving');
  });

  it('routes Phase 9 purchase orders only when permission and feature flag agree', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen name="Buyer" workspaceName="Test Kitchen" location={null} access={access(['nav-dashboard', 'nav-purchase-orders'])} featureFlags={{ ...featureFlags, stockCount: false, purchaseOrders: true }} onNavigate={onNavigate} onLocation={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Purchase Orders/i }));
    expect(onNavigate).toHaveBeenCalledWith('purchase-orders');
  });

  it('routes awaiting approvals only when both Phase 15 flag and permission agree', () => {
    const onNavigate = vi.fn();
    render(<HomeScreen name="Manager" workspaceName="Test Kitchen" location={null} access={access(['nav-dashboard', 'nav-approvals', 'action-approve-exceptions'])} featureFlags={{ ...featureFlags, stockCount: false, approvals: true }} onNavigate={onNavigate} onLocation={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Approvals/i }));
    expect(onNavigate).toHaveBeenCalledWith('approvals');
  });

  it('gives two permission-equal users clearly different Role Set experiences', () => {
    const shared = { name: 'KCP User', workspaceId: 'ws-1', workspaceName: 'Test Kitchen', location: null, access: access(['nav-dashboard', 'nav-tasks', 'nav-stock-count', 'nav-transfers']), featureFlags: { ...featureFlags, tasks: true, transfers: true }, onNavigate: vi.fn(), onLocation: vi.fn() };
    const teamMember = BUILT_IN_ROLE_SETS.find((item) => item.id === 'team-member')!;
    const stockController = BUILT_IN_ROLE_SETS.find((item) => item.id === 'stock-controller')!;
    const { rerender } = render(<HomeScreen {...shared} roleSet={teamMember} />);
    expect(screen.getByText('Team Member')).toBeInTheDocument();
    expect(screen.getByText('No extra tools assigned.')).toBeInTheDocument();
    expect(screen.queryByText('Stock Take')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Today’s operations dashboard')).not.toBeInTheDocument();
    rerender(<HomeScreen {...shared} roleSet={stockController} />);
    expect(screen.getByText('Stock Controller')).toBeInTheDocument();
    expect(screen.getByText('Stock Take')).toBeInTheDocument();
    expect(screen.getByLabelText('Today’s operations dashboard')).toBeInTheDocument();
  });
});
