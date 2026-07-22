import { describe, expect, it } from 'vitest';
import type { AccessSnapshot, KcpLocation } from '../../types/kcp';
import { BUILT_IN_ROLE_SETS, filterRoleSetLocations, resolveRoleSet, sortActionsForRoleSet } from './roleSetModel';
import type { KcpAction } from '../flow/actionModel';

const access: AccessSnapshot = { currentRole: 'prep', currentIsSuperUser: false, currentIsKcpSuperUser: false, permissions: [], allowedSections: [], currentUserLocations: ['loc-1'], accessibleLocations: [], roleDefinition: { name: 'prep', label: 'Prep', permissions: [], locations: ['all'] } };

describe('Role Sets', () => {
  it('supports ten or more compact-selector choices and maps legacy roles safely', () => {
    expect(BUILT_IN_ROLE_SETS.length).toBeGreaterThanOrEqual(10);
    expect(resolveRoleSet(null, access).id).toBe('production-team');
  });

  it('can only narrow the permission-authorised location list', () => {
    const locations = [{ id: 'loc-1', locationId: 'loc-1', name: 'One', displayName: 'One' }, { id: 'loc-2', locationId: 'loc-2', name: 'Two', displayName: 'Two' }] as KcpLocation[];
    const roleSet = { ...resolveRoleSet(null, access), locationIds: ['loc-2', 'loc-3'] };
    expect(filterRoleSetLocations(locations.slice(0, 1), roleSet).map((item) => item.id)).toEqual([]);
    expect(filterRoleSetLocations(locations, roleSet).map((item) => item.id)).toEqual(['loc-2']);
  });

  it('prioritises preferred Action types, then the configured priority order', () => {
    const base = { id: 'base', actionType: 'routine_checklist', workspaceId: 'ws', location: null, sourceRecord: { type: 'routine', id: 'r' }, assignment: { type: 'user', id: 'u', label: 'U' }, title: '', priority: 'normal', dueAt: '2026-07-21T10:00:00Z', status: 'ready', progress: { completed: 0, total: 1, percent: 0 }, requiredPermission: 'nav-tasks', financialImpact: null, deepLink: '', steps: [], notes: '', evidence: [], revision: 1, updatedAt: '' } as KcpAction;
    const actions = [{ ...base, id: 'routine', actionType: 'routine_checklist' }, { ...base, id: 'yield', actionType: 'yield_exception', priority: 'high' as const }];
    expect(sortActionsForRoleSet(actions, resolveRoleSet(null, access))[0].id).toBe('yield');
  });
});
