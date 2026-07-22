import type { AuthUser, MobileFeatureFlags, WorkspaceBootstrap } from '../../types/kcp';
import { apiRequest, workspaceRequest } from './client';
import { buildAccessSnapshot, normalizeKcpLocations, sectionsForPermissions } from '../permissions/permissions';
import { resolveWorkspaceTheme } from '../theme/presets';
import { resolveRoleSet } from '../../features/role-sets/roleSetModel';

type MobileBootstrapResponse = {
  ok: boolean;
  apiVersion: string;
  minSupportedAppVersion: string;
  workspaces: Array<{
    id: string;
    role: string;
    permissions: string[];
    allowedLocationIds: string[] | null;
  }>;
  featureFlags: MobileFeatureFlags;
  locations?: unknown[];
};

export async function loadWorkspaceBootstrap(workspaceId: string, user: AuthUser): Promise<WorkspaceBootstrap> {
  const [mobileResponse, accessResponse, settingsResponse, preferencesResponse, locationsResponse, roleSetResponse] = await Promise.all([
    apiRequest<MobileBootstrapResponse>('api/mobile/v1/bootstrap', { query: { workspaceId } }),
    workspaceRequest<Record<string, unknown>>(workspaceId, 'access-management'),
    workspaceRequest<{ settings?: Record<string, unknown> }>(workspaceId, 'settings'),
    workspaceRequest<{ preferences?: Record<string, unknown> }>(workspaceId, 'user-preferences')
      .catch(() => ({ preferences: {} })),
    workspaceRequest<{ locations?: unknown[] }>(workspaceId, 'locations'),
    apiRequest<{ ok: boolean; roleSet?: unknown }>(`api/mobile/v1/workspaces/${encodeURIComponent(workspaceId)}/role-sets/current`).catch((): { ok: boolean; roleSet?: unknown } => ({ ok: false }))
  ]);

  const rawLocations = Array.isArray(mobileResponse.locations)
    ? mobileResponse.locations
    : Array.isArray(locationsResponse.locations)
      ? locationsResponse.locations
      : Array.isArray(accessResponse.locations)
        ? accessResponse.locations as unknown[]
        : [];
  const locations = normalizeKcpLocations(rawLocations);
  const settings = {
    ...(settingsResponse.settings || {}),
    ...(preferencesResponse.preferences || {})
  };
  const mobileWorkspace = mobileResponse.workspaces.find((workspace) => workspace.id === workspaceId);
  if (!mobileWorkspace) throw new Error('This workspace is not available to your mobile session.');
  // The mobile bootstrap is the current authority for the signed-in member.
  // Rebuild the display role from that response too, so a changed main-app role
  // cannot leave a device showing the previous role's task set.
  const legacyAccess = buildAccessSnapshot({ ...accessResponse, currentRole: mobileWorkspace.role }, user, locations);
  const permissions = Array.isArray(mobileWorkspace.permissions) ? mobileWorkspace.permissions : [];
  const unrestricted = legacyAccess.currentIsSuperUser || legacyAccess.currentIsKcpSuperUser;
  const access = {
    ...legacyAccess,
    currentRole: mobileWorkspace.role || legacyAccess.currentRole,
    permissions,
    allowedSections: sectionsForPermissions(permissions, unrestricted),
    currentUserLocations: mobileWorkspace.allowedLocationIds === null ? ['all'] : mobileWorkspace.allowedLocationIds,
    accessibleLocations: locations,
    roleDefinition: { ...legacyAccess.roleDefinition, permissions }
  };
  const roleSet = resolveRoleSet(roleSetResponse.roleSet, access);
  return {
    access,
    locations,
    settings,
    theme: resolveWorkspaceTheme(settings),
    mobileApiVersion: mobileResponse.apiVersion,
    minSupportedAppVersion: mobileResponse.minSupportedAppVersion,
    featureFlags: mobileResponse.featureFlags,
    roleSet
  };
}
