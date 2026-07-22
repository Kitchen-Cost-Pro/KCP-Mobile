import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ load: vi.fn(), detail: vi.fn(), save: vi.fn(), complete: vi.fn(), recoveryGet: vi.fn(), recoverySet: vi.fn(), recoveryClear: vi.fn(), snapshotGet: vi.fn(), snapshotSet: vi.fn() }));
vi.mock('../flow/actionApi', () => ({ loadActions: mocks.load, loadAction: mocks.detail, saveActionProgress: mocks.save, completeAction: mocks.complete }));
vi.mock('./taskRecoveryStore', () => ({ taskRecoveryStore: { get: mocks.recoveryGet, set: mocks.recoverySet, clear: mocks.recoveryClear } }));
vi.mock('./taskSnapshotStore', () => ({ taskSnapshotStore: { get: mocks.snapshotGet, set: mocks.snapshotSet } }));
import { KcpFlowScreen } from './TasksScreen';

const location = { id: 'loc-1', locationId: 'loc-1', name: 'Kitchen', displayName: 'Kitchen' };
const action = {
  id: 'task-1', workspaceId: 'ws-1', routineId: 'template-1', actionType: 'routine_checklist', sourceRecord: { type: 'routine', id: 'template-1' },
  title: 'Check freezer temperatures', description: 'Morning safety check', priority: 'high' as const, dueAt: '2026-07-20T17:00:00Z',
  status: 'ready' as const, progress: { completed: 0, total: 1, percent: 0 }, requiredPermission: 'nav-tasks', financialImpact: null,
  deepLink: 'kcplite://workspace/ws-1/actions/task-1', location: { id: 'loc-1', name: 'Kitchen' }, assignment: { type: 'location' as const, id: 'loc-1', label: 'Kitchen' },
  steps: [{ id: 'step-1', label: 'Record freezer one', required: true, completed: false }], notes: '', evidence: [], revision: 1, updatedAt: '2026-07-20T08:00:00Z'
};
const counts = { upcoming: 0, ready: 1, in_progress: 0, waiting: 0, completed: 0, deferred: 0, cancelled: 0 };
const response = { ok: true, generatedAt: '2026-07-20T08:00:00Z', locationId: 'loc-1', counts, actions: [action] };

describe('KCP Flow', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.load.mockResolvedValue(response); mocks.detail.mockResolvedValue({ ok: true, action, history: [] });
    mocks.save.mockResolvedValue({ ok: true, action: { ...action, revision: 2 } });
    mocks.complete.mockResolvedValue({ ok: true, duplicate: false, action: { ...action, status: 'completed' } });
    mocks.recoveryGet.mockResolvedValue(null); mocks.recoverySet.mockResolvedValue(undefined); mocks.recoveryClear.mockResolvedValue(undefined);
  });

  it('opens and completes an assigned Action without rediscovery', async () => {
    render(<KcpFlowScreen workspaceId="ws-1" userId="user-1" connected location={location} onLocation={vi.fn()} />);
    expect(await screen.findByText('Check freezer temperatures')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Check freezer temperatures'));
    expect(await screen.findByText('Record freezer one')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Record freezer one'));
    fireEvent.click(screen.getByRole('button', { name: /Complete Action/i }));
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith('ws-1', 'task-1', expect.objectContaining({ steps: [expect.objectContaining({ completed: true })] })));
    expect(mocks.recoveryClear).toHaveBeenCalledWith('ws-1', 'user-1');
  });

  it('uses the preserved read-only location snapshot offline', async () => {
    mocks.snapshotGet.mockReturnValue(response);
    render(<KcpFlowScreen workspaceId="ws-1" userId="user-1" connected={false} location={location} onLocation={vi.fn()} />);
    expect(await screen.findByText(/last saved KCP Flow snapshot is read-only/i)).toBeInTheDocument();
    expect(screen.getByText('Check freezer temperatures')).toBeInTheDocument();
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
