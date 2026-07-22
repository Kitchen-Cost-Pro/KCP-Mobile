import { describe, expect, it } from 'vitest';
import { ACTION_STATUSES, normalizeAction } from './actionModel';

describe('KCP Flow shared Action model', () => {
  it('preserves a legacy operational record while projecting the new names', () => {
    const action = normalizeAction({ id: 'task-1', templateId: 'template-1', status: 'open', bucket: 'due_today', assignment: { type: 'role', id: 'manager', label: 'Manager' }, steps: [{ id: 's1', completed: false }], evidence: [], revision: 3 }, 'ws-1');
    expect(action.id).toBe('task-1');
    expect(action.routineId).toBe('template-1');
    expect(action.workspaceId).toBe('ws-1');
    expect(action.assignment.type).toBe('role_set');
    expect(action.status).toBe('ready');
    expect(action.revision).toBe(3);
  });

  it('supports every Phase 17 status', () => {
    expect(ACTION_STATUSES).toEqual(['upcoming', 'ready', 'in_progress', 'waiting', 'completed', 'deferred', 'cancelled']);
  });
});
