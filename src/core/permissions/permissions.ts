import type { AccessSnapshot, AuthUser, KcpLocation, RoleDefinition } from '../../types/kcp';

export const SECTION_PERMISSION_MAP = {
  home: 'nav-dashboard',
  tasks: 'nav-tasks',
  approvals: 'nav-approvals',
  'stock-takes': 'nav-stock-count',
  manufacturing: 'nav-mfg-products',
  receiving: 'nav-grv',
  'purchase-orders': 'nav-purchase-orders',
  transfers: 'nav-transfers',
  wastage: 'nav-adjustments',
  'stock-lookup': 'nav-ingredients'
} as const;

const ALL_NAV_PERMISSIONS = [
  'nav-dashboard', 'nav-products', 'nav-recipes', 'nav-ingredients', 'nav-suppliers',
  'nav-purchase-orders', 'nav-grv', 'nav-credit-note', 'nav-adjustments', 'nav-transfers',
  'nav-stock-count', 'nav-locations', 'nav-mfg-products', 'nav-reporting', 'nav-integrations',
  'nav-user-management', 'nav-custom-roles', 'nav-settings', 'nav-tasks', 'nav-approvals'
];

const ALL_ACTION_PERMISSIONS = [
  'action-delete-records', 'action-bulk-delete', 'action-edit-stock-take-7-days',
  'action-edit-stock-take-30-days', 'action-manage-users', 'action-manage-roles',
  'action-assign-low-stock-email-tag', 'action-external-transfers',
  'action-save-workspace-report-views', 'action-schedule-reports', 'action-email-reports',
  'action-manage-report-schedules', 'action-delete-report-schedules', 'action-manage-task-templates',
  'action-approve-exceptions', 'action-manage-approval-policies', 'action-manage-notifications'
];

const DEFAULT_ROLES: Record<string, RoleDefinition> = {
  superuser: role('superuser', 'KCP Superuser', [...ALL_NAV_PERMISSIONS, ...ALL_ACTION_PERMISSIONS], ['all']),
  owner: role('owner', 'Owner', [...ALL_NAV_PERMISSIONS, ...ALL_ACTION_PERMISSIONS], ['all']),
  admin: role('admin', 'Admin', [...ALL_NAV_PERMISSIONS, ...ALL_ACTION_PERMISSIONS], ['all']),
  manager: role('manager', 'Manager', [
    'nav-dashboard', 'nav-products', 'nav-recipes', 'nav-ingredients', 'nav-grv', 'nav-credit-note',
    'nav-suppliers', 'nav-purchase-orders', 'nav-adjustments', 'nav-transfers', 'nav-stock-count',
    'nav-locations', 'nav-mfg-products', 'nav-reporting', 'nav-integrations',
    'action-edit-stock-take-7-days', 'action-edit-stock-take-30-days', 'nav-tasks', 'action-manage-task-templates',
    'nav-approvals', 'action-approve-exceptions', 'action-manage-approval-policies'
  ], ['all']),
  member: role('member', 'Member', [
    'nav-dashboard', 'nav-products', 'nav-recipes', 'nav-ingredients', 'nav-grv', 'nav-credit-note',
    'nav-suppliers', 'nav-purchase-orders', 'nav-adjustments', 'nav-transfers', 'nav-stock-count',
    'nav-locations', 'nav-mfg-products', 'nav-integrations', 'nav-tasks'
  ], ['all']),
  storeman: role('storeman', 'Storeman', [
    'nav-dashboard', 'nav-grv', 'nav-credit-note', 'nav-suppliers', 'nav-purchase-orders', 'nav-transfers', 'nav-tasks'
  ], ['all']),
  prep: role('prep', 'Prep', ['nav-dashboard', 'nav-mfg-products', 'nav-tasks'], ['all']),
  stocktaker: role('stocktaker', 'Stock Taker', [
    'nav-dashboard', 'nav-ingredients', 'nav-transfers', 'nav-stock-count', 'nav-tasks'
  ], ['all']),
  stocktracker: role('stocktracker', 'Stock Tracker', [
    'nav-dashboard', 'nav-ingredients', 'nav-transfers', 'nav-stock-count', 'nav-tasks'
  ], ['all']),
  'transfer-agent': role('transfer-agent', 'Transfer Agent', [
    'nav-dashboard', 'nav-ingredients', 'nav-transfers', 'nav-tasks'
  ], ['all']),
  'corporate-viewer': role('corporate-viewer', 'Corporate Viewer', ['nav-dashboard'], ['all'])
};

function role(name: string, label: string, permissions: string[], locations: string[]): RoleDefinition {
  return { name, label, permissions: unique(permissions), locations: unique(locations) };
}

export function normalizeRoleName(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
}

export function isSuperUserRole(value = '') {
  return ['super', 'super-user', 'superuser', 'root', 'kcp-superuser', 'kcp-super-user']
    .includes(normalizeRoleName(value));
}

export function hasPermission(access: AccessSnapshot | null, permission: string) {
  if (!access) return false;
  return access.currentIsSuperUser || access.currentIsKcpSuperUser || access.permissions.includes(permission);
}

export function hasSectionAccess(access: AccessSnapshot | null, section: keyof typeof SECTION_PERMISSION_MAP) {
  return hasPermission(access, SECTION_PERMISSION_MAP[section]);
}

export function sectionsForPermissions(permissions: string[], unrestricted = false) {
  return Object.entries(SECTION_PERMISSION_MAP)
    .filter(([, permission]) => unrestricted || permissions.includes(permission))
    .map(([section]) => section);
}

export function buildAccessSnapshot(
  response: Record<string, unknown>,
  user: AuthUser,
  rawLocations: unknown[]
): AccessSnapshot {
  const team = arrayOfRecords(response.team);
  const customRoles = arrayOfRecords(response.customRoles);
  const currentRole = normalizeRoleName(String(response.currentRole || findCurrentMember(team, user)?.role || 'member'));
  const currentIsKcpSuperUser = response.currentIsKcpSuperUser === true;
  const currentIsSuperUser = response.currentIsSuperUser === true || currentIsKcpSuperUser || isSuperUserRole(currentRole);
  const customRole = customRoles.find((entry) => normalizeRoleName(String(entry.name || '')) === currentRole);
  const baseRole = DEFAULT_ROLES[currentRole] || DEFAULT_ROLES.member;
  const roleDefinition = customRole
    ? role(
        currentRole,
        String(customRole.label || customRole.name || baseRole.label),
        stringArray(customRole.permissions),
        normalizeRoleLocations(customRole.locations)
      )
    : { ...baseRole, permissions: [...baseRole.permissions], locations: [...baseRole.locations] };
  const currentMember = findCurrentMember(team, user);
  const currentUserLocations = normalizeUserLocations(
    response.currentUserLocations || currentMember?.allowedLocations || currentMember?.locations || []
  );
  const locations = normalizeKcpLocations(rawLocations);
  const accessibleLocations = filterLocations(
    locations,
    currentRole,
    currentIsSuperUser,
    roleDefinition.locations,
    currentUserLocations
  );
  const permissions = currentIsSuperUser
    ? unique([...ALL_NAV_PERMISSIONS, ...ALL_ACTION_PERMISSIONS, ...roleDefinition.permissions])
    : unique(roleDefinition.permissions);

  return {
    currentRole,
    currentIsSuperUser,
    currentIsKcpSuperUser,
    permissions,
    allowedSections: Object.entries(SECTION_PERMISSION_MAP)
      .filter(([, permission]) => currentIsSuperUser || permissions.includes(permission))
      .map(([section]) => section),
    currentUserLocations,
    accessibleLocations,
    roleDefinition: { ...roleDefinition, permissions }
  };
}

export function normalizeKcpLocations(value: unknown[]): KcpLocation[] {
  const byId = new Set<string>();
  const byName = new Set<string>();
  const output: KcpLocation[] = [];
  arrayOfRecords(value).forEach((entry) => {
    if (entry.active === false || Number(entry.active ?? 1) === 0) return;
    const id = String(entry.id || entry.locationId || entry.location_id || entry.value || '').trim();
    const name = String(entry.displayName || entry.display_name || entry.name || entry.locationName || entry.label || id).trim();
    if (!id && !name) return;
    const idKey = accessKey(id);
    const nameKey = accessKey(name);
    if ((idKey && byId.has(idKey)) || (nameKey && byName.has(nameKey))) return;
    const location: KcpLocation = {
      ...entry,
      id: id || name,
      locationId: id || name,
      name: name || id,
      displayName: name || id,
      kind: String(entry.kind || entry.type || entry.locationType || 'selling'),
      active: true,
      isDefault: entry.isDefault === true || Number(entry.is_default || 0) === 1
    };
    output.push(location);
    if (idKey) byId.add(idKey);
    if (nameKey) byName.add(nameKey);
  });
  return output.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function filterLocations(
  locations: KcpLocation[],
  currentRole: string,
  currentIsSuperUser: boolean,
  roleLocations: string[],
  userLocations: string[]
) {
  if (currentIsSuperUser || ['owner', 'admin'].includes(currentRole)) return locations;
  const effective = intersectLocationScopes(roleLocations, userLocations);
  if (effective === null) return locations;
  const keys = new Set(effective.map(accessKey));
  return locations.filter((location) => [location.id, location.locationId, location.name, location.displayName]
    .map(accessKey)
    .some((key) => keys.has(key)));
}

function intersectLocationScopes(roleLocations: string[], userLocations: string[]): string[] | null {
  if (roleLocations.includes('all') && userLocations.includes('all')) return null;
  if (userLocations.includes('all')) return roleLocations.includes('all') || !roleLocations.length ? null : roleLocations;
  if (roleLocations.includes('all')) return userLocations;
  if (!roleLocations.length || !userLocations.length) return [];
  const userKeys = new Set(userLocations.map(accessKey));
  return roleLocations.filter((location) => userKeys.has(accessKey(location)));
}

function findCurrentMember(team: Record<string, unknown>[], user: AuthUser) {
  return team.find((member) => {
    const uid = String(member.uid || member.authUid || member.auth_uid || member.id || '').trim();
    const email = String(member.email || '').trim().toLowerCase();
    return (uid && uid === user.uid) || (email && email === user.email);
  });
}

function normalizeRoleLocations(value: unknown) {
  if (!Array.isArray(value)) return ['all'];
  return unique(stringArray(value).map((entry) => entry.toLowerCase() === 'all' ? 'all' : entry));
}

function normalizeUserLocations(value: unknown) {
  return unique(stringArray(value).map((entry) => entry.toLowerCase() === 'all' ? 'all' : entry));
}

function accessKey(value: unknown) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')) : [];
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
