import { describe, expect, it } from 'vitest';
import { buildAccessSnapshot, hasSectionAccess, normalizeKcpLocations } from './permissions';
import type { AuthUser } from '../../types/kcp';

const user: AuthUser = {
  uid: 'user-1',
  id: 'user-1',
  email: 'stock@example.com',
  displayName: 'Stock User'
};

const locations = [
  { id: 'loc-kitchen', name: 'Kitchen', active: true },
  { id: 'loc-store', name: 'Main Store', active: true },
  { id: 'loc-old', name: 'Closed Site', active: false }
];

describe('KCP mobile access', () => {
  it('maps the stocktaker role to stock take but not manufacturing', () => {
    const access = buildAccessSnapshot({
      currentRole: 'stocktaker',
      team: [{ uid: 'user-1', email: user.email, role: 'stocktaker', allowedLocations: ['loc-store'] }]
    }, user, locations);

    expect(hasSectionAccess(access, 'stock-takes')).toBe(true);
    expect(hasSectionAccess(access, 'tasks')).toBe(true);
    expect(hasSectionAccess(access, 'manufacturing')).toBe(false);
    expect(access.accessibleLocations.map((location) => location.id)).toEqual(['loc-store']);
  });

  it('requires an explicit task permission for custom roles', () => {
    const access = buildAccessSnapshot({ currentRole: 'closer', customRoles: [{ name: 'closer', permissions: ['nav-dashboard', 'nav-tasks'], locations: ['loc-kitchen'] }], team: [{ uid: 'user-1', role: 'closer', allowedLocations: ['loc-kitchen'] }] }, user, locations);
    expect(hasSectionAccess(access, 'tasks')).toBe(true);
    expect(access.accessibleLocations.map((location) => location.id)).toEqual(['loc-kitchen']);
  });

  it('maps prep to manufacturing but not stock takes', () => {
    const access = buildAccessSnapshot({
      currentRole: 'prep',
      team: [{ uid: 'user-1', email: user.email, role: 'prep', allowedLocations: ['all'] }]
    }, user, locations);

    expect(hasSectionAccess(access, 'manufacturing')).toBe(true);
    expect(hasSectionAccess(access, 'stock-takes')).toBe(false);
  });

  it('maps storeman to goods receiving through nav-grv', () => {
    const access = buildAccessSnapshot({
      currentRole: 'storeman',
      team: [{ uid: 'user-1', email: user.email, role: 'storeman', allowedLocations: ['loc-store'] }]
    }, user, locations);

    expect(hasSectionAccess(access, 'receiving')).toBe(true);
    expect(hasSectionAccess(access, 'manufacturing')).toBe(false);
  });

  it('uses custom role permissions and intersects role and member locations', () => {
    const access = buildAccessSnapshot({
      currentRole: 'evening-counter',
      customRoles: [{
        name: 'evening-counter',
        label: 'Evening Counter',
        permissions: ['nav-dashboard', 'nav-stock-count'],
        locations: ['loc-kitchen', 'loc-store']
      }],
      team: [{ uid: 'user-1', email: user.email, role: 'evening-counter', allowedLocations: ['loc-kitchen'] }]
    }, user, locations);

    expect(access.roleDefinition.label).toBe('Evening Counter');
    expect(access.accessibleLocations.map((location) => location.id)).toEqual(['loc-kitchen']);
    expect(hasSectionAccess(access, 'stock-takes')).toBe(true);
  });

  it('gives owners all active locations', () => {
    const access = buildAccessSnapshot({ currentRole: 'owner', team: [] }, user, locations);
    expect(access.accessibleLocations.map((location) => location.id)).toEqual(['loc-kitchen', 'loc-store']);
  });

  it('grants exception approvals only through the explicit approval permission', () => {
    const manager = buildAccessSnapshot({ currentRole: 'manager', team: [{ uid: 'user-1', role: 'manager', allowedLocations: ['all'] }] }, user, locations);
    const counter = buildAccessSnapshot({ currentRole: 'counter', customRoles: [{ name: 'counter', permissions: ['nav-dashboard', 'nav-stock-count'], locations: ['all'] }], team: [{ uid: 'user-1', role: 'counter', allowedLocations: ['all'] }] }, user, locations);
    expect(hasSectionAccess(manager, 'approvals')).toBe(true);
    expect(hasSectionAccess(counter, 'approvals')).toBe(false);
  });

  it('keeps stock lookup and wastage as separate effective permissions', () => {
    const wastage = buildAccessSnapshot({
      currentRole: 'waste-capturer',
      customRoles: [{ name: 'waste-capturer', permissions: ['nav-adjustments'], locations: ['all'] }],
      team: [{ uid: 'user-1', email: user.email, role: 'waste-capturer', allowedLocations: ['all'] }]
    }, user, locations);

    expect(hasSectionAccess(wastage, 'wastage')).toBe(true);
    expect(hasSectionAccess(wastage, 'stock-lookup')).toBe(false);
  });
});

describe('location normalization', () => {
  it('deduplicates names, drops inactive rows and sorts labels', () => {
    expect(normalizeKcpLocations([
      { id: 'b', displayName: 'Store' },
      { id: 'a', name: 'Kitchen' },
      { id: 'duplicate', name: 'store' },
      { id: 'closed', name: 'Closed', active: false }
    ]).map((location) => location.displayName)).toEqual(['Kitchen', 'Store']);
  });
});
