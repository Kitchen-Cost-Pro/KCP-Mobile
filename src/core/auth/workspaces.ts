import type { UserProfile, WorkspaceOption } from '../../types/kcp';

export function resolveWorkspaceOptions(profile: UserProfile = {}): WorkspaceOption[] {
  const entries = Object.entries(profile.workspaces || {}).map(([id, info]) => ({
    id,
    role: String(info?.role || profile.role || 'member'),
    siteName: String(info?.siteName || profile.siteName || id)
  }));

  if (!entries.length && profile.workspaceId) {
    entries.push({
      id: profile.workspaceId,
      role: String(profile.role || 'member'),
      siteName: String(profile.siteName || profile.workspaceId)
    });
  }

  return entries.sort((left, right) => left.siteName.localeCompare(right.siteName));
}

const LAST_WORKSPACE_PREFIX = 'kcp-mobile:last-workspace:';

export function readLastWorkspace(userId: string) {
  try {
    return window.localStorage.getItem(`${LAST_WORKSPACE_PREFIX}${userId}`) || '';
  } catch {
    return '';
  }
}

export function saveLastWorkspace(userId: string, workspaceId: string) {
  try {
    window.localStorage.setItem(`${LAST_WORKSPACE_PREFIX}${userId}`, workspaceId);
  } catch {
    // Workspace preference is non-sensitive and optional.
  }
}

export function clearLastWorkspace(userId: string) {
  try {
    window.localStorage.removeItem(`${LAST_WORKSPACE_PREFIX}${userId}`);
  } catch {
    // Ignore storage restrictions in private browsing contexts.
  }
}
